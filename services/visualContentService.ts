import { supabase } from '../lib/supabase';
import { VisualContent } from '../types';

/**
 * Service for handling visual learning module data fetching and uploads.
 */

/**
 * Fetch a randomized discovery feed.
 * @param limit Maximum number of items to return
 */
export async function fetchDiscoveryFeed(limit: number = 50): Promise<VisualContent[]> {
  const { data, error } = await supabase.rpc('get_discovery_feed', { p_limit: limit });
  if (error) {
    console.error('Error fetching discovery feed:', error);
    throw new Error(error.message);
  }
  return data as VisualContent[];
}

/**
 * Get an optimized public URL for a given image path.
 * Leverages Supabase native image transformation.
 * @param path Storage file path
 * @param width Desired width in pixels
 */
export function getOptimizedImageUrl(path: string, width: number): string {
  if (!path) return '';
  // If it's already an external URL (e.g. dummy data), just return it
  if (path.startsWith('http')) return path;

  const { data } = supabase.storage
    .from('visual-content')
    .getPublicUrl(path, {
      transform: {
        width,
        resize: 'contain'
      }
    });
  
  return data.publicUrl;
}

/**
 * Upload a new image to 'visual-content' bucket and insert into 'visual_content' table.
 * Admin only.
 */
export async function uploadVisualContent(file: File, content: Partial<VisualContent>): Promise<VisualContent> {
  const fileExt = file.name.split('.').pop();
  const filePath = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;

  // 1. Upload file
  const { error: uploadError } = await supabase.storage
    .from('visual-content')
    .upload(filePath, file);

  if (uploadError) {
    console.error('Storage upload error:', uploadError);
    throw new Error(uploadError.message);
  }

  // 2. Insert record
  const { data, error: insertError } = await supabase
    .from('visual_content')
    .insert([{
      image_url: filePath,
      category: content.category,
      caption: content.caption || null,
      access_level: content.access_level || 'free',
      metadata: content.metadata || {}
    }])
    .select()
    .single();

  if (insertError) {
    console.error('Database insert error:', insertError);
    // Cleanup storage if db fails
    await supabase.storage.from('visual-content').remove([filePath]);
    throw new Error(insertError.message);
  }

  return data as VisualContent;
}

/**
 * Simple client-side answer check for "Complete the Sentence".
 */
export function checkAnswer(userAnswer: string, expectedAnswer?: string): boolean {
  if (!expectedAnswer) return false;
  const cleanUser = userAnswer.trim().toLowerCase().replace(/[.,!?]/g, '');
  const cleanExpected = expectedAnswer.trim().toLowerCase().replace(/[.,!?]/g, '');
  
  // Basic substring inclusion log (e.g. user typed "running" for expected "is running")
  // Or direct match for safety. Let's do a direct match but allow basic variations if both words are present.
  return cleanUser === cleanExpected || cleanExpected.includes(cleanUser) || cleanUser.includes(cleanExpected);
}
