
import { supabase } from '../lib/supabase';
import { CourseLevel, Module, Lesson, LevelStatus } from '../types';
import { INITIAL_MODULES } from '../constants';

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
    const { data: modulesData, error: modulesError } = await supabase
      .from('modules')
      .select('*, lessons(*)')
      .order('order_index', { ascending: true });

    if (modulesError) {
      if (modulesError.code === 'PGRST205' || modulesError.message.includes('not found')) {
        console.warn("Database tables not found. Falling back to static content.");
        return INITIAL_MODULES as Module[];
      }
      throw modulesError;
    }

    if (!modulesData || modulesData.length === 0) {
      return INITIAL_MODULES as Module[];
    }

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
