import { db } from '../lib/db';
import { supabase } from '../lib/supabase';

export async function syncDown() {
    if (!navigator.onLine) return; // Only sync when online

    console.log("⬇️ Starting Sync Down...");
    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;

        const [modulesRes, lessonsRes] = await Promise.all([
            supabase.from('modules').select('*'),
            supabase.from('lessons').select('*')
        ]);

        if (modulesRes.data) {
            await db.modules.bulkPut(modulesRes.data);
        }
        if (lessonsRes.data) {
            await db.lessons.bulkPut(lessonsRes.data);
        }

        if (userId) {
            const { data: progress } = await supabase.from('user_progress').select('*').eq('user_id', userId).single();
            if (progress) {
                const localProg = await db.user_progress.get(userId);
                // Resolve conflict: prioritize latest updated_at
                const remoteTime = progress.updated_at ? new Date(progress.updated_at).getTime() : 0;
                const localTime = localProg?.updated_at ? new Date(localProg.updated_at).getTime() : 0;

                if (!localProg || remoteTime >= localTime) {
                    await db.user_progress.put(progress);
                }
            }
        }
        console.log("✅ Sync Down Complete.");
    } catch (error) {
        console.error("❌ Sync down error:", error);
    }
}

export async function syncUp() {
    if (!navigator.onLine) return;

    const queue = await db.sync_queue.orderBy('created_at').toArray();
    if (queue.length === 0) return;

    console.log(`⬆️ Starting Sync Up... (${queue.length} items)`);

    for (const item of queue) {
        try {
            if (item.action === 'UPSERT_PROGRESS') {
                const { error } = await supabase.from('user_progress').upsert(item.payload, { onConflict: 'user_id' });
                if (error) throw error;
            } else if (item.action === 'UPSERT_MODULE') {
                const { error } = await supabase.from('modules').upsert(item.payload, { onConflict: 'id' });
                if (error) throw error;
            } else if (item.action === 'DELETE_MODULE') {
                const { error } = await supabase.from('modules').delete().eq('id', item.payload);
                if (error) throw error;
            } else if (item.action === 'UPSERT_LESSON') {
                const { error } = await supabase.from('lessons').upsert(item.payload, { onConflict: 'id' });
                if (error) throw error;
            } else if (item.action === 'DELETE_LESSON') {
                const { error } = await supabase.from('lessons').delete().eq('id', item.payload);
                if (error) throw error;
            }

            // If success, remove from queue
            if (item.id) {
                await db.sync_queue.delete(item.id);
            }
        } catch (err) {
            console.error(`❌ Failed to sync item ${item.id}:`, err);
            // Stop syncing to keep chronological ordering intact for dependent mutations
            break;
        }
    }
    console.log("✅ Sync Up Complete.");
}

export function initSyncAndListen() {
    // Sync immediately
    syncUp().then(() => syncDown());

    // Listen for online events
    const handleOnline = () => {
        syncUp().then(() => syncDown());
    };

    window.addEventListener('online', handleOnline);

    return () => {
        window.removeEventListener('online', handleOnline);
    };
}
