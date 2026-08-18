/**
 * Exam CRUD, sessions, grading, duration
 */

const Exam = {
  async createExam({
    title,
    instructions,
    starterCode = '# Write your Python solution here\n\n',
    durationMinutes = 60,
    maxScore = 50,
    answerKey = ''
  }) {
    if (!Auth.isTeacher()) throw new Error('Only teachers can create exams');

    const examRef = window.db.collection('exams').doc();
    const data = {
      title: title.trim(),
      instructions: instructions.trim(),
      starterCode,
      durationMinutes: Number(durationMinutes) || 60,
      maxScore: Number(maxScore) || 50,
      answerKey: answerKey || '',
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
    try {
      const snap = await window.db.collection('exams')
        .where('teacherId', '==', Auth.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      // Fallback without orderBy if index missing
      if (String(err.message || err).includes('index')) {
        const snap = await window.db.collection('exams')
          .where('teacherId', '==', Auth.currentUser.uid)
          .get();
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => {
          const ta = a.createdAt?.toMillis?.() || 0;
          const tb = b.createdAt?.toMillis?.() || 0;
          return tb - ta;
        });
        return list;
      }
      throw err;
    }
  },

  async joinExam(examId) {
    if (!Auth.currentUser) throw new Error('Must be logged in');

    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    if (!exam.active) throw new Error('This exam is no longer active');

    const allowed = await Auth.canAccessExam(Auth.userProfile.email, examId);
    if (!allowed) {
      throw new Error(
        'You are not invited to this exam. Personal email access is limited to exams your teacher invited you to.'
      );
    }

    const existing = await window.db.collection('sessions')
      .where('examId', '==', examId)
      .where('studentId', '==', Auth.currentUser.uid)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    if (!existing.empty) {
      return { id: existing.docs[0].id, ...existing.docs[0].data(), exam };
    }

    // Also resume submitted? No — new active only if none active
    const durationMs = (Number(exam.durationMinutes) || 60) * 60 * 1000;
    const endsAt = Date.now() + durationMs;

    const sessionRef = window.db.collection('sessions').doc();
    const session = {
      examId,
      examTitle: exam.title,
      studentId: Auth.currentUser.uid,
      studentEmail: Auth.userProfile.email,
      studentName: Auth.userProfile.name,
      code: exam.starterCode || '',
      status: 'active',
      durationMinutes: exam.durationMinutes || 60,
      endsAt,
      extendedMinutes: 0,
      pasteRanges: [],
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
      startedAt: firebase.firestore.FieldValue.serverTimestamp(),
      events: []
    };
    await sessionRef.set(session);
    return { id: sessionRef.id, ...session, exam };
  },

  async updateSessionCode(sessionId, code) {
    await window.db.collection('sessions').doc(sessionId).update({
      code,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async submitSession(sessionId, reason = 'manual') {
    await window.db.collection('sessions').doc(sessionId).update({
      status: 'submitted',
      submitReason: reason,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async extendSession(sessionId, extraMinutes) {
    const ref = window.db.collection('sessions').doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Session not found');
    const s = snap.data();
    const currentEnds = s.endsAt || Date.now();
    const base = Math.max(currentEnds, Date.now());
    const newEnds = base + (Number(extraMinutes) || 0) * 60 * 1000;
    await ref.update({
      endsAt: newEnds,
      extendedMinutes: (s.extendedMinutes || 0) + Number(extraMinutes),
      status: s.status === 'submitted' && reasonAlive(s) ? 'active' : s.status
    });
    // If was time-expired locally, teacher extend should reopen
    if (s.status === 'submitted' && s.submitReason === 'timeout') {
      await ref.update({ status: 'active', submitReason: firebase.firestore.FieldValue.delete() });
    }
    return newEnds;
  },

  async logEvent(sessionId, type, details = '', extra = {}) {
    const event = {
      type,
      details,
      timestamp: new Date().toISOString(),
      ...extra
    };

    const ref = window.db.collection('sessions').doc(sessionId);
    await window.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const events = data.events || [];
      events.push(event);
      if (events.length > 80) events.splice(0, events.length - 80);
      const updates = { events, lastEvent: event };
      if (extra.pasteRange) {
        const ranges = data.pasteRanges || [];
        ranges.push(extra.pasteRange);
        if (ranges.length > 30) ranges.splice(0, ranges.length - 30);
        updates.pasteRanges = ranges;
      }
      tx.update(ref, updates);
    });

    const sessionSnap = await ref.get();
    if (sessionSnap.exists) {
      const s = sessionSnap.data();
      await window.db.collection('notifications').add({
        examId: s.examId,
        sessionId,
        studentId: s.studentId,
        studentEmail: s.studentEmail,
        studentName: s.studentName,
        type,
        details,
        extra,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
  },

  listenToSessions(examId, callback) {
    return window.db.collection('sessions')
      .where('examId', '==', examId)
      .onSnapshot(snap => {
        const sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(sessions);
      }, err => console.error(err));
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
      }, () => callback([]));
  },

  // ---- Grading ----
  normalizeCode(code) {
    return (code || '')
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map(l => l.replace(/\s+$/g, ''))
      .join('\n')
      .trim();
  },

  autoGrade(studentCode, answerKey, maxScore) {
    maxScore = Number(maxScore) || 50;
    const a = this.normalizeCode(studentCode);
    const b = this.normalizeCode(answerKey);
    if (!b) return { score: null, percent: null, method: 'none', note: 'No answer key set' };
    if (a === b) return { score: maxScore, percent: 100, method: 'exact', note: 'Exact match' };

    // Token overlap heuristic
    const tokensA = new Set(a.split(/\s+/).filter(Boolean));
    const tokensB = b.split(/\s+/).filter(Boolean);
    if (tokensB.length === 0) return { score: 0, percent: 0, method: 'empty-key' };
    let hit = 0;
    tokensB.forEach(t => { if (tokensA.has(t)) hit++; });
    const ratio = hit / tokensB.length;
    const score = Math.round(ratio * maxScore * 10) / 10;
    const percent = Math.round(ratio * 1000) / 10;
    return { score, percent, method: 'token-overlap', note: `Similarity ~${percent}%` };
  },

  async saveGrade(sessionId, examId, payload) {
    const id = sessionId;
    await window.db.collection('grades').doc(id).set({
      sessionId,
      examId,
      studentId: payload.studentId,
      studentEmail: payload.studentEmail,
      studentName: payload.studentName,
      score: payload.score,
      maxScore: payload.maxScore,
      percent: payload.percent,
      comment: payload.comment || '',
      method: payload.method || 'manual',
      gradedBy: Auth.currentUser.uid,
      gradedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  },

  async getGrade(sessionId) {
    const snap = await window.db.collection('grades').doc(sessionId).get();
    if (!snap.exists) return null;
    return { id: snap.id, ...snap.data() };
  },

  async listGrades(examId) {
    const snap = await window.db.collection('grades').where('examId', '==', examId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
};

function reasonAlive() { return true; }

window.Exam = Exam;
