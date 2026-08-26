# Exam Integrity Platform

A secure web application for conducting Python coding examinations with real-time teacher monitoring and anti-cheat detection. Designed for deployment on **GitHub Pages** (static hosting) using **Firebase** for authentication, database, and real-time synchronization.

## Features

### Roles
1. **Superadmin** (you) – Manage teacher accounts by email
2. **Teachers** – Create coding exams with instructions, share unique links, view live dashboards
3. **Students** – Take exams in a locked Python editor (Monaco)

### Core Capabilities
- Google Sign-In restricted to school accounts (optional domain lock)
- Teachers create exams → generate shareable link (`?exam=ID`)
- Students open the link → full-screen Python editor with:
  - Syntax highlighting
  - Auto-complete & bracket matching
  - Basic static syntax checks
  - Live auto-save of every keystroke to the cloud
- **Live Teacher Dashboard**: See every student’s code in real time as they type
- **Anti-cheat notifications** when a student:
  - Copies or pastes text
  - Right-clicks
  - Switches tabs / minimizes window / loses focus
  - Attempts to close the page
  - Tries to drag-and-drop content
- Event log stored per session

## Tech Stack
- Vanilla HTML / CSS / JavaScript (no build step required)
- Firebase Authentication (Google)
- Cloud Firestore (real-time listeners)
- Monaco Editor (VS Code engine) via CDN
- Pure static files → perfect for GitHub Pages

## Setup Instructions

### 1. Create a Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. **Authentication** → Sign-in method → Enable **Google**
4. **Firestore Database** → Create database → Start in **test mode** (for development)
5. Project Settings → General → Your apps → Add **Web** app → Copy the `firebaseConfig` object

### 2. Configure the App
Open `js/firebase-config.js` and replace:

```js
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const SUPERADMIN_EMAILS = [
  "your.email@school.edu"   // ← your real school Google email
];
```

Optional: set `ALLOWED_DOMAIN = "school.edu"` to restrict logins.

### 3. Firestore Security Rules (important for production)
After testing, update rules to something like:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /exams/{examId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null;
    }
    match /sessions/{sessionId} {
      allow read, write: if request.auth != null;
    }
    match /notifications/{id} {
      allow read, write: if request.auth != null;
    }
    match /pendingTeachers/{email} {
      allow read, write: if request.auth != null;
    }
  }
}
```

(Tighten further based on roles using custom claims if needed.)

### 4. Deploy to GitHub Pages

```bash
# Create a new repo on GitHub, then:
cd exam-integrity-app
git init
git add .
git commit -m "Initial commit - Exam Integrity Platform"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/exam-integrity-app.git
git push -u origin main
```

Then:
1. Repo → Settings → Pages
2. Source: Deploy from branch → `main` → `/ (root)`
3. Save. Your site will be at `https://YOUR_USERNAME.github.io/exam-integrity-app/`

**Important**: Because the app uses client-side routing via query parameters (`?exam=...`), GitHub Pages works out of the box (no SPA router needed).

### 5. First Login
1. Open the deployed site
2. Sign in with the email listed in `SUPERADMIN_EMAILS`
3. You become Superadmin automatically
4. Add teacher emails from the Teachers page
5. Teachers log in → create exams → copy the link → send to students

## Student Exam Link Format
```
https://YOUR_USERNAME.github.io/exam-integrity-app/?exam=EXAM_DOCUMENT_ID
```

Students must be signed in with a Google account. On first visit they are assigned the Student role (unless previously invited as Teacher).

## Limitations & Notes
- **No server-side code execution**: The “Check Syntax” button performs only lightweight static analysis. Full Python execution would require embedding Pyodide (large download) or a backend.
- **Real-time lag**: Code is synced every ~800 ms. Very fast typing is still captured.
- **Browser only**: Anti-cheat relies on browser events. Determined cheaters can bypass with external tools, but the live view + event log makes most common cheats visible.
- **Fullscreen**: The app does not force fullscreen (browsers block it without user gesture). Teachers can instruct students to use fullscreen manually.
- **Cost**: Firebase free Spark plan is sufficient for small classes. Watch read/write quotas for large concurrent exams.

## File Structure
```
exam-integrity-app/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── firebase-config.js   ← edit this
│   ├── auth.js
│   ├── exam.js
│   ├── editor.js
│   ├── dashboard.js
│   ├── notifications.js
│   └── app.js
└── README.md
```

## Extending
- Add Pyodide for in-browser Python execution
- Add exam timers / automatic submission
- Add grading / feedback after submission
- Use Firebase Custom Claims for stronger role enforcement
- Add video/audio proctoring (third-party services)

---

Built for academic integrity. Use responsibly and in accordance with your institution’s policies.


## Firebase Storage (required for multi-image assessments)

Firestorestore documents are capped at **1 MB**. Large Passage/Categorize images are uploaded to **Firebase Storage**.

1. Firebase Console → Build → **Storage** → Get started (if not enabled).
2. Confirm `storageBucket` in `js/firebase-config.js` (usually `your-project.appspot.com`).
3. Storage **Rules** example:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /assessments/{examId}/{allPaths=**} {
      allow read: if request.auth != null;
      allow write: if request.auth != null;
    }
  }
}
```
