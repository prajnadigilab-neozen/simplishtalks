
export type Language = 'en' | 'kn';

export enum UserRole {
  USER = 'USER',
  ADMIN = 'ADMIN'
}

export enum LevelStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum CourseLevel {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

// Added audioUrl and textContent to match database schema and usage in LessonView.tsx
export interface Lesson {
  id: string;
  title: Record<Language, string>;
  videoUrl?: string;
  audioUrl?: string; // Optional URL for audio-only lessons
  pdfUrl?: string; // Optional URL for PDF notes
  textContent?: string; // Optional long-form text content for the lesson
  notes: Record<Language, string>;
  isCompleted: boolean;
  scenario?: {
    character: Record<Language, string>;
    objective: Record<Language, string>;
    systemInstruction: string;
    initialMessage: string;
  };
}

export interface Module {
  id?: string;
  level: CourseLevel;
  title: Record<Language, string>;
  description: Record<Language, string>;
  lessons: Lesson[];
  status: LevelStatus;
}

export interface UserProgress {
  currentLevel: CourseLevel;
  completedLessons: string[];
  phoneNumber?: string;
  name?: string;
  role: UserRole;
  isPlacementDone: boolean;
}

export interface TranslationStrings {
  [key: string]: Record<Language, string>;
}

export interface CoachMessage {
  dbId?: string; // Database ID for deletion
  role: 'user' | 'coach';
  text: string;
  correction?: string;
  kannadaGuide?: string;
  pronunciationTip?: string;
  timestamp: number;
  audioEn?: string; // Pre-fetched audio for main reply
  audioTip?: string; // Pre-fetched audio for pronunciation tip
}
