# LVCC Assessment Portal — Release Notes

## v1.3.1 — 2026-08-19

### Fixed
- **Personal Gmail access**: Domain/invite check runs on every sign-in; unauthorized accounts are signed out immediately (no bypass via existing user docs).
- **Mobile header**: Only logo + “LVCC Assessment Portal” on the header; full name and Logout live in the hamburger menu.
- **Prompts**: Removed long github.io URLs from alerts; copy uses a short confirmation.
- **Student portal**: Removed sample exam-link section.
- **Logo alignment**: Brand block left-aligned on all views.

### Added
- **QR code** sharing per assessment (Link / QR panel).
- **Share to co-teacher**: creates a fresh copy for them to configure.
- **Edit / Delete** assessment (delete requires typing the assessment name).
- **Categorized actions** on assessment cards: Monitor · Share · Manage.
- **Gamified multiple-choice** builder and student UI (colored option cards; click ✓ for correct answer).
- **Mock flow**: Generate mock from History (per subject, code/regular checkboxes); Mock tab shows history only.
- **Time’s up**: View results / Back to home buttons.
- Code assessment **default max score 100**; regular assessments use per-question points (no global max score field).
- Start time cannot be before current date/time for new schedules.

### Renamed
- “Exam(s)” → **Assessment(s)** across teacher/student UI.

### Deploy
1. Publish `firestore.rules` if not already.
2. Restore Firebase config keys.
3. Push to GitHub Pages; hard-refresh.

## v1.3.2 — 2026-08-19

### Security / roles
- **Firestore rules** enforce roles:
  - **Superadmin**: manage users/teachers; full access where needed
  - **Teacher**: create / edit / delete **their own** assessments; invites, proctors, grades
  - **Student**: take assessments via teacher link; write own sessions; create **mock history** only (cannot create real assessments)
- App UI blocks students from Create Assessment.

## v1.4.0 — 2026-08-19

### Added / changed
- Themed center modals (UI.alert / confirm / prompt) — no browser "says" dialogs for main flows
- Live dashboard **right integrity panel** with as-you-type filter + screenshot thumbnails
- **Integrity issues** under Monitor — full permanent history (`integrityHistory`)
- Screen thumbnail captured on integrity events (html2canvas)
- **Share to Co-teacher** label; Draft / Publish on create; Regular assessment default
- Essay (renamed from Open ended, 1000 chars); TF categories; fill-in blanks; table fill foundations
- Submit no longer fires false "leave page" integrity event
- Desktop: name/logout only in header (not sidebar)

### Note
Full Google-Docs-style passage multi-tab editor and complete visual editors for every advanced item type continue to use structured data models; passage sets and rich cell editing can be expanded further in a follow-up.

## v1.4.1 — 2026-08-19

### Added
- **Light / Dark theme** toggle on all screens (header + mobile menu + login)
- Preference saved in **localStorage** and **Firestore user profile** (survives re-login)
- Default theme: **Dark**
- Build stamp **v1.4.1** in header to verify deploy

### Deploy note
If features seem missing, replace **all** app files from the zip (not only one JS file), then hard-refresh or clear cache. Confirm **v1.4.1** appears next to the logo.
