
/** V 1.0 */
import { create } from 'zustand';
import { CourseLevel, UserProgress, Module, UserRole, LevelStatus, PackageType, SnehiScenario } from '../types';
import { getUserSession } from '../services/authService';
import { fetchAllModules } from '../services/courseService';
import { supabase } from '../lib/supabase';
import { LEVEL_ORDER } from '../constants';
import { db } from '../lib/db';
import { syncUp } from '../services/syncService';
import { evaluateSnehiScorecard } from '../services/geminiService';

interface AppState {
    session: any | null;
    progress: UserProgress | null;
    modules: Module[];
    loading: boolean;
    initialized: boolean;
    dataSaverMode: boolean;
    evaluationHistory: any[];
    scenarios: SnehiScenario[];
    currentScenarioId: string | null;
    scenarioSaves: any[];
    clearChatRequested: boolean;

    // Actions
    initialize: (forceRefresh?: boolean) => Promise<void>;
    setSession: (session: any) => void;
    updateProgress: (lessonId: string, level: CourseLevel) => Promise<void>;
    unlockNextLevel: (currentLevel: CourseLevel) => Promise<void>;
    setPlacementResult: (result: { suggestedLevel: CourseLevel, score: number, reasoning: string, reasoningKn: string }) => Promise<void>;
    fetchEvaluationHistory: () => Promise<void>;
    refreshModules: () => Promise<void>;
    setDataSaverMode: (enabled: boolean) => void;
    syncUsage: (type: 'voice' | 'chat', amount: number) => void;
    updateSNEHIPreferences: (updates: { prefersTranslation?: boolean, prefersPronunciation?: boolean }) => Promise<void>;
    fetchScenarios: (userId?: string) => Promise<void>;
    setCurrentScenario: (id: string | null) => void;
    markScenarioComplete: (scenarioId: string) => Promise<void>;
    refreshSession: () => Promise<void>;
    fetchScenarioSaves: () => Promise<void>;
    saveScenarioPractice: (scenarioId: string, chatHistory: any[], audioBlob?: Blob, duration?: number) => Promise<void>;
    setClearChatRequested: (requested: boolean) => void;
    addCustomScenario: (scenario: SnehiScenario) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
    session: null,
    progress: null,
    modules: [],
    evaluationHistory: [],
    loading: true,
    initialized: false,
    scenarios: [],
    currentScenarioId: null,
    scenarioSaves: [],
    clearChatRequested: false,
    dataSaverMode: (() => {
        const enabled = localStorage.getItem('dataSaverMode') === 'true';
        if (enabled) document.documentElement.classList.add('data-saver-active');
        return enabled;
    })(),

    setSession: (session) => set({ session }),

    initialize: async (forceRefresh?: boolean) => {
        if (get().initialized && !forceRefresh) return;

        if (get().dataSaverMode) {
            document.documentElement.classList.add('data-saver-active');
        }

        set({ loading: true });
        console.log("🚀 Starting App Initialization...");

        try {
            // STEP 1: Get auth session. Wrapped in try-catch to silently handle
            // the 'Invalid Refresh Token' error for unauthenticated guest users,
            // which would otherwise pollute the browser console.
            const { data: { session: rawSession } } = await supabase.auth.getSession()
                .catch(() => ({ data: { session: null }, error: null }));
            const userId = rawSession?.user?.id;
            console.log("✅ Auth check complete. User:", userId || 'Guest');

            // STEP 2: Fetch modules and profile in parallel. Progress is skipped for guests.
            const [profile, modules, progressResult] = await Promise.all([
                getUserSession(rawSession).catch(e => {
                    console.error("Profile fetch error:", e);
                    return null;
                }),
                fetchAllModules().catch(e => {
                    console.error("Modules fetch error:", e);
                    return [];
                }),
                userId
                    ? (async () => {
                        let localProg = await db.user_progress.get(userId);
                        if (!localProg && navigator.onLine) {
                            const res = await supabase.from('user_progress').select('*').eq('user_id', userId).maybeSingle();
                            if (res.data) {
                                await db.user_progress.put(res.data);
                                localProg = res.data;
                            }
                        }
                        return { data: localProg, error: null };
                    })()
                    : Promise.resolve({ data: null, error: null })
            ]);

            const currentSession = get().session;

            // Fallback: build a minimal session from raw jwt data if profile fetch failed
            const fetchedSession = profile ?? (rawSession ? {
                id: rawSession.user.id,
                name: rawSession.user.user_metadata?.full_name || 'User',
                role: rawSession.user.user_metadata?.role || UserRole.STUDENT,
                packageType: rawSession.user.user_metadata?.package_type,
                packageStatus: rawSession.user.user_metadata?.package_status,
                isLoggedIn: true,
                isRestricted: false,
            } : null);

            // CRITICAL: Merge speculatively to preserve package info if currentSession already has it but fetched one says NONE (stale Auth metadata)
            const session = fetchedSession ? {
                ...currentSession,
                ...fetchedSession,
                // Only use 'NONE' as value if it's explicitly set or we've confirmed the profile has NO package
                packageType: fetchedSession.packageType || currentSession?.packageType,
                packageStatus: fetchedSession.packageStatus || currentSession?.packageStatus,
            } : null;

            set({ session, modules: modules || [], initialized: true });
            console.log("✅ Core state set. Session:", !!session, "Modules:", modules?.length);

            // Fetch SNEHI scenarios — pass userId directly to avoid race with set()
            await get().fetchScenarios(userId || undefined);

            if (userId) {
                get().fetchEvaluationHistory();
            }

            // STEP 3: Process user progress if available
            if (progressResult?.data) {
                const data = progressResult.data;
                const completedLessons: string[] = data.completed_lessons || [];
                const currentLevel = (data.current_level as CourseLevel) || CourseLevel.BASIC;
                const currentLevelIndex = LEVEL_ORDER.indexOf(currentLevel);

                set({
                    progress: {
                        currentLevel,
                        completedLessons,
                        role: session?.role || UserRole.STUDENT,
                        isPlacementDone: data.is_placement_done,
                        completedScenarios: data.completed_scenarios || [],
                    }
                });

                // Map completion and lock status onto modules
                const updatedModules = (modules || []).map(m => {
                    const mIndex = LEVEL_ORDER.indexOf(m.level as CourseLevel);
                    const lessons = (m.lessons || []).map((l: any) => ({
                        ...l,
                        isCompleted: completedLessons.includes(l.id)
                    }));
                    let status = LevelStatus.LOCKED;
                    if (mIndex < currentLevelIndex) status = LevelStatus.COMPLETED;
                    else if (mIndex === currentLevelIndex) status = LevelStatus.AVAILABLE;
                    return { ...m, lessons, status };
                });

                set({ modules: updatedModules });
                console.log("✅ Progress loaded. Level:", currentLevel);
            } else if (progressResult?.error && userId) {
                // Auth issue: stale JWT - sign out and clear state
                const errMsg = progressResult.error.message || '';
                if (progressResult.error.status === 401 || errMsg.includes("JWT")) {
                    console.warn("🔒 Stale JWT detected — signing out.");
                    await supabase.auth.signOut();
                    set({ session: null, progress: null });
                } else {
                    console.warn("Progress fetch returned no data");
                    set({
                        progress: {
                            currentLevel: CourseLevel.BASIC,
                            completedLessons: [],
                            role: session?.role || UserRole.STUDENT,
                            isPlacementDone: false,
                            completedScenarios: [],
                        }
                    });
                }
            } else if (userId && !progressResult?.data) {
                // Handle the case where result.data is null without an explicit error
                set({
                    progress: {
                        currentLevel: CourseLevel.BASIC,
                        completedLessons: [],
                        role: session?.role || UserRole.STUDENT,
                        isPlacementDone: false,
                        completedScenarios: [],
                    }
                });
            }
        } catch (err) {
            console.error("Critical initialization error:", err);
        } finally {
            // FINAL FAIL-SAFE: If we are logged in but progress is STILL null 
            // after attempt, set a basic progress object to avoid permanent blank page.
            if (get().session?.id && !get().progress) {
                set({
                    progress: {
                        currentLevel: CourseLevel.BASIC,
                        completedLessons: [],
                        role: get().session?.role || UserRole.STUDENT,
                        isPlacementDone: false,
                        completedScenarios: [],
                    }
                });
            }
            set({ loading: false });
            console.log("🏁 Initialization complete.");
        }
    },

    refreshModules: async () => {
        const modules = await fetchAllModules();
        const { progress } = get();

        if (progress) {
            const currentLevelIndex = LEVEL_ORDER.indexOf(progress.currentLevel);
            const updatedModules = modules.map(m => {
                const mIndex = LEVEL_ORDER.indexOf(m.level as CourseLevel);
                const lessons = m.lessons.map(l => ({
                    ...l,
                    isCompleted: progress.completedLessons.includes(l.id)
                }));
                let status = LevelStatus.LOCKED;
                if (mIndex < currentLevelIndex) status = LevelStatus.COMPLETED;
                else if (mIndex === currentLevelIndex) status = LevelStatus.AVAILABLE;
                return { ...m, lessons, status };
            });
            set({ modules: updatedModules });
        } else {
            set({ modules });
        }
    },

    updateProgress: async (lessonId, level) => {
        const { session, progress, modules } = get();
        if (!session?.id || session.isRestricted || !progress) return;

        const newCompleted = progress.completedLessons.includes(lessonId)
            ? progress.completedLessons
            : [...progress.completedLessons, lessonId];

        const updatedModules = modules.map(m => {
            if (m.level === level) {
                return {
                    ...m,
                    lessons: m.lessons.map(l => l.id === lessonId ? { ...l, isCompleted: true } : l)
                };
            }
            return m;
        });

        set({
            progress: { ...progress, completedLessons: newCompleted },
            modules: updatedModules
        });

        try {
            const payload = {
                user_id: session.id,
                completed_lessons: newCompleted,
                current_level: progress.currentLevel,
                is_placement_done: progress.isPlacementDone || false,
                updated_at: new Date().toISOString()
            };

            await db.user_progress.put(payload);
            await db.sync_queue.add({ action: 'UPSERT_PROGRESS', payload, created_at: Date.now() });
            syncUp();

            const currentModule = updatedModules.find(m => m.level === level);
            if (currentModule) {
                const isLevelFinished = currentModule.lessons.every(l => l.isCompleted);
                if (isLevelFinished) {
                    await get().unlockNextLevel(level);
                }
            }
        } catch (e) {
            console.error("Error updating progress in local DB", e);
        }
    },

    unlockNextLevel: async (currentLevel) => {
        const { session, progress, modules } = get();
        if (!session?.id || !progress) return;

        const currentIndex = LEVEL_ORDER.indexOf(currentLevel);
        if (currentIndex < LEVEL_ORDER.length - 1) {
            const nextLevel = LEVEL_ORDER[currentIndex + 1];
            const updatedModules = modules.map(m => {
                if (m.level === nextLevel) return { ...m, status: LevelStatus.AVAILABLE };
                if (m.level === currentLevel) return { ...m, status: LevelStatus.COMPLETED };
                return m;
            });
            set({
                progress: { ...progress, currentLevel: nextLevel },
                modules: updatedModules
            });
            const payload = {
                user_id: session.id,
                completed_lessons: progress.completedLessons,
                current_level: nextLevel,
                is_placement_done: progress.isPlacementDone || false,
                updated_at: new Date().toISOString()
            };
            await db.user_progress.put(payload);
            await db.sync_queue.add({ action: 'UPSERT_PROGRESS', payload, created_at: Date.now() });
            syncUp();
        } else {
            set({
                modules: modules.map(m =>
                    m.level === currentLevel ? { ...m, status: LevelStatus.COMPLETED } : m
                )
            });
        }
    },

    setPlacementResult: async (result) => {
        const { session, progress } = get();
        if (!session?.id || session.isRestricted) return;

        const { suggestedLevel, score, reasoning, reasoningKn } = result;
        const targetIndex = LEVEL_ORDER.indexOf(suggestedLevel);

        set({
            progress: {
                currentLevel: suggestedLevel,
                completedLessons: [],
                isPlacementDone: true,
                role: session.role,
                completedScenarios: progress?.completedScenarios || [],
            }
        });

        const updatedModules = get().modules.map(m => {
            const mIndex = LEVEL_ORDER.indexOf(m.level as CourseLevel);
            if (mIndex < targetIndex) return { ...m, status: LevelStatus.COMPLETED };
            if (mIndex === targetIndex) return { ...m, status: LevelStatus.AVAILABLE };
            return { ...m, status: LevelStatus.LOCKED };
        });
        set({ modules: updatedModules });

        const payload = {
            user_id: session.id,
            current_level: suggestedLevel,
            completed_lessons: [],
            is_placement_done: true,
            updated_at: new Date().toISOString()
        };
        await db.user_progress.put(payload);

        // Save to evaluations history
        await supabase.from('ai_evaluations').insert({
            user_id: session.id,
            level: suggestedLevel,
            score,
            reasoning,
            reasoning_kn: reasoningKn
        });

        await db.sync_queue.add({ action: 'UPSERT_PROGRESS', payload, created_at: Date.now() });
        syncUp();
        get().fetchEvaluationHistory();
    },

    fetchEvaluationHistory: async () => {
        const { session } = get();
        if (!session?.id) return;
        const { data, error } = await supabase
            .from('ai_evaluations')
            .select('*')
            .eq('user_id', session.id)
            .order('created_at', { ascending: false })
            .limit(5);
        if (!error && data) {
            set({ evaluationHistory: data });
        }
    },

    setDataSaverMode: (enabled: boolean) => {
        localStorage.setItem('dataSaverMode', String(enabled));
        set({ dataSaverMode: enabled });
        if (enabled) {
            document.documentElement.classList.add('data-saver-active');
        } else {
            document.documentElement.classList.remove('data-saver-active');
        }
    },

    syncUsage: (type, amount) => {
        const { session } = get();
        if (!session) return;

        const updatedSession = { ...session };
        if (type === 'voice') {
            updatedSession.totalTalkTime = (updatedSession.totalTalkTime || 0) + amount;
            // Also decrement credits if applicable
            if (session.packageType === PackageType.SNEHI && session.agentCredits !== undefined) {
                const mins = Math.ceil(amount / 60);
                updatedSession.agentCredits = Math.max(0, session.agentCredits - mins);
            }
        } else {
            updatedSession.totalMessagesSent = (updatedSession.totalMessagesSent || 0) + amount;
        }

        set({ session: updatedSession });
    },

    refreshSession: async () => {
        const profile = await getUserSession(undefined, true);
        if (profile) {
            const currentSession = get().session;
            set({
                session: {
                    ...currentSession,
                    ...profile,
                    packageType: (profile.packageType !== 'NONE') ? profile.packageType : (currentSession?.packageType || 'NONE'),
                    packageStatus: (profile.packageStatus !== 'INACTIVE') ? profile.packageStatus : (currentSession?.packageStatus || 'INACTIVE'),
                }
            });
        }
    },
    updateSNEHIPreferences: async (updates) => {
        const { session } = get();
        if (!session?.id) return;

        const updatedSession = { ...session, ...updates };
        set({ session: updatedSession });

        try {
            await supabase.from('profiles').update({
                prefers_translation: updates.prefersTranslation ?? session.prefersTranslation,
                prefers_pronunciation: updates.prefersPronunciation ?? session.prefersPronunciation
            }).eq('id', session.id);
        } catch (e) {
            console.error("Failed to update SNEHI preferences:", e);
        }
    },
    fetchScenarios: async (passedUserId?: string) => {
        // Use passed userId to avoid race with store session state
        const userId = passedUserId ?? get().session?.id;
        try {
            let baseScenarios: SnehiScenario[] = [];
            // First, try fetching from Supabase to get the freshest data
            if (navigator.onLine) {
                const { data, error } = await supabase.from('snehi_scenarios').select('*').order('order_index');
                if (!error && data) {
                    baseScenarios = data.map(s => ({
                        id: s.id,
                        title: s.title,
                        category: s.category,
                        level: s.level,
                        systemInstruction: s.system_instruction,
                        initialMessage: s.initial_message,
                        order_index: s.order_index
                    }));
                    
                    // Update local DB cache
                    await db.snehi_scenarios.clear();
                    await db.snehi_scenarios.bulkPut(baseScenarios);
                    console.log("✅ Standard scenarios synced from Supabase");
                }
            }

            if (baseScenarios.length === 0) {
                // Fallback to local DB if offline or if fetch failed
                baseScenarios = await db.snehi_scenarios.orderBy('order_index').toArray();
            }
            
            // ALWAYS MERGE CUSTOM SCENARIOS FROM LOCAL DB
            const customLocal = await db.user_custom_scenarios.toArray();
            let allScenarios = [...baseScenarios];
            
            // FETCH CUSTOM SCENARIOS FROM SUPABASE IF ONLINE AND USER IS LOGGED IN
            if (navigator.onLine && userId) {
               const { data: remoteCustom, error: remoteError } = await supabase
                  .from('user_custom_scenarios')
                  .select('*')
                  .eq('user_id', userId);
               
               if (!remoteError && remoteCustom) {
                  const mappedRemote = remoteCustom.map(s => ({
                     id: s.id,
                     title: s.title,
                     category: s.category,
                     level: s.level,
                     systemInstruction: s.system_instruction,
                     initialMessage: s.initial_message,
                     order_index: 999
                  }));
                  
                  // Sync to local DB
                  await db.user_custom_scenarios.bulkPut(mappedRemote);
                  
                  // Merge with deduping
                  mappedRemote.forEach(rs => {
                     if (!allScenarios.find(s => s.id === rs.id)) {
                        allScenarios.push(rs);
                     }
                  });
                  console.log(`✅ Fetched ${mappedRemote.length} custom scenarios from Supabase for user`, userId);
               } else if (remoteError) {
                  console.warn('Failed to fetch custom scenarios from Supabase:', remoteError.message);
               }
            }

            // Also merge from local Dexie (for offline-created ones not yet synced)
            customLocal.forEach(cs => {
               if (!allScenarios.find(s => s.id === cs.id)) {
                  allScenarios.push(cs);
               }
            });

            set({ scenarios: allScenarios });
        } catch (e) {
            console.error("Fetch Scenarios Error:", e);
        }
    },
    setCurrentScenario: (id) => set({ currentScenarioId: id }),
    markScenarioComplete: async (scenarioId) => {
        const { session, progress } = get();
        if (!session?.id || !progress) return;

        if (progress.completedScenarios.includes(scenarioId)) return;
        const newCompleted = [...progress.completedScenarios, scenarioId];

        set({ progress: { ...progress, completedScenarios: newCompleted } });

        try {
            const payload = {
                user_id: session.id,
                completed_lessons: progress.completedLessons,
                completed_scenarios: newCompleted,
                current_level: progress.currentLevel,
                is_placement_done: progress.isPlacementDone || false,
                updated_at: new Date().toISOString()
            };
            await db.user_progress.put(payload);
            // We should also update profiles in Supabase directly for scenarios to ensure it's saved
            await supabase.from('profiles').update({ completed_scenarios: newCompleted }).eq('id', session.id);
        } catch (e) {
            console.error("Error marking scenario complete", e);
        }
    },
    fetchScenarioSaves: async () => {
        const { session } = get();
        if (!session?.id) return;
        try {
            const { data, error } = await supabase
                .from('scenario_saves')
                .select('*')
                .eq('user_id', session.id)
                .order('created_at', { ascending: false });
            if (!error && data) {
                set({ scenarioSaves: data });
            }
        } catch (e) {
            console.error("Fetch Scenario Saves Error:", e);
        }
    },
    saveScenarioPractice: async (scenarioId, chatHistory, audioBlob, duration = 0) => {
        const { session } = get();
        if (!session?.id) return;
        
        try {
            let audioUrl = null;
            if (audioBlob) {
                try {
                    const fileName = `${session.id}/${scenarioId}_${Date.now()}.webm`;
                    const { data, error: uploadError } = await supabase.storage
                        .from('scenario-audio')
                        .upload(fileName, audioBlob);
                    
                    if (!uploadError) {
                        const { data: { publicUrl } } = supabase.storage
                            .from('scenario-audio')
                            .getPublicUrl(fileName);
                        audioUrl = publicUrl;
                    } else {
                        alert(`DEBUG - Upload Error: ${JSON.stringify(uploadError)}`);
                        console.warn("Audio upload failed:", uploadError);
                    }
                } catch (audioErr) {
                    alert(`DEBUG - Audio save exception: ${audioErr}`);
                    console.error("Audio save error (continuing with chat only):", audioErr);
                }
            } else {
                alert("DEBUG - audioBlob is null or undefined! The recorder did not output a file.");
            }

            // --- Generate AI Scorecard ---
            let scorecard = null;
            try {
                // Format chat history for the AI
                const transcript = chatHistory.map(m => {
                    let msg = `${m.role.toUpperCase()}: ${m.text}`;
                    if (m.correction) msg += `\n[Correction given: ${m.correction}]`;
                    if (m.pronunciationTip) msg += `\n[Pronunciation Tip: ${m.pronunciationTip}]`;
                    return msg;
                }).join('\n\n');

                scorecard = await evaluateSnehiScorecard(transcript);
            } catch (evalErr) {
                console.error("Scorecard evaluation failed:", evalErr);
            }

            const safeInt = (val: any) => {
                if (val == null) return null;
                const parsed = Math.round(Number(val));
                return isNaN(parsed) ? null : parsed;
            };

            const { error: insertError } = await supabase
                .from('scenario_saves')
                .insert([{
                    user_id: session.id,
                    scenario_id: scenarioId,
                    chat_history: chatHistory,
                    audio_url: audioUrl,
                    duration_seconds: duration,
                    p_score: safeInt(scorecard?.p_score),
                    f_score: safeInt(scorecard?.f_score),
                    c_score: safeInt(scorecard?.c_score),
                    a_score: safeInt(scorecard?.a_score),
                    evaluation_feedback: scorecard?.evaluation_feedback || null
                }]);

            if (insertError) {
                alert(`DEBUG - Insert Error: ${insertError.message}\nCode: ${insertError.code}\nDetails: ${insertError.details}`);
                throw insertError;
            }

            // Refresh saves
            await get().fetchScenarioSaves();
        } catch (e) {
            console.error("Save Scenario Practice Error:", e);
            throw e;
        }
    },
    setClearChatRequested: (requested) => set({ clearChatRequested: requested }),
    addCustomScenario: async (scenario) => {
        set((state) => ({ scenarios: [...state.scenarios, scenario] }));
        const userId = get().session?.id;
        try {
            // 1. Save to local DB (Dexie)
            await db.user_custom_scenarios.put({
                ...scenario,
                user_id: userId || 'guest'
            });

            // 2. Sync to Supabase if logged in
            if (userId && userId !== 'guest') {
                const { error } = await supabase.from('user_custom_scenarios').insert({
                    id: scenario.id,
                    user_id: userId,
                    title: scenario.title,
                    category: scenario.category,
                    level: scenario.level,
                    system_instruction: scenario.systemInstruction,
                    initial_message: scenario.initialMessage
                });
                if (error) console.error("Supabase sync error for custom scenario:", error);
                else console.log("✅ Custom scenario synced to Supabase");
            }
        } catch (e) {
            console.error("Failed to persist custom scenario:", e);
        }
    },
}));
