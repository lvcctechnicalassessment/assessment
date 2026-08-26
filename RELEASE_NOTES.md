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

## v1.5.0
- Integrity gate: centered logo/button, larger justified text
- Desktop fullscreen enforced; camera permission at start
- Live grid: screen + camera thumbs (overwrite); HQ stills only on violation
- Stop monitoring after submit (history kept)
- Single-question gamified take UI with skip / skip passage
- Mobile End assessment with confirm → auto-submit
- History: real option values; Create mock exam checkboxes; mock retake randomized
- Non-live layouts restored to classic sidebar; live view keeps 3-panel density

## v1.5.1
- Brand colors (light/dark hex palette); contrast placeholders
- Header/sidebar layout: theme icon by role; name/email/logout in menu bottom; logo → Dashboard
- Live: screen only; connection ping; HQ on violation; paste ignore/deduct
- History: row click, mock checkboxes on demand, separate Mock History page
- Full-screen gamified take UI; skip loops to unanswered
- Manage / Monitor / Share equal actions; direct edit state

## v1.5.2
- Sidebar shell (logo/version/user in menu), Segoe UI, white minimal icons, settings popover theme switch
- Dark mode primary buttons #F2A240; collapsible nav; mobile logo hamburger
- Agreement text without camera/evidence; no camera capture
- Fluid equal assessment action buttons; test-as-student role glitch fixed
- Integrity PDF + HQ image export with dated filenames; Excel CSV newline fix
- Student History renamed Assessments; layout grid; results top performers
- Take UI: centered nav, submit confirm on last unanswered, FAB z-index

## v1.5.3
- Student join code screen; Join Assessment on dashboard; 8-digit assessment ID
- Take UI theme bg, full-width question, choice colors, FAB fix, browser fullscreen
- Draft save + remote autosave; Publish schedule + share ID/QR
- My Assessments Manage/Monitor/Share groups; Co-Instructor + Proctor
- Mock history persist; history left align; teacher dashboard stats
- Shell: mobile avatar menu; desktop user row; settings theme only

## v1.5.4
- Fix showStudentJoinScreen / join by 8-digit code
- Desktop sidebar user (avatar, name, email, role) visible
- Test as student: future timer window, skip gate block
- Draft/Publish save sections+questions; integrity thumbs + hide names
- Live dashboard open; paste/copy/resize/right-click/fullscreen violations
- Take UI: question full width, choices below, theme background

## v1.5.5
- Reliable assessment builder: collectAssessmentForm + saveAssessment
- Save as Draft and Publish wired to single save path with error messages
- Edit loads sections/questions and re-renders builder
- New assessment clears previous editor state

## v1.5.6
- Agree & Continue: prompt screen share first, non-blocking start, then fullscreen
- 30s grace after join (no false left-app / fullscreen violations); connection-loss after 30s poor network
- Take UI: question ~3/4 height, selected choice black border, green Skip, centered timer
- End / Submit / floating message / instructor message fixes
- History + PDF: Total / Correct / Incorrect / Unattempted + accuracy

## v1.5.7
- Modals above take UI (z-index) so Message / End / Confirm work
- Reshare then force fullscreen; paste warnings no longer freeze buttons
- Integrity list chronological by time; PDF export loads jsPDF if needed
- Live: End assessment per student + End all assessments
- Take layout fits device height/width with less scrolling

## v1.5.8
- End assessment / Talk to instructor no longer logged as window-blur
- PDF export: multi-CDN jsPDF loader
- Student "Talk to instructor" pops up on instructor live view with reply
- End assessment (per student + all) fixed with direct Firestore update

## v1.5.9
- PDF export: local jsPDF vendor (js/vendor/jspdf.umd.min.js) — no CDN required
- Fallback printable HTML export if jsPDF still fails

## v1.5.10
- Modal overlays block background clicks; popups usable again
- Fixed broken Duplicate / toggleExamActive methods
- Edit assessment re-renders saved questions without needing Add Question
- Integrity PDF includes screenshots when available (+ HTML fallback)
- Take layout larger fit to device; Word Box type with bank grid + drag-drop blanks

## v1.5.11
- Edit assessment shows full question editors (options/correct answers) immediately
- Word Box: sentence with {{n}} blanks + drag tiles (Wayground-style)
- Restored ~3/4 question box layout on take screen

## v1.5.12
- Q numbering per section in builder
- Edit loads full question editors immediately
- Word Box: visual blank boxes, word grid, drag answers in config
- Fill-in-the-blank: multi blanks open-ended (no bank)
- Passage dual-panel RTE + question builder
- Categorize dual-panel categories/items + student drag sort
- History shows sentence + readable answers
- Take UI locked to 100vh with side padding; ~3/4 question area

## v1.5.13
- Edit updates existing assessment (persistent edit id); no longer creates a new one
- Config buttons (Add Question / Save / Publish) fixed — picker no longer nested incorrectly
- Integrity Export PDF embeds violation screenshots (JPEG/PNG)

## v1.5.14
- Question type picker always available (no longer nested under existing sections)
- Create/Edit assessment: Add Question works with zero questions
- Initial builder paint wires Save / Publish / Add Question on open

## v1.5.15
- Categorize: fixed add category / item / answer key (schema + handlers)
- Passage: fixed Add New Question
- Local image upload for Passage editor and Categorize items

## v1.5.16
- Save: compress images; block writes over Firestore 1 MB doc limit (clear error)
- Categorize: drag images when provided; remove image option
- Passage take: dual panel 50/50 independent scroll, all questions on same page
- Points per blank/item for fill, wordbox, categorize, table
- Alternates for open-ended/essay; table-fill dual panel + calculator
- Table fill copy/paste not flagged as integrity
- window-blur → "Clicked outside assessment page"
- Intentional leave lock + instructor Admit / Ignore / End
- Live write budget to protect Spark free-tier quotas

## v1.5.17
- Multiple images no longer stored inside the Firestore exam document
- On save: images upload to Firebase Storage; exam doc only keeps download URLs (stays under 1 MB)
- Requires Firebase Storage enabled + storageBucket in firebase-config + Storage rules for assessments/{examId}/**

## v1.5.18
- Live dashboard: "Show live screens" toggle (off = quota saver; students stop uploading frames)

## v1.5.19
- Live screens OFF is silent for students: screen share stays on; only instructor stops receiving frames

## v1.5.20
- Table fill scoring: Full points only if all blanks correct OR points for every correct blank
