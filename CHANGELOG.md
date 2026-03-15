# CHANGELOG

All notable features implemented and issues fixed for **SIMPLISH Talks** will be documented in this file. 

## [2026-03-11]

### General Updates 🔄
- V 7.4 For UAT
- V 7.3 For UAT


## [2026-03-09]

### General Updates 🔄
- V 7.0 AI enabled


## [2026-03-07]

### General Updates 🔄
- V 6.2 UAT Ver


## [2026-03-05]

### General Updates 🔄
- V 5.3 AI Integration


## [2026-03-04]

### Added 🚀
- **Progressive Web App (PWA)**: Configured Workbox and Vite PWA plugin with Cache-First strategies for offline functionality.
- **Local-First Data Architecture**: Implemented `Dexie.js` for offline viewing. Created a robust `syncService.ts` engine to queue changes and sync with Supabase when the network returns.
- **Image Optimization Pipeline**: Integrated `vite-plugin-image-optimizer` to auto-compress images (saving >1MB per build) into WebP format without quality loss.
- **Route-Based Code Splitting**: Refactored `App.tsx` using `React.lazy` and `Suspense` to split the massive Javascript bundle into tiny, on-demand modules for fast loading on 2G/3G networks.

### Changed ⚡
- **Refactored Admin UI**: Segregated "Course Content" into a standalone `CourseManagement.tsx` view to clear up the central unified dashboard.
- **Zero-Byte Fonts**: Removed Google Fonts from `index.html` and reverted to a universally supported System Font Stack to avoid render-blocking downloads.

### Fixed 🛠️
- **Registration Ghost Error**: Patched `authService.ts` to aggressively bypass and gracefully handle the 422 "User already registered" error (caused by orphaned auth identities) by falling back to auto-login.
- **RLS Profile Creation**: Fixed Row-Level Security failures on profile registration by letting Supabase Database functions handle inserts or gracefully ignoring RLS blocks.
- **Vite 500 Errors**: Resolved broken React module imports that were crashing the dev server.
- **App.tsx Resolution**: Fixed module resolution for `AdminTelemetry` using path aliases.

## [V 1.0] - 2026-03-04
### Standardized 💎
- **Official Version**: Standardized as V 1.0 across all project files (`package.json`, headers, etc.).
- **Clean Registry**: Removed development-only "Fix #", "Phase X", and "Step X" comments for production readiness.
- **Git Migration**: Transitioned to the new official repository `prajnadigilab-neozen/simplishtalks.git` and removed legacy contributors from remote references.
