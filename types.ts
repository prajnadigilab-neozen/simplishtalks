
export type Language = 'en' | 'kn';

/** V 1.0 */
export enum UserRole {
  STUDENT = 'STUDENT',
  MODERATOR = 'MODERATOR',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export enum LevelStatus {
  LOCKED = 'LOCKED',
  AVAILABLE = 'AVAILABLE',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED'
}

export enum PackageType {
  NONE = 'NONE',
  TALKS = 'TALKS',
  SNEHI = 'SNEHI',
  BOTH = 'BOTH'
}

export enum PackageStatus {
  INACTIVE = 'INACTIVE',
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED'
}

export enum CourseLevel {
  BASIC = 'BASIC',
  INTERMEDIATE = 'INTERMEDIATE',
  ADVANCED = 'ADVANCED',
  EXPERT = 'EXPERT'
}

export interface Lesson {
  id: string;
  title: Record<Language, string>;
  videoUrl?: string;      // Watch/Listen: video
  audioUrl?: string;      // Watch/Listen: audio
  pdfUrl?: string;        // Study: PDF file
  textUrl?: string;       // Study: text file
  textContent?: string;   // Long-form text content
  studyTextContent?: string; // Generated study content
  speakPdfUrl?: string;   // SPEAK: PDF file for reading practice
  speakTextUrl?: string;  // SPEAK: text file for reading practice
  speakTextContent?: string; // Generated speak content
  notes: Record<Language, string>;
  isCompleted: boolean;
  scenario?: {
    character: Record<Language, string>;
    objective: Record<Language, string>;
    systemInstruction: string;
    initialMessage: string;
  };
  order_index: number;
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
  packageType?: PackageType;
  packageStatus?: PackageStatus;
  packageStartDate?: string | null;
  packageEndDate?: string | null;
  agentCredits?: number | null;
  streakCount?: number;
  lastStreakDate?: string | null;
  totalMessagesSent?: number;
  totalTalkTime?: number;
  voiceGender?: 'MAN' | 'WOMAN';
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
  audioUrl?: string; // Link to recorded audio
  audioEn?: string; // Pre-fetched audio for main reply
  audioTip?: string; // Pre-fetched audio for pronunciation tip
}
