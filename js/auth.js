/**
 * Authentication & Role Management
 *
 * Rules:
 * - SUPERADMIN_EMAILS always allowed
 * - @student.laverdad.edu.ph and @laverdad.edu.ph always allowed
 * - Personal emails allowed only if invited to at least one exam
 * - Personal-email users may only join exams they were invited to
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
    if (typeof App !== 'undefined' && App.showAccessDeniedScreen) {
      App.showAccessDeniedScreen(message);
    } else if (typeof UI !== 'undefined') {
      UI.alert(message, 'Access Denied');
    }
  },

  isSchoolEmail(email) {
    const lower = (email || '').toLowerCase();
    const domains = (window.ALLOWED_EMAIL_DOMAINS || [
      'student.laverdad.edu.ph',
      'laverdad.edu.ph'
    ]).map(d => d.toLowerCase());
    return domains.some(d => lower.endsWith('@' + d));
  },

  isSuperAdminEmail(email) {
    const lower = (email || '').toLowerCase();
    const superEmails = (window.SUPERADMIN_EMAILS || []).map(e => e.toLowerCase());
    return superEmails.includes(lower);
  },

  /** Any per-exam invite for this personal email? */
  async hasAnyExamInvite(email) {
    const lower = (email || '').toLowerCase();
    if (!lower) return false;
    try {
      const snap = await window.db.collection('examInvites')
        .where('email', '==', lower)
        .limit(1)
        .get();
      return !snap.empty;
    } catch (e) {
      console.error('Invite check failed', e);
      return false;
    }
  },

  /** Invite for a specific exam? */
  async hasExamInvite(email, examId) {
    const lower = (email || '').toLowerCase();
    if (!lower || !examId) return false;
    try {
      const docId = examId + '_' + lower.replace(/[^a-z0-9]/g, '_');
      const snap = await window.db.collection('examInvites').doc(docId).get();
      if (snap.exists) return true;
      // Fallback query
      const q = await window.db.collection('examInvites')
        .where('email', '==', lower)
        .where('examId', '==', examId)
        .limit(1)
        .get();
      return !q.empty;
    } catch (e) {
      console.error(e);
      return false;
    }
  },

  async isEmailAllowed(email) {
    if (!email) return { allowed: false, reason: 'No email provided.' };
    const lower = email.toLowerCase();

    if (this.isSuperAdminEmail(lower)) {
      return { allowed: true, reason: 'superadmin' };
    }
    if (this.isSchoolEmail(lower)) {
      return { allowed: true, reason: 'school' };
    }
    if (await this.hasAnyExamInvite(lower)) {
      return { allowed: true, reason: 'invited' };
    }

    return {
      allowed: false,
      reason:
        'Only La Verdad emails are allowed (@student.laverdad.edu.ph or @laverdad.edu.ph).\n\n' +
        'Personal email is allowed only if invited to a specific exam.'
    };
  },

  /** Personal-email students may only open exams they were invited to */
  async canAccessExam(email, examId) {
    const lower = (email || '').toLowerCase();
    if (this.isSuperAdminEmail(lower) || this.isSchoolEmail(lower)) return true;
    if (Auth.isTeacher && Auth.isTeacher()) return true;
    return await this.hasExamInvite(lower, examId);
  },

  async ensureUserProfile(user) {
    const email = (user.email || '').toLowerCase();
    // ALWAYS re-check domain/invite on every sign-in (including existing accounts)
    const check = await this.isEmailAllowed(email);

    if (!check.allowed) {
      // Prevent lingering session
      try { await window.auth.signOut(); } catch (_) {}
      throw new Error(check.reason);
    }

    const ref = window.db.collection('users').doc(user.uid);
    const snap = await ref.get();

    if (snap.exists) {
      const data = snap.data();
      // Always re-assert superadmin from config list (fixes stuck teacher role)
      if (this.isSuperAdminEmail(email) && data.role !== 'superadmin') {
        await ref.update({
          role: 'superadmin',
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        return { uid: user.uid, ...data, role: 'superadmin' };
      }
      // Personal email with invite: keep student role only
      if (check.reason === 'invited' && data.role !== 'student' && !this.isSuperAdminEmail(email)) {
        await ref.update({ role: 'student', invited: true });
        return { uid: user.uid, ...data, role: 'student', invited: true };
      }
      return { uid: user.uid, ...data, invited: check.reason === 'invited' };
    }

    let role = 'student';
    if (this.isSuperAdminEmail(email)) role = 'superadmin';

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
      if (err.message && err.message.includes('Only La Verdad')) throw err;
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

  // ---- Per-exam invites ----
  inviteDocId(examId, email) {
    return examId + '_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_');
  },

  async inviteStudentToExam(examId, examTitle, email) {
    if (!this.isTeacher()) throw new Error('Only teachers can invite students');
    email = email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Enter a valid email address');
    if (!examId) throw new Error('Exam is required');

    const docId = this.inviteDocId(examId, email);
    await window.db.collection('examInvites').doc(docId).set({
      email,
      examId,
      examTitle: examTitle || '',
      invitedBy: this.currentUser.uid,
      invitedByEmail: this.userProfile.email,
      invitedByName: this.userProfile.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: 'Invited ' + email + ' to this exam only.' };
  },

  async removeExamInvite(examId, email) {
    if (!this.isTeacher()) throw new Error('Only teachers can manage invites');
    email = email.trim().toLowerCase();
    await window.db.collection('examInvites').doc(this.inviteDocId(examId, email)).delete();
  },

  async listExamInvites(examId) {
    if (!this.isTeacher()) return [];
    const snap = await window.db.collection('examInvites')
      .where('examId', '==', examId)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async addTeacher(email) {
    if (!this.isSuperAdmin()) throw new Error('Only superadmin can add teachers');
    email = email.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Enter a valid email address.');
    const q = await window.db.collection('users').where('email', '==', email).limit(1).get();
    if (!q.empty) {
      const doc = q.docs[0];
      const data = doc.data();
      if (data.role === 'teacher' || data.role === 'superadmin') {
        throw new Error(email + ' is already assigned as ' + data.role + '.');
      }
      await doc.ref.update({
        role: 'teacher',
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      return { success: true, message: 'Updated ' + email + ' to teacher role.' };
    }
    // also check pending
    const pend = await window.db.collection('pendingTeachers').doc(email).get();
    if (pend.exists) {
      throw new Error(email + ' is already pending as a teacher.');
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
  },

  /** If user is an active proctor for any non-ended exam */
  async resolveProctorState(user) {
    try {
      const snap = await window.db.collection('examProctors')
        .where('email', '==', user.email.toLowerCase())
        .where('active', '==', true)
        .get();
      const now = Date.now();
      const active = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p => !p.endAt || Number(p.endAt) + ((p.extendedMinutes || 0) * 60000) > now);
      this.proctorAssignments = active;
      if (active.length && this.userProfile && this.userProfile.role === 'student') {
        // Mark as proctor for UI without wiping student history
        this.userProfile.isProctor = true;
        this.userProfile.role = 'proctor';
      }
      return active;
    } catch (e) {
      console.error(e);
      this.proctorAssignments = [];
      return [];
    }
  },

  isProctor() {
    return this.userProfile?.role === 'proctor' || this.userProfile?.isProctor;
  }
};

window.Auth = Auth;

