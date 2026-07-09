
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
  EXPERT = 'EXPERT',
  CUSTOM = 'CUSTOM'
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
  englishTextToRead?: string;
  transcriptionToReadKannadaPhonetic?: string;
  transcriptionToReadTransliteration?: string;
  notes: Record<Language, string>;
  isCompleted: boolean;
  scenario?: {
    character: Record<Language, string>;
    objective: Record<Language, string>;
    systemInstruction: string;
    initialMessage: string;
    choice_based_roleplay?: any;
  };
  order_index: number;
}

export interface SnehiScenario {
  id: string;
  title: Record<Language, string>;
  category: Record<Language, string>;
  level: CourseLevel;
  systemInstruction: string;
  initialMessage: string;
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
  prefersTranslation?: boolean;
  prefersPronunciation?: boolean;
  completedScenarios: string[];
  topupAmount?: number;
  snehiAccessEnabled?: boolean;
}

export interface AccessRequest {
  id: string;
  user_id: string;
  request_date: string;
  status: 'PENDING' | 'AWAITING_PMT' | 'REJECTED' | 'ACTIVE' | 'DISABLED' | 'Pending' | 'Approved' | 'Rejected' | 'Disabled';
  approved_by?: string | null;
  approved_date?: string | null;
  remarks?: string | null;
  profiles?: {
    full_name: string;
    phone: string;
  };
  payments?: any[];
}

export interface Payment {
  id: string;
  user_id: string;
  request_id: string;
  base_amount: number;
  tax_amount: number;
  discount_amount: number;
  final_payable_amount: number;
  payment_status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  transaction_id?: string;
  payment_gateway?: 'RAZORPAY' | 'PHONEPE' | 'STRIPE';
  created_at: string;
}

export interface InAppNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export interface TranslationStrings {
  [key: string]: Record<Language, string>;
}

export interface CoachMessage {
  dbId?: string; // Database ID for deletion
  role: 'user' | 'coach';
  text: string;
  suggestion?: string;  // Example phrase the student can try
  correction?: string;
  kannadaGuide?: string;
  pronunciationTip?: string;
  timestamp: number;
  audioUrl?: string; // Link to recorded audio
  audioEn?: string; // Pre-fetched audio for main reply
  audioTip?: string; // Pre-fetched audio for pronunciation tip
}

export interface ScenarioSave {
  id: string;
  user_id: string;
  scenario_id: string;
  chat_history: CoachMessage[];
  audio_url?: string;
  duration_seconds: number;
  created_at: string;
  p_score?: number | null;
  f_score?: number | null;
  c_score?: number | null;
  a_score?: number | null;
  evaluation_feedback?: string | null;
}

export type VisualContentCategory = string;

export type VisualAccessLevel = 'free' | 'premium';

export interface VisualContent {
  id: string;
  image_url: string;
  caption: string | null;
  category: VisualContentCategory;
  access_level: VisualAccessLevel;
  metadata: {
    expected_answer?: string;
    image_description?: string;
    difficulty?: string;
  };
  created_at: string;
}

export interface CourseFeedback {
  id: string;
  user_id: string;
  course_id: string;
  completion_date: string;
  overall_rating: number;
  content_rating: number;
  mentor_rating: number;
  learning_rating: number;
  confidence_improvement: string;
  recommendation_score: number;
  review_text: string;
  success_story?: string | null;
  testimonial_permission: boolean;
  photo_url?: string | null;
  video_url?: string | null;
  audio_url?: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'hidden';
  approved_by?: string | null;
  approved_date?: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  profiles?: {
    full_name: string;
    phone: string;
  };
}

export interface FeedbackAuditLog {
  id: string;
  admin_id: string;
  feedback_id: string;
  action: string;
  original_status?: string | null;
  new_status?: string | null;
  created_at: string;
  profiles?: {
    full_name: string;
  };
}


