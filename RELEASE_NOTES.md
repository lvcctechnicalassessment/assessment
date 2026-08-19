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
