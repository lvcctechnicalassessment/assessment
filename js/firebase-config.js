/**
 * Firebase Configuration
 *
 * IMPORTANT: Replace the placeholder values below with your own Firebase project config.
 *
 * How to get this:
 * 1. Go to https://console.firebase.google.com/
 * 2. Create a new project
 * 3. Enable Authentication > Sign-in method > Google
 * 4. Create a Firestore Database (start in test mode)
 * 5. Project Settings > Your apps > Web app > Copy the config object
 */
 
window.firebaseConfig = {
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
window.SUPERADMIN_EMAILS = [
  "joanepauline.maunes@laverdad.edu.ph",
  "maunes.pauline@gmail.com"   // <-- REPLACE with your actual school email
];

// Optional: Restrict login to school domain only (e.g. "school.edu")
window.ALLOWED_DOMAIN = null;

/**
 * Initialize Firebase. Called by app.js after scripts have had time to load.
 */
window.initFirebaseApp = function initFirebaseApp() {
  if (typeof firebase === "undefined") {
    console.error("Firebase global is undefined – CDN scripts did not load.");
    return false;
  }

  try {
    // Avoid double-init
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(window.firebaseConfig);
    }
    window.auth = firebase.auth();
    window.db = firebase.firestore();
    console.log("Firebase initialized successfully");
    return true;
  } catch (err) {
    console.error("Firebase initialization error:", err);
    window.auth = null;
    window.db = null;
    return false;
  }
};
