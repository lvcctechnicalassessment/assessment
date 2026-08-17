/**
 * Firebase Configuration
 *
 * IMPORTANT: Replace the placeholder values below with your own Firebase project config.
 *
 * How to get this:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project (or use existing)
 * 3. Enable Authentication > Sign-in method > Google
 * 4. Create a Firestore Database (start in test mode for development, then lock down rules)
 * 5. Project Settings > Your apps > Web app > Copy the config object
 *
 * Also enable Google as provider and (optionally) restrict to your school domain.
 */

const firebaseConfig = {
  apiKey: "AIzaSyDF842O0lcMJvVBMzpuRkvKUTVXXikwa_8",
  authDomain: "lvcc-technical-assessment.firebaseapp.com",
  projectId: "lvcc-technical-assessment",
  storageBucket: "lvcc-technical-assessment.firebasestorage.app",
  messagingSenderId: "845757509653",
  appId: "1:845757509653:web:bf7a89144c4e4bc859de1c",
  measurementId: "G-H72G3FW9WY"
};

// ============================================
// SUPERADMIN CONFIGURATION
// ============================================
// Put your school Google email here. This user becomes Superadmin automatically.
// You can add multiple emails.
const SUPERADMIN_EMAILS = [
  "joanepauline.maunes@laverdad.edu.ph",
  "maunes.pauline@gmail.com"  // <-- REPLACE with your actual school email
  // "another.admin@school.edu"
];


// Optional: Restrict login to school domain only (e.g. "school.edu")
window.ALLOWED_DOMAIN = null;

// Initialize Firebase only if the SDK loaded successfully
(function initFirebase() {
  if (typeof firebase === "undefined") {
    console.error("Firebase SDK failed to load. Check your network / CDN access.");
    window.auth = null;
    window.db = null;
    return;
  }

  try {
    firebase.initializeApp(window.firebaseConfig);
    window.auth = firebase.auth();
    window.db = firebase.firestore();
  } catch (err) {
    console.error("Firebase initialization error:", err);
    window.auth = null;
    window.db = null;
  }
})();
