---
name: SIMPLISH Talks Agent
description: Core instructions and context for AI agents working on the SIMPLISH Talks English-for-Kannada platform.
---

# Project Context: SIMPLISH Talks
SIMPLISH Talks is a bilingual (English-Kannada) language learning platform designed for native Kannada speakers to learn English through interactive AI coaching, multimedia lessons, and scenario-based practice.

## Core Technology Stack
- **Frontend**: React (TSX), Vite, Tailwind CSS.
- **State Management**: Zustand (`useAppStore.ts`).
- **Backend / DB**: Supabase (Auth, RLS, Storage, Postgres).
- **AI Engine**: Google Gemini (via `@google/generative-ai` or direct API).

## Role Hierarchy (RBAC)
The project uses a three-tier role system:
1. **STUDENT**: Learner access. Can use AI Coach and view assigned lessons.
2. **MODERATOR**: Content management focus. Can edit lessons, modules, and view student audit logs.
3. **SUPER_ADMIN**: Full system control. Can manage moderators, AI configuration, and platform-wide settings.

## Critical Files
- [AdminDashboard.tsx](file:///d:/AI/AI%20Website/simplishtalks/pages/AdminDashboard.tsx): Main admin interface.
- [authService.ts](file:///d:/AI/AI%20Website/simplishtalks/services/authService.ts): Role mapping and session handling.
- [coachService.ts](file:///d:/AI/AI%20Website/simplishtalks/services/coachService.ts): AI chat persistence and audit logic.
- [schema.sql](file:///d:/AI/AI%20Website/simplishtalks/schema.sql): Database structure.

## Quality Standards
- **Bilingualism**: Every user-facing string must support both English and Kannada, usually via `TranslationStrings` objects.
- **Micro-Animations**: Use Framer Motion or Tailwind `animate-*` classes for a premium feel.
- **Safety**: Always check for RLS compatibility when writing SQL. Use the `check_is_admin()` RPC for role-based security.
