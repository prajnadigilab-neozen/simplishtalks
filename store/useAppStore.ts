
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
    initialize: () => Promise<void>;
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

    initialize: async () => {
        if (get().initialized) return;

        set({ loading: true });
        console.log("🚀 Starting App Initialization...");

        // Safety timeout: Ensure loading finishes even if promises hang
        const timeout = setTimeout(() => {
            if (get().loading) {
                console.warn("⚠️ Initialization took too long, forcing load completion.");
                set({ loading: false, initialized: true });
            }
        }, 5000);

        try {
            console.log("📡 Fetching session and modules...");
            const [session, modules] = await Promise.all([
                getUserSession().catch(e => { console.error("Session Fetch Error:", e); return null; }),
                fetchAllModules().catch(e => { console.error("Modules Fetch Error:", e); return []; })
            ]);

            console.log("✅ Session and modules received.", { hasSession: !!session, moduleCount: modules?.length });
            set({ session, modules: modules || [], initialized: true });

            if (session?.id) {
                try {
                    console.log("📊 Fetching user progress for:", session.id);
                    const { data, error } = await supabase
                        .from('user_progress')
                        .select('*')
                        .eq('user_id', session.id)
                        .single();

                    if (data && !error) {
                        console.log("✅ Progress fetched.");
                        const completedLessons = data.completed_lessons || [];
                        const currentLevel = (data.current_level as CourseLevel) || CourseLevel.BASIC;

                        const progress: UserProgress = {
                            currentLevel,
                            completedLessons,
                            role: session.role,
                            isPlacementDone: data.is_placement_done
                        };

                        set({ progress });

                        // Efficient module status mapping
                        const currentLevelIndex = LEVEL_ORDER.indexOf(currentLevel);
                        const updatedModules = (modules || []).map(m => {
                            const mLevel = m.level as CourseLevel;
                            const mIndex = LEVEL_ORDER.indexOf(mLevel);
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
                    } else {
                        console.log("ℹ️ No progress found or error fetching progress:", error?.message);
                    }
                } catch (innerErr) {
                    console.error("Progress fetch error:", innerErr);
                }
            } else {
                console.log("ℹ️ No active session, skipping progress fetch.");
            }
        } catch (err) {
            console.error("Critical Store initialization error:", err);
        } finally {
            clearTimeout(timeout);
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

        // 1. Update local state
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

        // 2. Persist to DB
        try {
            await supabase.from('user_progress').upsert({
                user_id: session.id,
                completed_lessons: newCompleted,
                updated_at: new Date().toISOString()
            });

            // 3. Check for level completion
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
            const updatedModules = modules.map(m => {
                if (m.level === currentLevel) return { ...m, status: LevelStatus.COMPLETED };
                return m;
            });
            set({ modules: updatedModules });
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
