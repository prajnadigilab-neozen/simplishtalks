import { supabase } from '../lib/supabase';

export interface AiInstructions {
    id: number;
    content: string;
    updated_at: string;
    updated_by: string | null;
}

export interface AiInstructionsHistory {
    id: string;
    content: string;
    created_at: string;
    updated_by: string | null;
}

/**
 * Fetches the current AI instructions.
 * If none exist, returns a default string to avoid crashing.
 */
export async function getAiInstructions(): Promise<string> {
    const { data, error } = await supabase
        .from('ai_instructions')
        .select('content')
        .eq('id', 1)
        .single();

    if (error || !data) {
        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching AI instructions:', error);
        }
        return ''; // Return empty or a fallback string if not found
    }

    return data.content;
}

/**
 * Updates the AI instructions and saves the previous version to history.
 */
export async function updateAiInstructions(newContent: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        // 1. Fetch current instructions
        const { data: current, error: fetchError } = await supabase
            .from('ai_instructions')
            .select('content')
            .eq('id', 1)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

        // 2. If there are current instructions, save them to history
        if (current?.content) {
            const { error: histError } = await supabase
                .from('ai_instructions_history')
                .insert([{ content: current.content, updated_by: userId }]);
            if (histError) throw histError;
        }

        // 3. Upsert the new instructions
        const { error: upsertError } = await supabase
            .from('ai_instructions')
            .upsert({ id: 1, content: newContent, updated_by: userId }, { onConflict: 'id' });

        if (upsertError) throw upsertError;

        return { success: true };
    } catch (e: any) {
        console.error('Error updating AI instructions:', e);
        return { success: false, error: e.message };
    }
}
