/**
 * Exam CRUD and Student Session Management
 * All Firestore access goes through window.db
 */

const Exam = {
  // Teacher creates a new exam
  async createExam({ title, instructions, starterCode = '# Write your Python solution here\n\n' }) {
    if (!Auth.isTeacher()) throw new Error('Only teachers can create exams');

    const examRef = window.db.collection('exams').doc();
    const data = {
      title: title.trim(),
      instructions: instructions.trim(),
      starterCode,
      teacherId: Auth.currentUser.uid,
      teacherEmail: Auth.userProfile.email,
      teacherName: Auth.userProfile.name,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await examRef.set(data);
    return { id: examRef.id, ...data };
  },

  async updateExam(examId, updates) {
    await window.db.collection('exams').doc(examId).update({
      ...updates,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async deleteExam(examId) {
    await window.db.collection('exams').doc(examId).delete();
  },

  async getExam(examId) {
    const snap = await window.db.collection('exams').doc(examId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  },

  async listMyExams() {
    const snap = await window.db.collection('exams')
      .where('teacherId', '==', Auth.currentUser.uid)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // Student joins an exam → creates a live session
  async joinExam(examId) {
    if (!Auth.currentUser) throw new Error('Must be logged in');

    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    if (!exam.active) throw new Error('This exam is no longer active');

    // Check if already has an active session
    const existing = await window.db.collection('sessions')
      .where('examId', '==', examId)
      .where('studentId', '==', Auth.currentUser.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existing.empty) {
      return { id: existing.docs[0].id, ...existing.docs[0].data(), exam };
    }

    // Create new session
    const sessionRef = window.db.collection('sessions').doc();
    const session = {
      examId,
      examTitle: exam.title,
      studentId: Auth.currentUser.uid,
      studentEmail: Auth.userProfile.email,
      studentName: Auth.userProfile.name,
      code: exam.starterCode || '',
      status: 'active',
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      events: []
    };
    await sessionRef.set(session);
    return { id: sessionRef.id, ...session, exam };
  },

  // Student updates their code (debounced from editor)
  async updateSessionCode(sessionId, code) {
    await window.db.collection('sessions').doc(sessionId).update({
      code,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async submitSession(sessionId) {
    await window.db.collection('sessions').doc(sessionId).update({
      status: 'submitted',
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  // Log anti-cheat event
  async logEvent(sessionId, type, details = '') {
    const event = {
      type,
      details,
      timestamp: new Date().toISOString()
    };

    // Append to session events (keep last 50)
    const ref = window.db.collection('sessions').doc(sessionId);
    await window.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const events = snap.data().events || [];
      events.push(event);
      if (events.length > 50) events.splice(0, events.length - 50);
      tx.update(ref, { events, lastEvent: event });
    });

    // Also write a notification for the teacher
    const sessionSnap = await ref.get();
    if (sessionSnap.exists) {
      const s = sessionSnap.data();
      await window.db.collection('notifications').add({
        examId: s.examId,
        teacherId: null,
        sessionId,
        studentId: s.studentId,
        studentEmail: s.studentEmail,
        studentName: s.studentName,
        type,
        details,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  },

  // Real-time listeners
  listenToSessions(examId, callback) {
    return window.db.collection('sessions')
      .where('examId', '==', examId)
      .onSnapshot(snap => {
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(sessions);
      });
  },

  listenToSession(sessionId, callback) {
    return window.db.collection('sessions').doc(sessionId)
      .onSnapshot(snap => {
        if (snap.exists) callback({ id: snap.id, ...snap.data() });
      });
  },

  listenToNotifications(examIds, callback) {
    return window.db.collection('notifications')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(snap => {
        const notifs = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(n => examIds.includes(n.examId));
        callback(notifs);
      });
  }
};

window.Exam = Exam;
