# LVCC Assessment Portal — Release Notes

## v1.3.0 — 2026-08-19

### Fixed
- **Mobile UI**: Responsive sidebar (hamburger), stacked exam layout, scrollable tables, flexible action buttons, auth card spacing.
- **Extend button**: Primary **⏱ Extend** on each student card + **⏱ Extend all** on the live dashboard header.
- **Copy/paste detection**: Ctrl+C / Ctrl+V / Cmd shortcuts, DOM paste, and Monaco `onDidPaste` with line-count + red line highlights for teachers.
- **Exam window**: Start/End apply to **all students** (not per-join). Timer uses shared `exam.startAt` / `exam.endAt`.

### Added
- **Exam type**: Code Assessment or Regular Assessment.
- **Languages** (code): Python or Java — Monaco language, starter templates, basic checks.
- **Proctors**: Assign emails per exam; equal student distribution; proctor live view = assigned students only; auto-deactivate when exam is closed/ended.
- **Duplicate exam** with new schedule.
- **Regular assessment** student screen + question builder (all listed types supported in model; interactive UI for multiple, multi-select, T/F, fill, open, dropdown, match, reorder, categorize, passage; other types use structured text response).
- **Live integrity** for regular assessments (same copy/paste/tab events).
- **Student history** by subject category (code vs regular).
- **Mock exam** from past regular questions (randomized practice).

### Deploy
1. Publish updated `firestore.rules` (includes `examProctors`).
2. Restore Firebase keys in `js/firebase-config.js`.
3. Push to GitHub Pages root; hard-refresh.

### Notes on advanced item types
Graphing, hotspot, full drag-drop canvas, and rich hot-text are available as question types with text/structured answers in v1.3. Richer visual editors can be added in a later release without changing the data model.
