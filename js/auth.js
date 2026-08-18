/**
 * Authentication & Role Management
 *
 * Rules:
 * - SUPERADMIN_EMAILS always allowed
 * - @student.laverdad.edu.ph and @laverdad.edu.ph always allowed
 * - Other emails (e.g. personal Gmail) allowed ONLY if invited by a teacher
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
            // Friendly message instead of raw errors
            this.showAccessDenied(err.message || 'Access denied');
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

  showAccessDenied(message) {
    // Prefer in-app banner over browser alert when possible
    if (typeof App !== 'undefined' && App.showAccessDeniedScreen) {
      App.showAccessDeniedScreen(message);
    } else {
      alert(message);
    }
  },

  /** Check if email has a teacher invite (personal email exception) */
  async hasInvite(email) {
    const lower = (email || '').toLowerCase();
    if (!lower) return false;
    try {
      const snap = await window.db.collection('invitedStudents').doc(lower).get();
      return snap.exists;
    } catch (e) {
      console.error('Invite check failed', e);
      return false;
    }
  },

  /** Superadmins always allowed. School domains allowed. Invited personal emails allowed. */
  async isEmailAllowed(email) {
    if (!email) return { allowed: false, reason: 'No email provided.' };
    const lower = email.toLowerCase();

    // 1. Superadmin list
    const superEmails = (window.SUPERADMIN_EMAILS || []).map(e => e.toLowerCase());
    if (superEmails.includes(lower)) {
      return { allowed: true, reason: 'superadmin' };
    }

    // 2. School domains
    const domains = (window.ALLOWED_EMAIL_DOMAINS || [
      'student.laverdad.edu.ph',
      'laverdad.edu.ph'
    ]).map(d => d.toLowerCase());

    if (domains.some(d => lower.endsWith('@' + d))) {
      return { allowed: true, reason: 'school' };
    }

    // 3. Teacher invite for personal email
    if (await this.hasInvite(lower)) {
      return { allowed: true, reason: 'invited' };
    }

    return {
      allowed: false,
      reason:
        'Only La Verdad emails are allowed (@student.laverdad.edu.ph or @laverdad.edu.ph).\n\n' +
        'If you need to use a personal email, ask your teacher to invite you first.'
    };
  },

  async ensureUserProfile(user) {
    const email = (user.email || '').toLowerCase();
    const check = await this.isEmailAllowed(email);

    if (!check.allowed) {
      throw new Error(check.reason);
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
      invited: check.reason === 'invited',
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
      // Friendlier messages for common Firebase errors
      if (err.code === 'auth/network-request-failed') {
        throw new Error(
          'Network error during sign-in. Check your internet connection and try again.\n\n' +
          'If you are on school Wi-Fi, try a mobile hotspot.'
        );
      }
      if (err.code === 'auth/popup-closed-by-user') {
        throw new Error('Sign-in was cancelled. Please try again and complete the Google popup.');
      }
      if (err.code === 'auth/unauthorized-domain') {
        throw new Error('This website domain is not authorized in Firebase. Contact the administrator.');
      }
      // Access denied from ensureUserProfile
      if (err.message && err.message.includes('Only La Verdad')) {
        throw err;
      }
      throw new Error(err.message || 'Sign-in failed. Please try again.');
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

  // ---- Teacher invites personal emails ----
  async inviteStudent(email) {
    if (!this.isTeacher()) throw new Error('Only teachers can invite students');
    email = email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Enter a valid email address');

    await window.db.collection('invitedStudents').doc(email).set({
      email,
      invitedBy: this.currentUser.uid,
      invitedByEmail: this.userProfile.email,
      invitedByName: this.userProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Invited ' + email + '. They can now sign in with that email.' };
  },

  async removeInvite(email) {
    if (!this.isTeacher()) throw new Error('Only teachers can manage invites');
    email = email.trim().toLowerCase();
    await window.db.collection('invitedStudents').doc(email).delete();
  },

  async listInvites() {
    if (!this.isTeacher()) return [];
    const snap = await window.db.collection('invitedStudents')
      .where('invitedBy', '==', this.currentUser.uid)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
