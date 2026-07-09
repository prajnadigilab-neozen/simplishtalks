import Dexie, { Table } from 'dexie';
import { Module, Lesson, CourseLevel, UserRole } from '../types';

export interface LocalUserProgress {
    user_id: string;
    current_level: string;
    completed_lessons: string[];
    is_placement_done: boolean;
    updated_at?: string;
}

export interface SyncQueueItem {
    id?: number;
    action: 'UPSERT_PROGRESS' | 'UPSERT_MODULE' | 'DELETE_MODULE' | 'UPSERT_LESSON' | 'DELETE_LESSON';
    payload: any;
    created_at: number;
}

export class SimplishDB extends Dexie {
    // Mirroring Supabase structure generally, but optimized for local reads
    modules!: Table<any, string>;
    lessons!: Table<any, string>;
    user_progress!: Table<LocalUserProgress, string>;
    snehi_scenarios!: Table<any, string>;
    user_custom_scenarios!: Table<any, string>;
    sync_queue!: Table<SyncQueueItem, number>;

    constructor() {
        super('SimplishTalksDB');
        this.version(2).stores({
            modules: 'id, level, order_index',
            lessons: 'id, module_id, order_index',
            user_progress: 'user_id',
            snehi_scenarios: 'id, level, order_index',
            user_custom_scenarios: 'id, user_id, level',
            sync_queue: '++id, action, created_at'
        });
    }
}

export const db = new SimplishDB();
