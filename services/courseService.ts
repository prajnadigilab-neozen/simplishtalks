
import { supabase } from '../lib/supabase';
import { CourseLevel, Module, Lesson, LevelStatus } from '../types';
import { INITIAL_MODULES } from '../constants';

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
  return withRetry(async () => {
    try {
      const modulesQuery = supabase
        .from('modules')
        .select('*, lessons(*)')
        .order('order_index', { ascending: true });

      // Explicitly cast to any to avoid PostgrestFilterBuilder vs Promise issues
      const { data: modulesData, error: modulesError } = await withTimeout(modulesQuery as any, 15000).catch(e => {
        console.warn("Modules fetch timed out (15s):", e.message);
        return { data: null, error: e };
      }) as { data: any[] | null, error: any };

      if (modulesError || !modulesData) {
        console.error("🔴 DATABASE FETCH ERROR or TIMEOUT:", modulesError);
        return INITIAL_MODULES as Module[];
      }

      if (!modulesData || modulesData.length === 0) {
        console.warn("⚠️ DATABASE EMPTY. Falling back to static content.");
        return INITIAL_MODULES as Module[];
      }

      console.log(`✅ Loaded ${modulesData.length} modules from DB:`, modulesData);

      return modulesData.map(m => ({
        id: m.id,
        level: m.level as CourseLevel,
        title: m.title,
        description: m.description,
        status: LevelStatus.LOCKED,
        lessons: (m.lessons || [])
          .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
          .map((l: any) => ({
            id: l.id,
            title: l.title,
            videoUrl: l.video_url,
            audioUrl: l.audio_url,
            pdfUrl: l.pdf_url,
            textUrl: l.text_url,
            textContent: l.text_content,
            speakPdfUrl: l.speak_pdf_url,
            speakTextUrl: l.speak_text_url,
            notes: l.notes,
            scenario: l.scenario,
            isCompleted: false
          }))
      }));
    } catch (error) {
      console.error("Fetch Modules Error:", error);
      return INITIAL_MODULES as Module[];
    }
  }); // end withRetry
}

export async function saveModule(adminInput: { id?: string, level: string, titleStr: string, descStr: string, order_index: number }) {
  const { id, level, titleStr, descStr, order_index } = adminInput;
  const payload = {
    level,
    title: splitBilingual(titleStr),
    description: splitBilingual(descStr),
    order_index
  };

  if (id) {
    return await supabase.from('modules').update(payload).eq('id', id);
  } else {
    return await supabase.from('modules').insert([payload]);
  }
}

export async function deleteModule(id: string) {
  return await supabase.from('modules').delete().eq('id', id);
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
  speak_pdf_url?: string,
  speak_text_url?: string,
  scenario?: any,
  order_index: number
}) {
  const { id, module_id, titleStr, notesStr, ...rest } = adminInput;
  const payload = {
    module_id,
    title: splitBilingual(titleStr),
    notes: splitBilingual(notesStr),
    video_url: rest.video_url || null,
    audio_url: rest.audio_url || null,
    pdf_url: rest.pdf_url || null,
    text_url: rest.text_url || null,
    text_content: rest.text_content || null,
    speak_pdf_url: rest.speak_pdf_url || null,
    speak_text_url: rest.speak_text_url || null,
    scenario: rest.scenario || null,
    order_index: rest.order_index
  };

  console.log("📤 Payload being sent to Supabase:", payload);

  try {
    if (id) {
      return await supabase.from('lessons').update(payload).eq('id', id);
    } else {
      return await supabase.from('lessons').insert([payload]).select();
    }
  } catch (err) {
    console.error("❌ Exception during Supabase call:", err);
    throw err;
  }
}

export async function deleteLesson(id: string) {
  return await supabase.from('lessons').delete().eq('id', id);
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
export async function getGlobalStats(): Promise<{ totalUsers: number, activeLearners: number, totalModules: number, totalLessons: number }> {
  try {
    const [
      { count: usersCount },
      { count: activeCount },
      { count: modulesCount },
      { count: lessonsCount }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('user_progress').select('*', { count: 'exact', head: true }).not('currentLevel', 'is', null),
      supabase.from('modules').select('*', { count: 'exact', head: true }),
      supabase.from('lessons').select('*', { count: 'exact', head: true })
    ]);

    return {
      totalUsers: usersCount || 0,
      activeLearners: activeCount || 0,
      totalModules: modulesCount || 0,
      totalLessons: lessonsCount || 0
    };
  } catch (error) {
    console.error("Global stats error:", error);
    return { totalUsers: 0, activeLearners: 0, totalModules: 0, totalLessons: 0 };
  }
}
