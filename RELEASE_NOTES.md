# LVCC Assessment Portal — Release Notes

## v1.2.0 — 2026-08-18

### Fixed
- **Missing or insufficient permissions**: Added `firestore.rules` for the project. Publish these rules in Firebase Console → Firestore → Rules. Exam list also falls back if the composite index is missing.
- **Slow logo**: Compressed from ~7MB to ~32KB (128×128). Favicons included.

### Added
- **Per-exam personal email invites** — invite is bound to one exam only.
- **Exam duration** (minutes) when creating an exam + live countdown timer (top right).
- **Time’s up**: editor locks, screen dims, message shown, code auto-submitted.
- **Extend time** on live dashboard / student detail (teacher adds minutes).
- **Paste integrity**: teacher modal “Suspicious activity: Student pasted code (N lines)” with **See details** and highlighted pasted line ranges.
- **Confirm dialogs** for logout, close/reopen exam, submit exam.
- **Answer key** on create exam for auto-grade hint (token-overlap similarity).
- **Manual grading** with optional comment; max score (default 50); % on /100 scale.
- **Results** page per exam; **Export** individual student report (.txt) and class summary (.csv).
- **Release notes** (this file).

### Changed
- Branding: **LVCC Assessment Portal** — “True to our name, true to our test”.

### Deploy checklist
1. Firebase → Firestore → **Rules** → paste contents of `firestore.rules` → **Publish**.
2. Restore real keys in `js/firebase-config.js` (`SUPERADMIN_EMAILS`, `ALLOWED_EMAIL_DOMAINS`).
3. Index on `exams`: `teacherId` ASC + `createdAt` DESC (optional; app has fallback).
4. Push files to GitHub Pages root → hard-refresh.
