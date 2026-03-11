
/** V 1.0 */
import { create } from 'zustand';
import { CourseLevel, UserProgress, Module, UserRole, LevelStatus, PackageType } from '../types';
import { getUserSession } from '../services/authService';
import { fetchAllModules } from '../services/courseService';
import { supabase } from '../lib/supabase';
import { LEVEL_ORDER } from '../constants';
import { db } from '../lib/db';
import { syncUp } from '../services/syncService';

interface AppState {
    session: any | null;
    progress: UserProgress | null;
    modules: Module[];
    loading: boolean;
    initialized: boolean;
    dataSaverMode: boolean;
    evaluationHistory: any[];

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
    refreshSession: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    session: null,
    progress: null,
    modules: [],
    evaluationHistory: [],
    loading: true,
    initialized: false,
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
                packageType: rawSession.user.user_metadata?.package_type || 'NONE',
                packageStatus: rawSession.user.user_metadata?.package_status || 'INACTIVE',
                isLoggedIn: true,
                isRestricted: false,
            } : null);

            // CRITICAL: Merge speculatively to preserve package info if the fetch was partial 
            // or if we are in the middle of a post-payment re-refetch.
            const session = fetchedSession ? {
                ...currentSession,
                ...fetchedSession,
                // Hard-preserve package if currentSession already has it but fetched one says NONE (stale Auth metadata)
                packageType: (fetchedSession.packageType !== 'NONE') ? fetchedSession.packageType : (currentSession?.packageType || 'NONE'),
                packageStatus: (fetchedSession.packageStatus !== 'INACTIVE') ? fetchedSession.packageStatus : (currentSession?.packageStatus || 'INACTIVE'),
            } : null;

            set({ session, modules: modules || [], initialized: true });
            console.log("✅ Core state set. Session:", !!session, "Modules:", modules?.length);

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
                    console.warn("Progress fetch returned no data:", errMsg);
                    // FAIL-SAFE: If user exists but progress doesn't, initialize default progress 
                    // to prevent blank page/deadlock.
                    set({
                        progress: {
                            currentLevel: CourseLevel.BASIC,
                            completedLessons: [],
                            role: session?.role || UserRole.STUDENT,
                            isPlacementDone: false,
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
        const { session } = get();
        if (!session?.id || session.isRestricted) return;

        const { suggestedLevel, score, reasoning, reasoningKn } = result;
        const targetIndex = LEVEL_ORDER.indexOf(suggestedLevel);

        set({
            progress: {
                currentLevel: suggestedLevel,
                completedLessons: [],
                isPlacementDone: true,
                role: session.role
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
        const profile = await getUserSession();
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
}));
