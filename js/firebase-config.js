/**
 * Firebase Configuration
 *
 * Keep your REAL firebaseConfig values on GitHub (do not replace them with these placeholders).
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
// SUPERADMIN — always allowed (even Gmail)
// ============================================
window.SUPERADMIN_EMAILS = [
  "joanepauline.maunes@laverdad.edu.ph",
  "maunes.pauline@gmail.com"   // <-- put your real Gmail here
];


// ============================================
// DOMAIN RULES
// ============================================
// Everyone EXCEPT superadmins must use one of these domains.
window.ALLOWED_EMAIL_DOMAINS = [
  "student.laverdad.edu.ph",  // students
  "laverdad.edu.ph"           // teachers / staff
];

// (legacy – not used when ALLOWED_EMAIL_DOMAINS is set)
window.STUDENT_DOMAIN = "student.laverdad.edu.ph";
window.TEACHER_DOMAINS = ["laverdad.edu.ph"];
window.ALLOWED_DOMAIN = null;

/**
 * Initialize Firebase
 */
window.initFirebaseApp = function initFirebaseApp() {
  if (typeof firebase === "undefined") {
    console.error("Firebase global is undefined – CDN scripts did not load.");
    return false;
  }
  try {
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
