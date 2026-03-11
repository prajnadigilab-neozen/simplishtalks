import { supabase } from '../lib/supabase';

export interface SystemConfig {
    id: number;
    universal_free_seconds: number;
    cost_per_minute: number;
    price_talks: number;
    price_snehi: number;
    updated_at: string;
    updated_by: string | null;
}

export async function getSystemConfig(): Promise<SystemConfig | null> {
    try {
        const { data, error } = await supabase
            .from('system_config')
            .select('*')
            .eq('id', 1)
            .maybeSingle();

        if (error) throw error;
        return data as SystemConfig;
    } catch (e) {
        console.error('Error fetching system config:', e);
        return null;
    }
}

export async function updateSystemConfig(updates: Partial<SystemConfig>, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('system_config')
            .upsert({ id: 1, ...updates, updated_by: userId, updated_at: new Date().toISOString() });

        if (error) throw error;
        return { success: true };
    } catch (e: any) {
        console.error('Error updating system config:', e);
        return { success: false, error: e.message };
    }
}
