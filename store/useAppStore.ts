
import { create } from 'zustand';
import { CourseLevel, UserProgress, Module, UserRole, LevelStatus } from '../types';
import { getUserSession } from '../services/authService';
import { fetchAllModules } from '../services/courseService';
import { supabase } from '../lib/supabase';
import { LEVEL_ORDER } from '../constants';

interface AppState {
    session: any | null;
    progress: UserProgress | null;
    modules: Module[];
    loading: boolean;
    initialized: boolean;

    // Actions
    initialize: (forceRefresh?: boolean) => Promise<void>;
    setSession: (session: any) => void;
    updateProgress: (lessonId: string, level: CourseLevel) => Promise<void>;
    unlockNextLevel: (currentLevel: CourseLevel) => Promise<void>;
    setPlacementResult: (level: CourseLevel) => Promise<void>;
    refreshModules: () => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
    session: null,
    progress: null,
    modules: [],
    loading: true,
    initialized: false,

    setSession: (session) => set({ session }),

    initialize: async (forceRefresh?: boolean) => {
        if (get().initialized && !forceRefresh) return;

        set({ loading: true });
        console.log("🚀 Starting App Initialization...");

        try {
            // STEP 1: Get auth session. The Navigator Lock is disabled in supabase.ts, 
            // so this is now fast and reliable with no deadlock risk.
            const { data: { session: rawSession } } = await supabase.auth.getSession();
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
                    ? supabase.from('user_progress').select('*').eq('user_id', userId).single()
                    : Promise.resolve({ data: null, error: null })
            ]);

            // Fallback: build a minimal session from raw jwt data if profile fetch failed
            const session = profile ?? (rawSession ? {
                id: rawSession.user.id,
                name: rawSession.user.user_metadata?.full_name || 'User',
                role: rawSession.user.user_metadata?.role || UserRole.STUDENT,
                isLoggedIn: true,
                isRestricted: false,
            } : null);

            set({ session, modules: modules || [], initialized: true });
            console.log("✅ Core state set. Session:", !!session, "Modules:", modules?.length);

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
                }
            }
        } catch (err) {
            console.error("Critical initialization error:", err);
        } finally {
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
            await supabase.from('user_progress').upsert({
                user_id: session.id,
                completed_lessons: newCompleted,
                updated_at: new Date().toISOString()
            });

            const currentModule = updatedModules.find(m => m.level === level);
            if (currentModule) {
                const isLevelFinished = currentModule.lessons.every(l => l.isCompleted);
                if (isLevelFinished) {
                    await get().unlockNextLevel(level);
                }
            }
        } catch (e) {
            console.error("Error updating progress in DB", e);
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
            await supabase.from('user_progress').update({ current_level: nextLevel }).eq('user_id', session.id);
        } else {
            set({
                modules: modules.map(m =>
                    m.level === currentLevel ? { ...m, status: LevelStatus.COMPLETED } : m
                )
            });
        }
    },

    setPlacementResult: async (level) => {
        const { session } = get();
        if (!session?.id || session.isRestricted) return;

        const targetIndex = LEVEL_ORDER.indexOf(level);
        set({
            progress: {
                currentLevel: level,
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

        await supabase.from('user_progress').upsert({
            user_id: session.id,
            current_level: level,
            is_placement_done: true,
            updated_at: new Date().toISOString()
        });
    }
}));
