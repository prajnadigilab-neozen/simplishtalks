
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
    // Optimized: Fetching modules and lessons in a single query using joins
    const query = Promise.resolve(
      supabase
        .from('modules')
        .select('*, lessons(*)')
        .order('order_index', { ascending: true })
    );

    const { data: modulesData, error: modulesError } = await withTimeout(query, 15000).catch(e => {
      console.warn('Modules fetch timed out or failed, using static content:', e.message);
      return { data: null, error: e };
    });

    // Any error (including timeout) → fall back to static content
    if (modulesError) {
      console.error("🔴 DATABASE FETCH ERROR. Falling back to static content.", modulesError);
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
          textContent: l.text_content,
          notes: l.notes,
          scenario: l.scenario,
          isCompleted: false
        }))
    }));
  } catch (error) {
    console.error("Fetch Modules Error:", error);
    return INITIAL_MODULES as Module[];
  }
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
  text_content?: string,
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
    text_content: rest.text_content || null,
    scenario: rest.scenario || null,
    order_index: rest.order_index
  };

  if (id) {
    return await supabase.from('lessons').update(payload).eq('id', id);
  } else {
    return await supabase.from('lessons').insert([payload]);
  }
}

export async function deleteLesson(id: string) {
  return await supabase.from('lessons').delete().eq('id', id);
}

/**
 * Uploads a file to Supabase Storage and returns the public URL.
 * @param file The file object from input[type="file"]
 * @param path The folder/filename in the bucket (e.g. "lessons/video_1.mp4")
 */
export async function uploadLessonMedia(file: File, path: string): Promise<{ url?: string, error?: any }> {
  try {
    const bucketName = 'course-media';

    // 1. Upload the file
    const { data, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(path, file, {
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) throw uploadError;

    // 2. Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(data.path);

    return { url: publicUrl };
  } catch (error) {
    console.error("Upload error:", error);
    return { error };
  }
}

