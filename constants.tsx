/** V 1.0 */
import { TranslationStrings, Lesson, CourseLevel } from './types';

export const LEVEL_ORDER: CourseLevel[] = [
  CourseLevel.BASIC,
  CourseLevel.INTERMEDIATE,
  CourseLevel.ADVANCED,
  CourseLevel.EXPERT
];

export const TRANSLATIONS: TranslationStrings = {
  appName: { en: 'SIMPLISH - Talks', kn: 'ಸಿಂಪ್ಲಿಷ್ - ಟಾಕ್ಸ್' },
  tagline: { en: 'English for Kannada Speakers', kn: 'ಕನ್ನಡಿಗರಿಗಾಗಿ ಇಂಗ್ಲಿಷ್' },
  startLearning: { en: 'Start Learning', kn: 'ಕಲಿಯಲು ಪ್ರಾರಂಭಿಸಿ' },
  placementTest: { en: 'Placement Test (ಪ್ರವೇಶ ಪರೀಕ್ಷೆ)', kn: 'Placement Test (ಪ್ರವೇಶ ಪರೀಕ್ಷೆ)' },
  dashboard: { en: 'Dashboard', kn: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್' },
  basic: { en: 'Basic', kn: 'ಮೂಲ ಹಂತ' },
  intermediate: { en: 'Intermediate', kn: 'ಮಧ್ಯಂತರ ಹಂತ' },
  advanced: { en: 'Advanced', kn: 'ಸುಧಾರಿತ ಹಂತ' },
  expert: { en: 'Expert', kn: 'ಪರಿಣಿತ ಹಂತ' },
  locked: { en: 'Locked', kn: 'ಲಾಕ್ ಆಗಿದೆ' },
  completeLevelFirst: { en: 'Complete previous level to unlock', kn: 'ಅನ್ಲಾಕ್ ಮಾಡಲು ಹಿಂದಿನ ಹಂತವನ್ನು ಪೂರ್ಣಗೊಳಿಸಿ' },
  voiceNote: { en: 'Record Voice Note', kn: 'ಧ್ವನಿ ರೆಕಾರ್ಡ್ ಮಾಡಿ' },
  uploadNote: { en: 'Upload Photo of Notebook', kn: 'ನೋಟ್‌ಬುಕ್ ಫೋಟೋ ಅಪ್‌ಲೋಡ್ ಮಾಡಿ' },
  submit: { en: 'Submit', kn: 'ಸಲ್ಲಿಸಿ' },
  nextLesson: { en: 'Next Lesson', kn: 'ಮುಂದಿನ ಪಾಠ' },
  back: { en: 'Back', kn: 'ಹಿಂದಕ್ಕೆ' },
  evaluationInProgress: { en: 'AI is evaluating your response...', kn: 'AI ನಿಮ್ಮ ಉತ್ತರವನ್ನು ಮೌಲ್ಯಮಾಪನ ಮಾಡುತ್ತಿದೆ...' },
  liveTalk: { en: 'Live Talk', kn: 'ನೇರ ಸಂಭಾಷಣೆ' },
  talkingAiTitle: { en: 'Speak with AI', kn: 'AI ಜೊತೆ ಮಾತನಾಡಿ' },
  talkingAiDesc: { en: 'Practice real-time English conversation with your AI coach.', kn: 'ನಿಮ್ಮ AI ಕೋಚ್‌ನೊಂದಿಗೆ ನೈಜ-ಸಮಯದ ಇಂಗ್ಲಿಷ್ ಸಂಭಾಷಣೆಯನ್ನು ಅಭ್ಯಾಸ ಮಾಡಿ.' },
  connecting: { en: 'Connecting to Coach...', kn: 'ಕೋಚ್‌ನೊಂದಿಗೆ ಸಂಪರ್ಕಿಸಲಾಗುತ್ತಿದೆ...' },
  stopTalk: { en: 'End Session', kn: 'ಸಂಭಾಷಣೆ ಮುಗಿಸಿ' },
  practice: { en: 'Practice', kn: 'ಅಭ್ಯಾಸ' },
  scenarioTitle: { en: 'Scenario Roleplay', kn: 'ಸನ್ನಿವೇಶದ ಪಾತ್ರಾಭಿನಯ' },
  scenarioDesc: { en: "Use what you learned to complete the conversation objective. It's safe to make mistakes here!", kn: "ಸಂಭಾಷಣೆಯ ಉದ್ದೇಶವನ್ನು ಪೂರ್ಣಗೊಳಿಸಲು ನೀವು ಕಲಿತದ್ದನ್ನು ಬಳಸಿ. ಇಲ್ಲಿ ತಪ್ಪುನ ಮಾಡಲು ಭಯಪಡಬೇಡಿ!" },
};

// Placeholder removed — real content is loaded from Supabase.
// Static fallback modules show no media to avoid broken third-party URLs.

export const INITIAL_MODULES = [
  {
    level: CourseLevel.BASIC,
    title: { en: 'Comfort & Foundations', kn: 'ಮೂಲ ಅಡಿಪಾಯ' },
    description: { en: 'Daily routine, family, and simple present tense.', kn: 'ದೈನಂದಿನ ಚಟುವಟಿಕೆಗಳು ಮತ್ತು ಸರಳ ವರ್ತಮಾನ ಕಾಲ.' },
    lessons: [
      {
        id: 'b1',
        title: { en: 'Introduction to Greetings', kn: 'ಶುಭಾಶಯಗಳ ಪರಿಚಯ' },
        videoUrl: undefined,
        pdfUrl: undefined,
        notes: { en: 'Learn how to say Hello and Hi.', kn: 'ಹಲೋ ಮತ್ತು ಹಾಯ್ ಹೇಳಲು ಕಲಿಯಿರಿ.' },
        isCompleted: false,
        scenario: {
          character: { en: "Neighbor", kn: "ನೆರೆಹೊರೆಯವರು" },
          objective: { en: "Introduce yourself to your new neighbor.", kn: "ನಿಮ್ಮ ಹೊಸ ನೆರೆಹೊರೆಯವರಿಗೆ ನಿಮ್ಮನ್ನು ಪರಿಚಯಿಸಿಕೊಳ್ಳಿ." },
          systemInstruction: "You are a friendly neighbor named Ravi. You just saw the student moving into the house next door. Encourage them to introduce themselves in simple English. Keep your English very simple.",
          initialMessage: "Hello! I saw you moving in today. I'm Ravi, your neighbor. What's your name?"
        }
      },
      { id: 'b2', title: { en: 'Family Members', kn: 'ಕುಟುಂಬದ ಸದಸ್ಯರು' }, notes: { en: 'Names for family members in English.', kn: 'ಕುಟುಂಬದ ಸದಸ್ಯರ ಹೆಸರುಗಳು ಇಂಗ್ಲಿಷ್‌ನಲ್ಲಿ.' }, isCompleted: false },
    ]
  },
  {
    level: CourseLevel.INTERMEDIATE,
    title: { en: 'Conversations', kn: 'ಸಂಭಾಷಣೆಗಳು' },
    description: { en: 'Everyday situations like hospitals or shops.', kn: 'ಆಸ್ಪತ್ರೆ ಅಥವಾ ಅಂಗಡಿಗಳಂತಹ ದೈನಂದಿನ ಸನ್ನಿವೇಶಗಳು.' },
    lessons: [
      {
        id: 'i1',
        title: { en: 'Ordering Food', kn: 'ಆಹಾರ ಆರ್ಡರ್ ಮಾಡುವುದು' },
        notes: { en: 'How to order at a restaurant.', kn: 'ರೆಸ್ಟೋರೆಂಟ್‌ನಲ್ಲಿ ಆರ್ಡರ್ ಮಾಡುವುದು ಹೇಗೆ.' },
        isCompleted: false,
        scenario: {
          character: { en: "Waiter", kn: "ವೈಟರ್" },
          objective: { en: "Order a coffee and a snack at the cafe.", kn: "ಕೆಫೆಯಲ್ಲಿ ಕಾಫಿ ಮತ್ತು ತಿಂಡಿಯನ್ನು ಆರ್ಡರ್ ಮಾಡಿ." },
          systemInstruction: "You are a helpful waiter at 'Simplish Cafe'. The student wants to order something. Be polite and ask them what they would like to have. Use simple English restaurant phrases.",
          initialMessage: "Welcome to Simplish Cafe! Good morning. Are you ready to order?"
        }
      },
    ]
  },
  {
    level: CourseLevel.ADVANCED,
    title: { en: 'Fluency', kn: 'ನಿರರ್ಗಳತೆ' },
    description: { en: 'Complex sentences, modals, and emails.', kn: 'ಸಂಕೀರ್ಣ ವಾಕ್ಯಗಳು ಮತ್ತು ಇಮೇಲ್ ಬರಹ.' },
    lessons: [
      { id: 'a1', title: { en: 'Professional Emails', kn: 'ವೃತ್ತಿಪರ ಇಮೇಲ್‌ಗಳು' }, notes: { en: 'Writing business emails.', kn: 'ವ್ಯಾಪಾರ ಇಮೇಲ್‌ಗಳನ್ನು ಬರೆಯುವುದು.' }, isCompleted: false },
    ]
  },
  {
    level: CourseLevel.EXPERT,
    title: { en: 'Professionalism', kn: 'ವೃತ್ತಿಪರತೆ' },
    description: { en: 'Interviews, presentations, and resumes.', kn: 'ಸಂದರ್ಶನಗಳು ಮತ್ತು ರೆಸ್ಯೂಮ್ ತಯಾರಿಕೆ.' },
    lessons: [
      { id: 'e1', title: { en: 'Cracking Interviews', kn: 'ಸಂದರ್ಶನ ಎದುರಿಸುವುದು' }, notes: { en: 'Common interview questions.', kn: 'ಸಾಮಾನ್ಯ ಸಂದರ್ಶನ ಪ್ರಶ್ನೆಗಳು.' }, isCompleted: false },
    ]
  },
];
