# Master Prompt: Recreate "SIMPLISH Talks" - Bilingual AI Learning Platform

**Role**: Senior Full-Stack Architect & AI System Designer.
**Objective**: Recreate a production-ready, mobile-first, and rural-optimized English learning platform for Kannada speakers. The system must prioritize low data usage, offline-first reliability, and strict AI budget governance.

---

## 1. Core Architecture & Tech Stack
- **Frontend**: React (Vite + TypeScript) with Tailwind CSS.
- **Styling**: Premium Glassmorphism UI, Dark/Light mode support, curated HSL color palette (Blue-900 / Amber-400 / Slate).
- **State Management**: Zustand (Global Store) for session, progress, and course modules.
- **Local Database**: Dexie.js (IndexedDB) for offline progress tracking and a persistent sync queue.
- **Backend/Auth**: Supabase (PostgreSQL, Auth, Edge Functions).
- **Icons & Charts**: Lucide-React, Recharts.

---

## 2. Database Schema (Supabase & local DB)
### Table: `profiles`
- `id` (UUID, PK), `phone`, `full_name`, `place`, `role` (student/admin/moderator), `avatar_url`, `created_at`.

### Table: `modules`
- `id` (UUID), `title`, `description`, `level` (BASIC, INTERMEDIATE, ADVANCED, EXPERT), `order_index`.

### Table: `lessons`
- `id` (UUID), `module_id` (FK), `title`, `content` (JSON), `type` (text/voice/quiz), `order_index`.

### Table: `user_progress`
- `user_id` (UUID, PK), `current_level`, `completed_lessons` (Array of UUIDs), `is_placement_done` (Boolean), `updated_at`.

### Table: `api_usage` (For Analytics)
- `id`, `user_id`, `api_type` (chat/voice), `model_id`, `total_units` (tokens/seconds), `created_at`.

---

## 3. Product Packages & Subscription Models
Users can opt for one of two distinct packages, each with its own UI and logic:

### Package 1: SIMPLISH - TALKS
- **Core Features**: 
    - **Course Path**: Gated 4-tier roadmap (Basic to Expert).
    - **Bilingual Chat**: Interactive text/speech chat for conceptual learning.
- **Pricing**: One-time purchase with fixed Start and End dates.
- **UI Constraints**: "Voice Practice" (Agent) is HIDDEN. Focus is on structured topics and level locks.
- **Analytics**: Displays usage, chat message history, engagement statistics, and daily streaks.

### Package 2: SIMPLISH - Agent
- **Core Features**:
    - **Voice Practice**: Direct role-based persona conversations (Speak with AI directly).
    - **AI Persona**: Visual representation of the AI persona during the call.
- **Pricing**: Prepaid credits based on time (e.g., ₹50 for 10 minutes).
- **UI Constraints**: Direct route to "Voice Practice". No structured course path.
- **Analytics**: Displays credit balance, time used, voice chat recordings, talk-time statistics, and streaks.

---

## 4. User Workflow (The "Conversion Funnel")
1. **Registration**: User signs up.
2. **AI Evaluation Test**: Mandatory diagnostic test to assess current proficiency.
3. **Smart Suggestion**: 
    - AI analyzes test results and **recommends** a package (TALKS for structured learning, AGENT for conversation fluency).
    - User is redirected to a "Package Selection" screen in the dashboard.
4. **Conditional UI**: Once a package is chosen/purchased, the user is redirected to the respective interface (Talks Dashboard or Agent Practice).

---

## 5. Dashboard & Progress Tracking
- **Universal Settings**: Manage profile, language, and theme.
- **Global Progress Bar**: Shows overall learning journey status.
- **Modular Dashboard Views**:
    - **TALKS View**: Topic list, Level status (Locked/Unlocked), Streak calendar, Chat stats.
    - **AGENT View**: Remaining minutes (Circular credit bar), Usage history, Voice recording archive, Talk-time stats.

---

## 6. AI Governance (The "Guardrail" System)
### Quota Middleware
Implement a `QuotaMiddleware.ts` that enforces:
- **Rate Limits**: 10 RPM (Requests Per Minute), 250K TPM (Tokens Per Minute).
- **Daily Caps**: 250-1000 RPD (Requests Per Day) depending on model.
- **Reset Logic**: Automatic reset at Midnight Pacific Time (1:30 PM IST).
- **Context Caching**: Simulate 90% token reduction for repetitive system instructions.

### Billing Circuit Breaker
- Implement a `billingService.ts` to monitor Google Cloud promotional credits.
- **Credit Cap**: $10.00.
- **Circuit Breaker**: If credit hits $0, all non-mock API calls must be paused automatically.

---

## 7. UI/UX for Rural & Minimal Devices
- **Optimization**: Use SVGs instead of heavy images. Lazy-load all major pages.
- **Layout**: High-contrast Bottom Navigation bar. Simple, large touch targets.
- **Vibration/Tactile**: (Optional) Feedback on button clicks for better UX on older touchscreens.

---

## 8. Exclusive AI Agent Instructions (System Prompt)
"You are the SIMPLISH AI Architect. 
**Your Task**: Recreate the system with the two-tier package logic. 
**Sales Persona**: After the evaluation test, generate a persuasive summary explaining WHY the user should pick 'SIMPLISH - TALKS' (for foundation) or 'SIMPLISH - Agent' (for fluency) based on their score.

**Operational Guardrails**: 
- If User chooses 'Agent' and credit is ₹0, block the Mic and show a 'Recharge' prompt.
- If User chooses 'Talks' and the sub has expired, lock the 'Next Topic' buttons.
- Always translate complex English idoms into Kannada equivalents."

---

## 9. Implementation Roadmap
1. **Initialize**: React + Vite + TypeScript shell.
2. **Logic Layer**: Setup Package-state in Zustand (Subscription status, Credit balance).
3. **Route Guarding**: Conditional redirection based on `user.subscription_type`.
4. **Middleware**: Build QuotaMiddleware and BillingService.
5. **Dashboard**: Implement the two distinct views (Talks vs Agent).
6. **Polish**: Mobile-first CSS and Bilingual Language Provider.

---

## 10. Core Functionalities & User Flow (Navigation Map)

## 10. Core Functionalities & User Flow (Navigation Map)

### 10.1. Public & Onboarding Flow
- **`/` (Landing Page)**: 
  - **Theme**: High-impact modern rural-focused design. Clear value propositions for English fluency.
  - **Content**: Hero section, "Why Simplish?", testamonials, and package introduction (TALKS vs Agent).
  - **Toggle**: Prominent Day/Night (Light/Dark mode) toggle instruction for accessibility.
- **`/register` & `/login`**: 
  - **Process**: Phone OTP or Email Magic Link (Supabase Auth). 
  - **Role Assignment**: All new sign-ups default to `STUDENT`.
- **`/placement` (AI Evaluation)**: Mandatory diagnostic test for new sign-ups. Uses AI to assess proficiency and recommends a package (Talks vs Agent). Redirects to Dashboard upon completion.

### 10.2. Student Modules & Learning Paths (The Study Area)
- **Design & Navigation**: Distraction-free, card-based UI. Bottom navigation for mobile (`Path`, `Voice`, `Chat`, `Settings`) and sticky top navbar for desktop. Clean typography with subtle glassmorphism.
- **`/dashboard` (Learning Path)**:
  - **TALKS Package**: Displays modular paths (Levels -> Modules -> Lessons). Locked topics require progression. Global streak tracking and overall progress.
  - **AGENT Package**: Direct access to remaining voice minutes and usage history. No structured UI clutter.
- **`/lesson/:id` (Lesson View)**: Specific learning content (Text, Quiz, or Voice nodes). Fetches JSON structure and renders interactive UI elements.
- **`/coachchat` (Bilingual AI Chat)**: Text-based virtual assistant explaining concepts in both Kannada and English.
- **`/talk` (Voice Practice Agent)**: Real-time audio interaction with the AI persona. Tracks talk-time against user's prepaid credits/time limit via `billingService`.
- **`/settings` (User Configuration)**: Update profile, switch language (En/Kn context toggle), toggle Theme (Day/Night mode manually), and secure Sign Out.

### 10.3. Super Admin & Moderator Flow (Role-Based Access)
Roles are managed via Supabase `profiles.role` (`SUPER_ADMIN`, `MODERATOR`, `STUDENT`). 
- **`/admin` (SUPER ADMIN Dashboard)**:
  - **High-level Metrics**: Total active users, revenue metrics, and API cost tracking.
  - **User Management**: Ability to assign roles (upgrade a `STUDENT` to `MODERATOR`), ban users, or manually adjust credits/subscriptions.
  - **Report Generation Logic**: Exportable CSV/PDF reports for user engagement, module completion rates, and AI quota utilization.
- **`/admin/course` (Course Content Generation & Management)**: 
  - Full CRUD capabilities for Levels, Modules, and Lessons. 
  - Updates `order_index` logic to reorganize the learning path.
  - **Module Upload Design**: Clean form with title, description, and level tagging. Support for drag-and-drop reordering.
  - **Lesson Upload Design (File Uploads)**: Support for rich media. Ability to upload external files (`.pdf` reading materials, `.mp3`/`.wav` audio pronunciations, `.mp4` video snippets) attached to specific lessons. Uses Supabase Storage buckets (`lesson_media`).
- **`/admin/ai-instructions` (Prompt Engineering & AI Rules)**: 
  - **AI LLM Engine Selection**: Dropdown to hot-swap between Gemini Pro (Default text), Gemini Flash (Fast responses), or OpenAI/Anthropic models if integrated.
  - **System Instructions**: Interface to define rules for scenario generation, role-playing personas (e.g., "Angry Customer", "Helpful Teacher"), and strict translation guidelines.
- **`/analytics` (API Usage & Cost Tracker)**: Tracks token usage, tracks requests per minute (RPM/TPM), and visualizes cost distributions via `api_usage` table.
- **`/quota` (Guardrail & Billing Dashboard)**: Live monitoring of GCP Cloud Billing limits and Quota Middleware. Can pause AI access if the $10 credit cap is hit.
- **`/admin/telemetry` (System Logs)**: Detailed debugging logs from the PWA, `telemetryService`, and offline `syncService`.

---

## 11. Navigation Architecture & UI Instructions
- **Day/Night Toggle**: Implement a robust context provider for Theme (`dark`, `light`). Ensure text contrast passes WCAG AA standards in both modes. Use Tailwind `dark:` variants extensively.
- **Desktop/Tablet Navbar**: Sticky top navigation with context-aware buttons. Displays `Admin` tabs for moderators/super admins, and `Dashboard` for students. Includes quick toggles for Theme and Bilingual Mode.
- **Mobile Bottom Navigation**: High-contrast, touch-optimized tab bar for core student features. Disappears automatically on Admin views and Lesson Views to maximize screen real estate.
- **File Upload UI (Admin)**: Dropzone components for PDFs and Media with upload progress bars, file size validation (e.g., max 50MB for video), and preview capabilities before saving.
