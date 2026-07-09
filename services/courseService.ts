
import { supabase } from '../lib/supabase';
import { CourseLevel, Module, Lesson, LevelStatus } from '../types';
import { INITIAL_MODULES } from '../constants';
import { db } from '../lib/db';
import { syncUp } from './syncService';

/** Wraps a promise with a timeout, falling back on rejection. */
function withTimeout<T>(promise: Promise<T>, ms = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
    )
  ]);
}

/** Retries a function on failure with exponential backoff. */
async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === retries) throw e;
      const delay = 1000 * (i + 1); // 1s, then 2s
      console.warn(`Retry ${i + 1}/${retries} after ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw new Error('All retries failed');
}

// Helper to split "English | Kannada" strings
export function splitBilingual(input: any): { en: string, kn: string } {
  if (!input) return { en: '', kn: '' };
  // If it's already an object (JSONB from Supabase), return it
  if (typeof input === 'object' && input.en !== undefined) {
    return { en: input.en || '', kn: input.kn || '' };
  }
  // Otherwise split the string
  const str = String(input);
  if (!str.includes('|')) return { en: str.trim(), kn: str.trim() };
  const parts = str.split('|');
  return {
    en: parts[0].trim(),
    kn: parts[1].trim()
  };
}

export async function fetchAllModules(): Promise<Module[]> {
  try {
    let localModules = await db.modules.orderBy('order_index').toArray();
    let localLessons = await db.lessons.orderBy('order_index').toArray();

    // Force cache re-hydration if old mismatched data or old wedding scenario structure exists
    const testLesson = localLessons.find(l => l.id === '57af267a-1458-4ba5-8c77-135bc1c4f8e4');
    const weddingLesson = localLessons.find(l => l.id === 'dafe5df5-f8c7-4a9d-9b1d-31a06242d913');
    const formalInterviewLesson = localLessons.find(l => l.id === 'ae1b4cdb-6e36-4211-be4c-aa56b1e7c8a3');
    
    let needsCacheBust = false;
    if (testLesson && testLesson.scenario && typeof testLesson.scenario === 'object') {
      const objStr = testLesson.scenario.objectiveStr || testLesson.scenario.objective?.en || '';
      if (objStr.includes('clinic')) needsCacheBust = true;
    }
    if (weddingLesson && (
      !weddingLesson.scenario || 
      !weddingLesson.scenario.choice_based_roleplay || 
      !weddingLesson.studyTextContent || 
      !weddingLesson.studyTextContent.includes('Hospitality')
    )) {
      needsCacheBust = true;
    }
    if (formalInterviewLesson && (
      !formalInterviewLesson.scenario ||
      !formalInterviewLesson.scenario.choice_based_roleplay ||
      !formalInterviewLesson.transcriptionToReadKannadaPhonetic
    )) {
      needsCacheBust = true;
    }

    if (needsCacheBust) {
      console.log("♻️ Old cache or mismatched scenarios detected. Clearing local cache to re-hydrate from Supabase...");
      await db.modules.clear();
      await db.lessons.clear();
      localModules = [];
      localLessons = [];
    }

    // Hydrate local cache if empty and online
    if (localModules.length === 0 && typeof navigator !== 'undefined' && navigator.onLine) {
      console.log("⬇️ Local DB empty. Fetching modules from Supabase...");
      const modulesQuery = supabase.from('modules').select('*, lessons(*)').order('order_index', { ascending: true });
      const { data: modulesData, error } = await modulesQuery;

      if (!error && modulesData && modulesData.length > 0) {
        const flatModules = modulesData.map(m => {
          const { lessons, ...rest } = m;
          return rest;
        });
        const flatLessons = modulesData.flatMap(m => m.lessons || []);

        await db.modules.bulkPut(flatModules);
        await db.lessons.bulkPut(flatLessons);

        localModules = await db.modules.orderBy('order_index').toArray();
        localLessons = await db.lessons.orderBy('order_index').toArray();
        console.log("✅ Local DB hydrated with fresh modules.");
      }
    }

    if (localModules.length === 0) {
      console.warn("⚠️ No modules found in local DB or Supabase. Seeding local DB from INITIAL_MODULES fallback...");
      try {
        const getDeterministicModuleId = (lvl: CourseLevel) => {
          switch (lvl) {
            case CourseLevel.BASIC: return '11111111-1111-1111-1111-111111111111';
            case CourseLevel.INTERMEDIATE: return '22222222-2222-2222-2222-222222222222';
            case CourseLevel.ADVANCED: return '33333333-3333-3333-3333-333333333333';
            case CourseLevel.EXPERT: return '44444444-4444-4444-4444-444444444444';
            default: return '00000000-0000-0000-0000-000000000000';
          }
        };

        const flatModules = INITIAL_MODULES.map((m, idx) => {
          const moduleId = getDeterministicModuleId(m.level);
          return {
            id: moduleId,
            level: m.level.toString(),
            title: m.title,
            description: m.description,
            order_index: idx + 1
          };
        });

        const flatLessons = INITIAL_MODULES.flatMap(m => {
          const moduleId = getDeterministicModuleId(m.level);
          return (m.lessons || []).map(l => ({
            id: l.id,
            module_id: moduleId,
            title: l.title,
            video_url: l.videoUrl || '',
            audio_url: l.audioUrl || '',
            pdf_url: l.pdfUrl || '',
            text_url: l.textUrl || '',
            text_content: l.textContent || '',
            study_text_content: l.studyTextContent || '',
            speak_pdf_url: l.speakPdfUrl || '',
            speak_text_url: l.speakTextUrl || '',
            scenario: l.scenario || null,
            order_index: l.orderIndex || 0,
            has_voice_coach: l.hasVoiceCoach || false,
            voice_prompt: l.voicePrompt || '',
            character_name: l.characterName || '',
            character_avatar: l.characterAvatar || '',
            character_gender: l.characterGender || 'WOMAN',
            initial_message: l.initialMessage || '',
            transcription_to_read: l.transcriptionToRead || '',
            transcription_to_read_kannada_phonetic: l.transcriptionToReadKannadaPhonetic || '',
            speak_phonetic_en: l.speakPhoneticEn || '',
            speak_phonetic_kn: l.speakPhoneticKn || ''
          }));
        });

        await db.modules.bulkPut(flatModules);
        await db.lessons.bulkPut(flatLessons);

        localModules = await db.modules.orderBy('order_index').toArray();
        localLessons = await db.lessons.orderBy('order_index').toArray();
      } catch (seedErr) {
        console.error("Failed to seed local DB from INITIAL_MODULES:", seedErr);
        return INITIAL_MODULES as any[];
      }
    }

    return localModules.map(m => ({
      id: m.id,
      level: m.level as CourseLevel,
      title: m.title,
      description: m.description,
      status: LevelStatus.LOCKED,
      lessons: localLessons
        .filter(l => l.module_id === m.id)
        .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
        .map(l => ({
          id: l.id,
          title: l.title,
          videoUrl: l.video_url,
          audioUrl: l.audio_url,
          pdfUrl: l.pdf_url,
          textUrl: l.text_url,
          textContent: l.text_content,
          studyTextContent: l.study_text_content,
          speakPdfUrl: l.speak_pdf_url,
          speakTextUrl: l.speak_text_url,
          speakTextContent: l.speak_text_content,
          englishTextToRead: l.english_text_to_read,
          transcriptionToReadKannadaPhonetic: l.transcription_to_read_kannada_phonetic,
          transcriptionToReadTransliteration: l.transcription_to_read_transliteration,
          notes: l.notes,
          scenario: l.scenario,
          isCompleted: false,
          order_index: l.order_index || 0
        }))
    }));
  } catch (error) {
    console.error("Fetch Modules Error:", error);
    return [];
  }
}

export async function saveModule(adminInput: { id?: string, level: string, titleStr: string, descStr: string, order_index: number }) {
  const { id, level, titleStr, descStr, order_index } = adminInput;
  const finalId = id || crypto.randomUUID();

  const payload = {
    id: finalId,
    level,
    title: splitBilingual(titleStr),
    description: splitBilingual(descStr),
    order_index
  };

  await db.modules.put(payload);
  await db.sync_queue.add({ action: 'UPSERT_MODULE', payload, created_at: Date.now() });
  syncUp(); // Fire and forget

  return { data: [payload], error: null };
}

export async function deleteModule(id: string) {
  await db.modules.delete(id);
  await db.sync_queue.add({ action: 'DELETE_MODULE', payload: id, created_at: Date.now() });
  syncUp();
  return { error: null };
}

export async function saveLesson(adminInput: {
  id?: string,
  module_id: string,
  titleStr: string,
  notesStr: string,
  video_url?: string,
  audio_url?: string,
  pdf_url?: string,
  text_url?: string,
  text_content?: string,
  study_text_content?: string,
  speak_pdf_url?: string,
  speak_text_url?: string,
  speak_text_content?: string,
  english_text_to_read?: string,
  transcription_to_read_kannada_phonetic?: string,
  transcription_to_read_transliteration?: string,
  scenario?: any,
  order_index: number
}) {
  const { id, module_id, titleStr, notesStr, ...rest } = adminInput;
  const finalId = id || crypto.randomUUID();

  const payload = {
    id: finalId,
    module_id,
    title: splitBilingual(titleStr),
    notes: splitBilingual(notesStr),
    video_url: rest.video_url || null,
    audio_url: rest.audio_url || null,
    pdf_url: rest.pdf_url || null,
    text_url: rest.text_url || null,
    text_content: rest.text_content || null,
    study_text_content: rest.study_text_content || null,
    speak_pdf_url: rest.speak_pdf_url || null,
    speak_text_url: rest.speak_text_url || null,
    speak_text_content: rest.speak_text_content || null,
    english_text_to_read: rest.english_text_to_read || null,
    transcription_to_read_kannada_phonetic: rest.transcription_to_read_kannada_phonetic || null,
    transcription_to_read_transliteration: rest.transcription_to_read_transliteration || null,
    scenario: rest.scenario || null,
    order_index: rest.order_index
  };

  console.log("📥 Saving Lesson Locally:", payload);

  await db.lessons.put(payload);
  await db.sync_queue.add({ action: 'UPSERT_LESSON', payload, created_at: Date.now() });
  syncUp();

  return { data: [payload], error: null };
}

export async function deleteLesson(id: string) {
  await db.lessons.delete(id);
  await db.sync_queue.add({ action: 'DELETE_LESSON', payload: id, created_at: Date.now() });
  syncUp();
  return { error: null };
}

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 */
export async function uploadLessonMedia(file: File, path: string): Promise<{ url?: string, error?: any }> {
  try {
    const bucketName = 'course-media';
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, { upsert: true, cacheControl: '3600' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return { url: publicUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error };
  }
}

/**
 * Saves a user's audio recording for the SPEAK section.
 */
export async function saveUserRecording(userId: string, lessonId: string, audioBlob: Blob): Promise<{ url?: string, error?: any }> {
  try {
    const fileName = `${userId}/${lessonId}/${Date.now()}.webm`;
    const path = `recordings/${fileName}`;
    const bucketName = 'course-media';

    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, audioBlob, { upsert: true, contentType: 'audio/webm' });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    // Save reference in DB
    const { error: dbError } = await supabase
      .from('user_lesson_recordings')
      .insert([{ user_id: userId, lesson_id: lessonId, audio_url: publicUrl }]);

    if (dbError) throw dbError;

    return { url: publicUrl };
  } catch (error) {
    console.error("Recording save error:", error);
    return { error };
  }
}

/**
 * Fetches all recordings for a user+lesson.
 */
export async function fetchUserRecordings(userId: string, lessonId: string) {
  const { data, error } = await supabase
    .from('user_lesson_recordings')
    .select('*')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Fetch recordings error:", error);
    return [];
  }
  return data || [];
}

/**
 * Fetches global aggregation stats for the Admin Dashboard.
 */
export async function getGlobalStats(): Promise<{ totalUsers: number, activeLearners: number, totalModules: number, totalLessons: number, customScenariosCount: number }> {
  try {
    const [
      { count: usersCount },
      { count: activeCount },
      { count: modulesCount },
      { count: lessonsCount },
      { count: customScenariosCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_progress').select('*', { count: 'exact', head: true }).not('current_level', 'is', null),
      supabase.from('modules').select('*', { count: 'exact', head: true }),
      supabase.from('lessons').select('*', { count: 'exact', head: true }),
      supabase.from('user_custom_scenarios').select('*', { count: 'exact', head: true })
    ]);

    return {
      totalUsers: usersCount || 0,
      activeLearners: activeCount || 0,
      totalModules: modulesCount || 0,
      totalLessons: lessonsCount || 0,
      customScenariosCount: customScenariosCount || 0
    };
  } catch (error) {
    console.error("Global stats error:", error);
    return { totalUsers: 0, activeLearners: 0, totalModules: 0, totalLessons: 0, customScenariosCount: 0 };
  }
}

/**
 * Fetches all custom scenarios created by users for the Admin Dashboard.
 */
export async function getAllCustomScenarios(): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('user_custom_scenarios')
      .select(`
        *,
        profiles (full_name, phone)
      `)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    
    // Map profiles object to creator for the dashboard UI
    return (data || []).map((s: any) => ({
      ...s,
      creator: s.profiles
    }));
  } catch (error) {
    console.error("Fetch custom scenarios error:", error);
    return [];
  }
}
