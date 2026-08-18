/**
 * Authentication & Role Management
 */

const Auth = {
  currentUser: null,
  userProfile: null,

  async init() {
    if (!window.auth) {
      throw new Error('Firebase Auth is not initialized. Check firebase-config.js.');
    }
    return new Promise((resolve) => {
      window.auth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          try {
            this.userProfile = await this.ensureUserProfile(user);
            resolve(this.userProfile);
          } catch (err) {
            console.error(err);
            await window.auth.signOut();
            this.currentUser = null;
            this.userProfile = null;
            alert(err.message || 'Access denied');
            resolve(null);
          }
        } else {
          this.currentUser = null;
          this.userProfile = null;
          resolve(null);
        }
      });
    });
  },

  /** Superadmins always allowed. Everyone else must be a La Verdad email. */
  isEmailAllowed(email) {
    if (!email) return false;
    const lower = email.toLowerCase();

    // 1. Superadmin emails (including personal Gmail) — always allowed
    const superEmails = (window.SUPERADMIN_EMAILS || []).map(e => e.toLowerCase());
    if (superEmails.includes(lower)) return true;

    // 2. Must match one of the allowed school domains
    const domains = (window.ALLOWED_EMAIL_DOMAINS || []).map(d => d.toLowerCase());
    if (domains.length > 0) {
      return domains.some(d => lower.endsWith('@' + d));
    }

    // Fallback to older settings
    if (window.STUDENT_DOMAIN && lower.endsWith('@' + window.STUDENT_DOMAIN.toLowerCase())) return true;
    const teacherDomains = (window.TEACHER_DOMAINS || []).map(d => d.toLowerCase());
    if (teacherDomains.some(d => lower.endsWith('@' + d))) return true;

    return false;
  },

  async ensureUserProfile(user) {
    const email = (user.email || '').toLowerCase();

    if (!this.isEmailAllowed(email)) {
      throw new Error(
        'Access denied. Only La Verdad emails (@student.laverdad.edu.ph or @laverdad.edu.ph) are allowed.'
      );
    }

    const ref = window.db.collection('users').doc(user.uid);
    const snap = await ref.get();

    if (snap.exists) {
      return { uid: user.uid, ...snap.data() };
    }

    // New user – determine role
    let role = 'student';
    const superEmails = (window.SUPERADMIN_EMAILS || []).map(e => e.toLowerCase());
    if (superEmails.includes(email)) {
      role = 'superadmin';
    }

    const profile = {
      email: user.email,
      name: user.displayName || user.email.split('@')[0],
      photoURL: user.photoURL || null,
      role,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await ref.set(profile);
    return { uid: user.uid, ...profile };
  },

  async signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await window.auth.signInWithPopup(provider);
      this.userProfile = await this.ensureUserProfile(result.user);
      return this.userProfile;
    } catch (err) {
      console.error('Sign-in error', err);
      throw err;
    }
  },

  async signOut() {
    await window.auth.signOut();
    this.currentUser = null;
    this.userProfile = null;
  },

  isSuperAdmin() {
    return this.userProfile?.role === 'superadmin';
  },

  isTeacher() {
    return this.userProfile?.role === 'teacher' || this.userProfile?.role === 'superadmin';
  },

  isStudent() {
    return this.userProfile?.role === 'student';
  },

  async addTeacher(email) {
    if (!this.isSuperAdmin()) throw new Error('Only superadmin can add teachers');

    email = email.trim().toLowerCase();
    const q = await window.db.collection('users').where('email', '==', email).limit(1).get();

    if (!q.empty) {
      const doc = q.docs[0];
      await doc.ref.update({
        role: 'teacher',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, message: 'Updated ' + email + ' to teacher role.' };
    }

    await window.db.collection('pendingTeachers').doc(email).set({
      email,
      addedBy: this.currentUser.uid,
      addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Invitation stored for ' + email + '. They will become teacher on first login.' };
  },

  async removeTeacher(uid) {
    if (!this.isSuperAdmin()) throw new Error('Only superadmin');
    await window.db.collection('users').doc(uid).update({
      role: 'student',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async setRole(uid, role) {
    if (!this.isSuperAdmin()) throw new Error('Only superadmin');
    const allowed = ['student', 'teacher', 'superadmin'];
    if (!allowed.includes(role)) throw new Error('Invalid role');
    await window.db.collection('users').doc(uid).update({
      role,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async listTeachers() {
    const snap = await window.db.collection('users').where('role', 'in', ['teacher', 'superadmin']).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  async checkPendingTeacher(user) {
    const pending = await window.db.collection('pendingTeachers').doc(user.email.toLowerCase()).get();
    if (pending.exists) {
      await window.db.collection('users').doc(user.uid).update({
        role: 'teacher',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      await pending.ref.delete();
      this.userProfile.role = 'teacher';
    }
  }
};

window.Auth = Auth;
