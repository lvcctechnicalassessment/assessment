/**
 * Authentication & Role Management
 * All Firebase objects are accessed via window.* to avoid scope issues.
 */

const Auth = {
  currentUser: null,
  userProfile: null,

  async init() {
    if (!window.auth) {
      throw new Error('Firebase Auth is not initialized. Check firebase-config.js and that the Firebase CDN scripts loaded.');
    }
    return new Promise((resolve) => {
      window.auth.onAuthStateChanged(async (user) => {
        if (user) {
          this.currentUser = user;
          this.userProfile = await this.ensureUserProfile(user);
          resolve(this.userProfile);
        } else {
          this.currentUser = null;
          this.userProfile = null;
          resolve(null);
        }
      });
    });
  },

  async ensureUserProfile(user) {
    const ref = window.db.collection('users').doc(user.uid);
    const snap = await ref.get();

    if (snap.exists) {
      return { uid: user.uid, ...snap.data() };
    }

    // New user – determine role
    let role = 'student';
    const superEmails = (window.SUPERADMIN_EMAILS || []).map(e => e.toLowerCase());
    if (superEmails.includes((user.email || '').toLowerCase())) {
      role = 'superadmin';
    }

    // Domain check
    if (window.ALLOWED_DOMAIN && !user.email.endsWith('@' + window.ALLOWED_DOMAIN)) {
      await window.auth.signOut();
      throw new Error(`Only @${window.ALLOWED_DOMAIN} accounts are allowed.`);
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
    if (window.ALLOWED_DOMAIN) {
      provider.setCustomParameters({ hd: window.ALLOWED_DOMAIN });
    }
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

  // Superadmin: promote a user to teacher by email
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
      return { success: true, message: `Updated ${email} to teacher role.` };
    }

    // User hasn't logged in yet – store pending teacher invite
    await window.db.collection('pendingTeachers').doc(email).set({
      email,
      addedBy: this.currentUser.uid,
      addedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: `Invitation stored for ${email}. They will become teacher on first login.` };
  },

  async removeTeacher(uid) {
    if (!this.isSuperAdmin()) throw new Error('Only superadmin');
    await window.db.collection('users').doc(uid).update({
      role: 'student',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async listTeachers() {
    const snap = await window.db.collection('users').where('role', 'in', ['teacher', 'superadmin']).get();
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  },

  // On login, check pending teacher invites
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
