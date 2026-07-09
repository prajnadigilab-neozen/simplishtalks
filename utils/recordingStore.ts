
/**
 * IndexedDB-backed recording store for AudioRecorder.
 * Replaces localStorage to avoid the 5MB hard limit.
 * Stores native Blob objects — no base64 overhead.
 */

export interface SavedRecording {
    id: string;
    timestamp: number;
    blob: Blob;
    lessonId?: string;
}

const DB_NAME = 'simplish-recordings';
const STORE_NAME = 'recordings';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
            const db = (e.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                store.createIndex('timestamp', 'timestamp');
                store.createIndex('lessonId', 'lessonId');
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function saveRecording(recording: SavedRecording): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(recording);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function getAllRecordings(lessonId?: string): Promise<SavedRecording[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).index('timestamp').getAll();
        req.onsuccess = () => {
            const all: SavedRecording[] = req.result;
            // Sort newest first
            all.sort((a, b) => b.timestamp - a.timestamp);
            resolve(lessonId ? all.filter(r => r.lessonId === lessonId) : all);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function deleteRecording(id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** Keep at most `maxCount` recordings, delete older ones automatically */
export async function pruneOldRecordings(maxCount = 20): Promise<void> {
    const all = await getAllRecordings();
    if (all.length <= maxCount) return;

    const toDelete = all.slice(maxCount); // already sorted newest-first
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    for (const rec of toDelete) {
        tx.objectStore(STORE_NAME).delete(rec.id);
    }
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

/** One-time migration from localStorage to IndexedDB */
export async function migrateFromLocalStorage(): Promise<void> {
    const raw = localStorage.getItem('simplish-saved-recordings');
    if (!raw) return;

    try {
        const parsed = JSON.parse(raw) as Array<{
            id: string;
            timestamp: number;
            dataUrl: string;
            lessonId?: string;
        }>;

        for (const rec of parsed) {
            try {
                const res = await fetch(rec.dataUrl);
                const blob = await res.blob();
                await saveRecording({
                    id: rec.id,
                    timestamp: rec.timestamp,
                    blob,
                    lessonId: rec.lessonId,
                });
            } catch (e) {
                console.warn('Failed to migrate recording:', rec.id, e);
            }
        }

        localStorage.removeItem('simplish-saved-recordings');
        console.log('✅ Recordings migrated from localStorage to IndexedDB.');
    } catch (e) {
        console.error('Migration parse error:', e);
    }
}

/** Clear all recordings from IndexedDB */
export async function clearAllRecordings(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => {
            console.log('✅ All local recordings cleared.');
            resolve();
        };
        tx.onerror = () => reject(tx.error);
    });
}
