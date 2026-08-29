/**
 * Exam CRUD, sessions, grading, global time window, types
 */

const Exam = {
  async createExam(opts) {
    if (!Auth.isTeacher()) throw new Error('Only teachers can create exams');
    const {
      title, instructions,
      starterCode = '',
      examType = 'code', // code | regular
      language = 'python', // python | java
      startAt = null, // ms timestamp or ISO
      endAt = null,
      durationMinutes = 60,
      maxScore = 100,
      answerKey = '',
      questions = [],
      sections = [],
      subject = 'General',
      status = 'published',
      active = true
    } = opts;

    const startMs = startAt ? new Date(startAt).getTime() : Date.now();
    const endMs = endAt ? new Date(endAt).getTime() : (startMs + (Number(durationMinutes) || 60) * 60000);

    // Unique 8-digit assessment code
    let assessmentCode = '';
    for (let attempt = 0; attempt < 8; attempt++) {
      assessmentCode = String(Math.floor(10000000 + Math.random() * 90000000));
      const exists = await window.db.collection('exams').where('assessmentCode', '==', assessmentCode).limit(1).get();
      if (exists.empty) break;
    }
    const examRef = window.db.collection('exams').doc();
    const data = {
      assessmentCode,
      title: (title || '').trim(),
      instructions: (instructions || '').trim(),
      starterCode: starterCode || (examType === 'code'
        ? (language === 'java'
          ? 'public class Main {\n  public static void main(String[] args) {\n    // Write your solution\n  }\n}\n'
          : '# Write your Python solution here\n\ndef solution():\n    pass\n')
        : ''),
      examType,
      language: language === 'java' ? 'java' : 'python',
      subject: subject || 'General',
      startAt: startMs,
      endAt: endMs,
      durationMinutes: Math.max(1, Math.round((endMs - startMs) / 60000)),
      maxScore: Number(maxScore) || 100,
      answerKey: answerKey || '',
      questions: questions || [],
      sections: sections || [],
      proctors: [], // [{ email, studentIds: [] }]
      teacherId: Auth.currentUser.uid,
      teacherEmail: Auth.userProfile.email,
      teacherName: Auth.userProfile.name,
      status: status || 'published',
      active: active !== false && status !== 'draft',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await examRef.set(data);
    return { id: examRef.id, ...data };
  },

  async updateExam(examId, updates) {
    const clean = { ...updates };
    Object.keys(clean).forEach(k => {
      if (clean[k] === undefined) delete clean[k];
    });
    clean.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    await window.db.collection('exams').doc(examId).update(clean);
  },

  async duplicateExam(examId, overrides = {}) {
    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    const { id, createdAt, updatedAt, ...rest } = exam;
    const startMs = overrides.startAt ? new Date(overrides.startAt).getTime() : Date.now();
    const endMs = overrides.endAt
      ? new Date(overrides.endAt).getTime()
      : startMs + (Number(overrides.durationMinutes || rest.durationMinutes || 60) * 60000);
    return this.createExam({
      ...rest,
      ...overrides,
      title: (overrides.title || rest.title) + ' (Copy)',
      startAt: startMs,
      endAt: endMs
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

  async listInstructorExams(...args) { return this.listMyExams(...args); },
  async listTeacherExams(...args) { return this.listMyExams(...args); },

  async listMyExams() {
    try {
      const snap = await window.db.collection('exams')
        .where('teacherId', '==', Auth.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      const snap = await window.db.collection('exams')
        .where('teacherId', '==', Auth.currentUser.uid)
        .get();
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      return list;
    }
  },

  async listAllExamsForTeacher() {
    // All exams teacher owns (same as listMyExams for now)
    return this.listMyExams();
  },

  /** Global window: all students share exam.startAt / exam.endAt */
  getExamWindow(exam) {
    const startAt = Number(exam.startAt) || Date.now();
    let endAt = Number(exam.endAt);
    if (!endAt) endAt = startAt + (Number(exam.durationMinutes) || 60) * 60000;
    // teacher extensions stored on exam.extendedMinutes
    if (exam.extendedMinutes) endAt += Number(exam.extendedMinutes) * 60000;
    return { startAt, endAt };
  },

  async joinExam(examId) {
    if (!Auth.currentUser) throw new Error('Must be logged in');

    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    if (!exam.active) throw new Error('This exam is no longer active');

    const allowed = await Auth.canAccessExam(Auth.userProfile.email, examId);
    if (!allowed) {
      throw new Error('You are not invited to this exam.');
    }

    const { startAt, endAt } = this.getExamWindow(exam);
    const now = Date.now();
    if (now < startAt) {
      throw new Error('This exam has not started yet. Opens at ' + new Date(startAt).toLocaleString());
    }
    if (now > endAt) {
      throw new Error("This exam has ended.");
    }

    // Proctor cannot take exam as student on same account unless student role
    if (Auth.userProfile.role === 'proctor') {
      throw new Error('Proctor accounts cannot take exams.');
    }

    const existing = await window.db.collection('sessions')
      .where('examId', '==', examId)
      .where('studentId', '==', Auth.currentUser.uid)
      .limit(1)
      .get();

    if (!existing.empty) {
      const s = { id: existing.docs[0].id, ...existing.docs[0].data(), exam };
      if (s.status === 'submitted' || s.status === 'ended' || s.submitReason === 'teacher-ended') {
        const err = new Error('You already submitted this assessment.');
        err.code = 'already-submitted';
        err.session = s;
        throw err;
      }
      return s;
    }

    const sessionRef = window.db.collection('sessions').doc();
    const session = {
      examId,
      examTitle: exam.title,
      examType: exam.examType || 'code',
      language: exam.language || 'python',
      subject: exam.subject || 'General',
      studentId: Auth.currentUser.uid,
      studentEmail: Auth.userProfile.email,
      studentName: Auth.userProfile.name,
      code: exam.starterCode || '',
      answers: {}, // regular assessment answers keyed by question id
      status: 'active',
      startAt,
      endsAt: endAt,
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

  async updateSessionAnswers(sessionId, answers) {
    await window.db.collection('sessions').doc(sessionId).update({
      answers,
      lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
    });
  },

  async submitSession(sessionId, reason = 'manual') {
    try { if (window.Monitor) Monitor.markSubmitting(); } catch (_) {}
    try { if (window.CodeEditor) CodeEditor.beginSubmit(); } catch (_) {}
    await window.db.collection('sessions').doc(sessionId).update({
      status: 'submitted',
      submitReason: reason,
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      screenThumb: null,
      cameraThumb: null,
      monitorFeed: 'SUBMITTED',
      isWindowFocused: false,
      monitoringStopped: true
    });
    try {
      await window.db.collection('liveScreens').doc(sessionId).delete();
    } catch (_) {}
  },

  /** Extend entire exam window for all students */
  async extendExam(examId, extraMinutes) {
    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    const add = Number(extraMinutes) || 0;
    const prev = Number(exam.extendedMinutes) || 0;
    const newEnd = (Number(exam.endAt) || Date.now()) + (prev + add) * 0; // recalculate below
    const baseEnd = Number(exam.endAt) || Date.now();
    // Store cumulative extension
    await this.updateExam(examId, {
      extendedMinutes: prev + add,
      endAt: baseEnd + add * 60000
    });
    // Update active sessions endsAt
    const snap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const batch = window.db.batch();
    snap.docs.forEach(d => {
      const s = d.data();
      if (s.status === 'active' || s.submitReason === 'timeout') {
        batch.update(d.ref, {
          endsAt: (s.endsAt || baseEnd) + add * 60000,
          status: 'active',
          submitReason: firebase.firestore.FieldValue.delete()
        });
      }
    });
    await batch.commit();
    return add;
  },

  async extendSession(sessionId, extraMinutes) {
    const ref = window.db.collection('sessions').doc(sessionId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Session not found');
    const s = snap.data();
    const base = Math.max(s.endsAt || Date.now(), Date.now());
    const newEnds = base + (Number(extraMinutes) || 0) * 60000;
    await ref.update({
      endsAt: newEnds,
      status: 'active',
      extendedMinutes: (s.extendedMinutes || 0) + Number(extraMinutes)
    });
    return newEnds;
  },

  async logEvent(sessionId, type, details = '', extra = {}) {
    try {
      const snap = await window.db.collection('sessions').doc(sessionId).get();
      if (snap.exists && (snap.data().status === 'submitted' || snap.data().monitoringStopped)) return;
    } catch (_) {}
    this._lastLog = this._lastLog || {};
    const dedupeKey = sessionId + '|' + type + '|' + details;
    const now = Date.now();
    if (this._lastLog[dedupeKey] && now - this._lastLog[dedupeKey] < 5000) return;
    this._lastLog[dedupeKey] = now;
    const event = { type, details, timestamp: new Date().toISOString(), ...extra };
    const ref = window.db.collection('sessions').doc(sessionId);
    await window.db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) return;
      const data = snap.data();
      const events = data.events || [];
      events.push(event);
      if (events.length > 80) events.splice(0, events.length - 80);
      const updates = { events, lastEvent: event };
      if (type === 'paste' || type === 'paste-key') {
        updates.pasteWarnings = (data.pasteWarnings || 0) + 1;
      }
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
      const payload = {
        examId: s.examId,
        sessionId,
        studentId: s.studentId,
        studentEmail: s.studentEmail,
        studentName: s.studentName,
        type,
        details,
        extra,
        screenshot: extra.screenshot || null,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      try {
        await window.db.collection('notifications').add(payload);
      } catch (e) { console.warn('notif write', e); }
      try {
        await window.db.collection('integrityHistory').add(payload);
      } catch (e) {
        console.warn('integrityHistory write', e);
        // retry without screenshot if too large
        try {
          const slim = { ...payload, screenshot: null, extra: { ...(payload.extra || {}), screenshot: null } };
          await window.db.collection('integrityHistory').add(slim);
        } catch (e2) { console.warn('integrityHistory slim failed', e2); }
      }
    }
  },

  listenToSessions(examId, callback) {
    return window.db.collection('sessions')
      .where('examId', '==', examId)
      .onSnapshot(snap => {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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

  normalizeCode(code) {
    return (code || '').replace(/\r\n/g, '\n').split('\n').map(l => l.replace(/\s+$/g, '')).join('\n').trim();
  },

  autoGrade(studentCode, answerKey, maxScore) {
    maxScore = Number(maxScore) || 100;
    const a = this.normalizeCode(studentCode);
    const b = this.normalizeCode(answerKey);
    if (!b) return { score: null, percent: null, method: 'none', note: 'No answer key set' };
    if (a === b) return { score: maxScore, percent: 100, method: 'exact', note: 'Exact match' };
    const tokensA = new Set(a.split(/\s+/).filter(Boolean));
    const tokensB = b.split(/\s+/).filter(Boolean);
    if (!tokensB.length) return { score: 0, percent: 0, method: 'empty-key' };
    let hit = 0;
    tokensB.forEach(t => { if (tokensA.has(t)) hit++; });
    const ratio = hit / tokensB.length;
    return {
      score: Math.round(ratio * maxScore * 10) / 10,
      percent: Math.round(ratio * 1000) / 10,
      method: 'token-overlap',
      note: `Similarity ~${Math.round(ratio * 1000) / 10}%`
    };
  },

  async saveGrade(sessionId, examId, payload) {
    await window.db.collection('grades').doc(sessionId).set({
      sessionId, examId,
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
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  },

  async listGrades(examId) {
    const snap = await window.db.collection('grades').where('examId', '==', examId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  // ---- Proctors ----
  async setProctors(examId, proctorEmails) {
    const exam = await this.getExam(examId);
    if (!exam) throw new Error('Exam not found');
    const emails = [...new Set(proctorEmails.map(e => e.trim().toLowerCase()).filter(Boolean))];

    // Get active/all student sessions for distribution
    const snap = await window.db.collection('sessions').where('examId', '==', examId).get();
    const studentIds = snap.docs.map(d => d.data().studentId);

    // Equal distribution
    const proctors = emails.map(email => ({ email, studentIds: [] }));
    if (proctors.length && studentIds.length) {
      studentIds.forEach((sid, i) => {
        proctors[i % proctors.length].studentIds.push(sid);
      });
    }

    await this.updateExam(examId, { proctors });

    // Store proctor invites so they can sign in
    for (const p of proctors) {
      await window.db.collection('examProctors').doc(examId + '_' + p.email.replace(/[^a-z0-9]/g, '_')).set({
        examId,
        email: p.email,
        studentIds: p.studentIds,
        examTitle: exam.title,
        teacherId: exam.teacherId,
        active: true,
        endAt: exam.endAt,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    return proctors;
  },

  async redistributeProctors(examId) {
    const exam = await this.getExam(examId);
    if (!exam?.proctors?.length) return [];
    const emails = exam.proctors.map(p => p.email);
    return this.setProctors(examId, emails);
  },

  async removeProctor(examId, email) {
    const exam = await this.getExam(examId);
    const remaining = (exam.proctors || []).filter(p => p.email !== email.toLowerCase());
    await this.updateExam(examId, { proctors: remaining });
    await window.db.collection('examProctors').doc(examId + '_' + email.toLowerCase().replace(/[^a-z0-9]/g, '_')).delete();
    if (remaining.length) await this.setProctors(examId, remaining.map(p => p.email));
  },

  async getProctorAssignment(email) {
    const snap = await window.db.collection('examProctors')
      .where('email', '==', email.toLowerCase())
      .where('active', '==', true)
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  },

  async deactivateProctorsForExam(examId) {
    const snap = await window.db.collection('examProctors').where('examId', '==', examId).get();
    const batch = window.db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { active: false }));
    await batch.commit();
    await this.updateExam(examId, { proctors: [] });
  },

  // Student history
  async listStudentSessions(studentId) {
    const snap = await window.db.collection('sessions')
      .where('studentId', '==', studentId)
      .get();
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.startedAt?.toMillis?.() || 0) - (a.startedAt?.toMillis?.() || 0));
    return list;
  }
};

window.Exam = Exam;


/**
 * Store large images in Firebase Storage so the exam Firestore doc stays under 1 MB.
 * Storage rules (Console → Storage → Rules) should allow auth users to write under assessments/:
 *
 * rules_version = '2';
 * service firebase.storage {
 *   match /b/{bucket}/o {
 *     match /assessments/{examId}/{allPaths=**} {
 *       allow read: if request.auth != null;
 *       allow write: if request.auth != null;
 *     }
 *   }
 * }
 */
const MediaStore = {
  available() {
    try { return !!(window.firebase && firebase.storage); } catch (_) { return false; }
  },

  dataUrlToBlob(dataUrl) {
    const m = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const mime = m[1] || 'image/jpeg';
    const bin = atob(m[2]);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  },

  async uploadDataUrl(examId, dataUrl, nameHint) {
    if (!this.available()) throw new Error('Firebase Storage SDK not loaded.');
    if (!dataUrl || !String(dataUrl).startsWith('data:image')) return dataUrl;
    const blob = this.dataUrlToBlob(dataUrl);
    if (!blob) return dataUrl;
    const safe = String(nameHint || 'img').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'img';
    const path = `assessments/${examId}/${safe}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
    const ref = firebase.storage().ref(path);
    await ref.put(blob, { contentType: blob.type || 'image/jpeg' });
    return await ref.getDownloadURL();
  },

  /** Walk payload; upload every data:image string; replace with download URL. */
  async externalizeImages(examId, payload, onProgress) {
    if (!examId) throw new Error('examId required for media upload');
    const seen = new Map(); // dataUrl -> url (dedupe identical embeds)
    let uploaded = 0;

    const handle = async (dataUrl, hint) => {
      if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return dataUrl;
      if (seen.has(dataUrl)) return seen.get(dataUrl);
      // skip tiny placeholders
      if (dataUrl.length < 200) return dataUrl;
      const url = await this.uploadDataUrl(examId, dataUrl, hint);
      seen.set(dataUrl, url);
      uploaded++;
      if (onProgress) onProgress(uploaded);
      return url;
    };

    const walk = async (node, path = '') => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++) {
          if (typeof node[i] === 'string' && node[i].startsWith('data:image')) {
            node[i] = await handle(node[i], path + '_' + i);
          } else {
            await walk(node[i], path + '_' + i);
          }
        }
        return;
      }
      for (const k of Object.keys(node)) {
        const v = node[k];
        if (typeof v === 'string' && v.startsWith('data:image')) {
          node[k] = await handle(v, path + '_' + k);
        } else if (v && typeof v === 'object') {
          await walk(v, path + '_' + k);
        }
      }
    };

    // Prefer Storage when available; otherwise keep compressed in-doc (may still hit 1MB)
    if (!this.available()) {
      console.warn('Firebase Storage not available — images stay in Firestore document');
      return { payload, uploaded: 0, usedStorage: false };
    }

    await walk(payload, 'root');
    return { payload, uploaded, usedStorage: true };
  }
};

window.MediaStore = MediaStore;
