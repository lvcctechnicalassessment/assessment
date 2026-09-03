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

## v1.5.21
- Hard-stop monitoring on submit / time-up / teacher end / test-as-student end (clears timers, streams, session id)
- Student auto-stops live writes when session status becomes submitted

## v1.5.22
- Live: focus one student screen only
- Table fill: instruction as merged first row, visible grid, centered, professional calculator
- Passage: left stays; next/skip only advances questions; Skip passage visible
- Builder: Duplicate question for all types
- Next requires answer; Skip allows blanks

## v1.5.23
- Live screens OFF by default (discreet share); instructor can enable all or one student
- Idle 5 min → 10s countdown → end session (quota saver)
- Tighter live write budget for large classes
- Passage: 100vh dual pane, left tabs, all questions on right, Skip passage only
- Match question type with line pairing, 1 pt per correct pair

## v1.5.24
- Live: remove text snapshot on regular exam cards (quota)
- Screen share required (mobile+desktop); no start without Allow; monitoring cue on take UI
- Save draft/publish: Storage upload parked — inline images under 1MB only
- Test as student: skip lock path, default examType regular when questions exist, surface errors
- Login subtitle: Integrity - We live with honesty, truthfulness, and moral courage.

## v1.5.25
- Fix renderTake is not defined (rebuild take engine)
- Universal fake screen-share consent when getDisplayMedia unavailable
- Chrome/Edge only + multi-monitor block before exam start
- Integrity rules title, padding, Security Notice
- Superadmin: remove non-school accounts + retention policy
- Unpublished / not-started assessment messages

## v1.5.26
- Fix wordbox/categorize drag (desktop + tap-to-place on mobile)
- Passage MC selection binding; open-ended note wording
- Skip always advances
- Exam code display 1234-5678 (raw 8 digits retained)
- Publish: optional invites, centered success with title/code/times/QR
- Avatar popover closes menu; mobile nav from right
- Match centered + clear click-A-then-B instruction

## v1.5.27
- Re-bind wordbox/categorize drag (cursor + dropEffect + tap-to-place)
- Passage MC full bindStudentMC; points + multiCorrect per passage question
- Skip always advances (skip markers)
- Exam code 1234-5678 inputs bound; publish success modal retained

## v1.5.28
- Skip always advances to next question group
- Table fill calculator keys + keyboard + clipboard history
- Right-click blocked except table fill copy/paste
- Passage MC event delegation
- Mobile: no screen-share requirement (monitoring cue kept)
- My Assessments: Closed label, Reopen with new schedule
- Results: human labels for categorize, match, passage, table

## v1.5.29
- Table fill: numbers-only calc, blue headers, no row nums, equal panel heights
- Take: Submit Answer; Skip passage ghost style; passage equal panes; white option labels
- Idle: instructors/test not signed out after 5 min
- Aesthetic scrollbars; collapsed nav full-width hover + titles; minimalist icons
- Fill/wordbox centering; word bank table cells
- Passage builder tabs + Add Question fixed bottom
- FUNCTIONAL_SPECIFICATIONS.md added (update each release)

## v1.5.30
- Removed Skip (kept Skip passage)
- Publish randomize option (per section; not passage/table)
- FIB centered; inline builder + Alt popover
- Passage MC border; wordbox dual layout
- Staff idle 10 min; test-as-student idle ends session
- Table subheader; show/hide student calculator

## v1.5.31
- Version badge v1.5.31; Skip/Skip passage removed
- Passage MC same as normal MC (no sticky checks)
- Drag rebind; table/clipboard heights; FIB collect + display
- Wordbox dual config + reusable bank; section order randomization
- Publish: Copy code / Copy link only; Edit published uses Save (stays published)
- Teacher→Instructor in UI copy

## v1.5.32
- Fix Auth.checkPendingInstructor is not a function (and related Instructor/Teacher API aliases)

## v1.5.33
- Restore Regular.flattenQuestions and Regular.groupQuestionsForTake (fixes Test as student / preview error)

## v1.5.34
- Fix answer acceptance so Submit Answer advances after student answers
- Passage MC uses same take-opt selection as regular MC
- Options left-aligned (not centered)
- Table fill: fixed calculator height; clipboard scrolls inside panel; table left panel full height
- Table config: single panel, add/remove column/row/subheader, alternative popup
- Match answer key labels use Column A values
- Duplicate title only one "(Copy)"
- Larger fill-in-the-blank font on student take

## v1.5.35
- Mobile light: header title white; hamburger/menu slides from right
- Match mobile: stacked cards, hide lines, pair chips
- Publish (My Assessments) + Reopen: same schedule + new code + publish success modal
- Integrity rules card: 100vh lock, scroll body only (logo + Accept visible)
- Submit Answer: stronger DOM re-read for current question
- Live dashboard: broader in-progress sessions; setLiveScreensEnabled enables student thumb uploads
- 2nd monitor during exam: lock + integrity "Connected 2nd Monitor"
- Student history: no Q1 labels; section headers; mobile label-then-value; no bare {{1}}

## v1.5.36
- Reopen: new sessionWave so students can retake without "already submitted"; publish popup + optional invites kept
- Table fill config: fixed equal cells, +/− row/col, horizontal scroll, blue header/subheader, tools no longer stretch cells
- Wordbox: +/− bank grid, {} word answers with orange Consolas highlight, no prompt boxes, dual-panel scroll at 100vh
- Categorize: points beside prompt; categories then Add Category; items then Add Item
- Passage: double-click tab to rename
- Match: points beside prompt
- Fill: red answer borders; full-points vs per-blank scoring; auto total when per-blank
- Points mode: hide Points per blank when Full points; show + auto total when per-blank; order is per-blank then total
- History: section titles only (no instructions); table blanks as separate rows; passage/wordbox expanded; MC shows text not [object Object]; mobile no duplicate labels
- MC options required (non-blank) on save/publish

## v1.5.37
- Builder Undo / Redo for assessment configuration
- Submit Answer requires all blanks filled (wordbox, fill, categorize, table, match)
- Fill-in-the-blank student font slightly larger
- Wordbox config: live orange Consolas in textbox, no tip labels, points per correct answer
- Categorize: Add Category above category rows; items below; points-per-item before total (auto total)
- Match answer key labels update live as Column A is typed
- MC: trash left, correct mark right of each option
- Remove/Delete/X builder buttons gray (light & dark)
- Settings → About (logo, Integrity subtitle, build, tribute to Ms. Joane Pauline S. Maunes)
- Section instructions shown in futuristic frame before section questions
- Theme toggle on student join and during assessment
- Retro exam theme (pixel HUD / neon cyan panels; cycles Light → Dark → Retro)

## v1.5.38
- Wordbox config: only matched {words} turn orange Consolas (preview); sentence text stays normal
- Builder delete/muted buttons: clear background, gray text & border
- Categorize rows: prompt+points → Categories title+Add → category scroll → Items title+Add → items scroll
- Ctrl+Z / Ctrl+Y undo & redo in assessment configuration
- Passage images resizable by dragging the bottom-right corner
- MC option boxes resizable; resize affordance at the edge
- Save validation scrolls to & blinks incomplete required fields
- Table fill copy/paste/right-click never flagged as integrity issues
- Wordbox drag answers nested correctly under child + parent ids
- Live dashboard: View all screens / Specific student / Screens off
- History answers matched by question id only (no cross-type leakage); MC text not [object Object]; table blanks as comma-separated row
- Dark mode: darker page background, darker content cards
- Screenshare stopped on assessment end (Monitor.stop tracks)
- Student result PDF: professional colored report, no Q1/Q2 labels, section grouping
- Retro: smaller wordbank/option text to prevent overflow
- Section intro: full 100vh, Ready button centered at bottom

## v1.5.39
- Mock assessments are real student practice (not instructor test mode) and appear in Mock History
- Create mock exam moved to Mock History (modal with filters/checkboxes)
- Student results: Accuracy in stats, equal columns, collapsible sections; Match/Passage/Table full-width special blocks
- Result PDF: colored professional layout with blue headers (template-style)
- Global loading blur overlay
- Retro is a full theme option for students (Settings + toggle)
- Section instructions & buttons centered; categorize 100vh full-width columns; progress counter removed
- No floating message on mock assessments
- Retro-only: wordbank fit, larger centered MC with glow selection, answer-required modal spacing, open-ended note in default gray font, buttons use retro font, app chrome uses Segoe UI
- Answer-required copy: all blanks/questions should be answered before continuing
- Open-ended character counter updates live
- About: centered, themed card, no Close button, contact Ma'am Pau email
- Categorize config: single-column rows (title+button then content scroll)
- Dark mode page background matches menu
- Live dashboard no longer re-shows the last student message on open
- Publish/reopen stamps runId; student sessions carry runId + teacherId
- New Sessions page for instructors (past runs, participants, integrity popup, session detail)

## v1.5.40
- Student join: default Segoe UI for code hint; tri-state Light/Dark/Retro theme switch; student default Light
- Create mock exam modal restored and working
- Student result PDF: navy header on every page, orange %, blue section bars (peer-eval style)
- Removed "Integrity -" prefix from subtitles
- About: Consolas orange email (not a link); removed bottom "About" label; About button centered
- Instructor settings: classic Light/Dark switch again; students keep tri-state
- Faster assessment/results loading (reuse session scores; limited hardest-Q scan)
- Instructor Results null-exam guard + loading overlay
- Section intro fonts ~3×; Ready centered; MC centered all themes; no MC resize; fill blanks ~3× font
- Test-as-student: no submit loop / no sign-out reload on idle end
- Categorize Remove question no longer overlaps items
- Passage image Wrap Text (MS Word-style options)
- Student results: accuracy on same stats row; no per-row Question/Response/Correct labels; Match SVG lines; Table fill visual like assessment; Passage at bottom special section

## v1.5.41
- Integrity: duration-based episodes (mm:ss) instead of duplicate Violation #N; new episode when leave→return→leave again
- Favicon: LVCC logo on all tabs
- Loading blur on login, join, mock create, PDF export
- Results: match/table only in special full-width blocks (not redundant grid rows); match lines connect dots; table visual improved
- PDF: html2pdf A4 template — full-width navy header, score card, blue section bars, white cards, green correct answers
- Mock: list modal closes before name/time prompts; loading; no Screen Monitoring cue; timer endsAt fixed; results after submit; recorded in Mock History
- Match col A: text right-aligned, bullet toward center; categorize centered; retro stronger glow; categorize 100vh
- Reopen refreshes My Assessments cards live
- Screen-share: clearer message if prompt blocked
- Retro login 100vh; integrity rules centered
- Second monitor during join grace not logged as integrity issue
- Instructor→student message no longer reappears every question
- Live dashboard: broader active-session filter so student cards show
- Table fill copy/paste allowed (target-aware); other pastes log clipboard snippet
- After submit (assessment + mock) opens result detail view

## v1.5.42
- Sessions page restored and working
- Wordbox blanks: rounded rectangle (not oval); font matches sentence; bank chips responsive flex
- Timer pauses during section instructions; continues without reset/blink per question
- Categorize: per-column scroll, 100vh fit, drag items back to options bank
- Passage left/right equal height with independent scroll
- Match take layout fixed: labels outside, bullets toward center for connecting lines
- Retro: stronger cyan glow on selected options; history fonts scaled for desktop fit
- Join assessment: loading blur dismissed before integrity gate (no more stuck overlay)
- Mock View/Retake: reliable Firestore persist of questionsSnapshot; retake builds new session
- PDF export always clears "Generating PDF…" overlay; direct download preferred
- Logged-in refresh routes to Dashboard (not join screen)
- History stats use stored total/correct/incorrect/unattempted/accuracy with score fallbacks
