// src/pages/SessionEntry.tsx
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ExamSession, Preset } from '../types/index';

type PageState = 'loading' | 'ready' | 'invalid' | 'expired' | 'inactive' | 'not_open';

const ERROR_MESSAGES: Record<'invalid' | 'inactive' | 'expired' | 'not_open', { title: string; body: (session?: ExamSession) => string }> = {
  invalid:  { title: 'Session Not Found',  body: () => 'This exam link is invalid or has been removed. Please contact your administrator.' },
  inactive: { title: 'Session Inactive',   body: () => 'This exam session has been deactivated. Please contact your administrator.' },
  expired:  { title: 'Session Expired',    body: () => 'This exam session has expired. Please contact your administrator.' },
  not_open: { title: 'Session Not Open Yet', body: (s) => s?.startsAt ? `This session opens on ${new Date(s.startsAt).toLocaleString('en-IN', { dateStyle: 'long', timeStyle: 'short' })}.` : 'This session has not opened yet.' },
};

export default function SessionEntry() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [pageState, setPageState] = useState<PageState>('loading');
  const [session, setSession] = useState<ExamSession | null>(null);
  const [candidateName, setCandidateName] = useState('');
  const [candidateEmail, setCandidateEmail] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const preset = useRef<Preset | null>(null);

  useEffect(() => {
    if (!sessionId) { setPageState('invalid'); return; }
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'exam_sessions', sessionId));
        if (!snap.exists()) { setPageState('invalid'); return; }
        const data = { ...(snap.data() as ExamSession), id: snap.id };
        if (!data.isActive) { setPageState('inactive'); return; }
        if (data.expiresAt && new Date(data.expiresAt) < new Date()) { setPageState('expired'); return; }
        if (data.startsAt && new Date(data.startsAt) > new Date()) { setSession(data); setPageState('not_open'); return; }
        const presetSnap = await getDoc(doc(db, 'exam_presets', data.presetId));
        if (!presetSnap.exists()) { setPageState('invalid'); return; }
        preset.current = presetSnap.data() as Preset;
        setSession(data);
        setPageState('ready');
      } catch (err) { console.error('Session load error:', err); setPageState('invalid'); }
    };
    void load();
  }, [sessionId]);

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    if (!session || !preset.current) return;
    setError('');
    if (!candidateName.trim()) { setError('Please enter your name.'); return; }
    if (accessCode.trim() !== session.accessCode) { setError('Incorrect access code. Please try again.'); return; }

    // Check allowedCandidates (bulk import gate)
    if (session.allowedCandidates && session.allowedCandidates.length > 0) {
      const norm = session.allowedCandidates.map((n) => n.trim().toLowerCase());
      if (!norm.includes(candidateName.trim().toLowerCase())) {
        setError('You are not registered for this session. Contact your administrator.');
        return;
      }
    }

    setStarting(true);
    try {
      // Check retake limit — query session_participants; gracefully default if read is denied
      const maxRetakes = session.maxRetakes ?? 0;
      let retakeNumber = 1;
      try {
        const pSnap = await getDocs(query(
          collection(db, 'session_participants'),
          where('sessionId', '==', session.id),
          where('candidateName', '==', candidateName.trim()),
        ));
        const completed = pSnap.docs.filter((d) => d.data().status === 'completed').length;
        retakeNumber = completed + 1;
        if (maxRetakes > 0 && completed >= maxRetakes) {
          setError(`You have used all ${maxRetakes} attempt${maxRetakes > 1 ? 's' : ''} for this session.`);
          setStarting(false);
          return;
        }
      } catch {
        // Read permission not yet granted — proceed as first attempt
        retakeNumber = 1;
      }

      // Create participant record
      const participantRef = await addDoc(collection(db, 'session_participants'), {
        sessionId: session.id,
        sessionName: session.name,
        candidateName: candidateName.trim(),
        ...(candidateEmail.trim() ? { candidateEmail: candidateEmail.trim().toLowerCase() } : {}),
        startedAt: new Date().toISOString(),
        status: 'in_progress',
        retakeNumber,
      });

      navigate('/quiz', {
        state: {
          examineeName: candidateName.trim(),
          mode: 'preset',
          targetCount: preset.current.targetCount,
          presetId: session.presetId,
          presetQuestionIds: preset.current.questions,
          sessionId: session.id,
          sessionName: session.name,
          candidateEmail: candidateEmail.trim().toLowerCase() || undefined,
          participantId: participantRef.id,
        },
      });
    } catch (err) {
      console.error('Session start error:', err);
      setError('Could not start the session. Please try again.');
      setStarting(false);
    }
  };

  if (pageState === 'loading') {
    return <div className="flex h-64 items-center justify-center"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (pageState !== 'ready') {
    const msg = ERROR_MESSAGES[pageState as keyof typeof ERROR_MESSAGES];
    return (
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
        <div className="text-center max-w-sm">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-red-50 border border-red-100 rounded-2xl mb-4">
            <span className="text-2xl">&#x26A0;</span>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 mb-2">{msg.title}</h2>
          <p className="text-sm text-zinc-500 font-medium">{msg.body(session ?? undefined)}</p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="flex items-center justify-center min-h-[70vh] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
            <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">{session!.name}</h2>
          <p className="text-zinc-500 text-sm font-medium mt-1">
            {preset.current!.targetCount} Questions &middot; Secured Exam
            {(session!.maxRetakes ?? 0) > 0 && <> &middot; Max {session!.maxRetakes} attempt{session!.maxRetakes! > 1 ? 's' : ''}</>}
          </p>
        </div>

        <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8">
          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Your Full Name</label>
              <input type="text" value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="e.g. Rajan Agarwal" required autoFocus className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">
                Email <span className="text-zinc-300 normal-case font-normal">(optional — for result history)</span>
              </label>
              <input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="your@email.com" className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5">Access Code</label>
              <input type="password" value={accessCode} onChange={(e) => setAccessCode(e.target.value)} placeholder="Enter the code provided to you" required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300" />
            </div>
            <AnimatePresence>
              {error && <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="text-xs font-semibold text-red-500 text-center">{error}</motion.p>}
            </AnimatePresence>
            <button type="submit" disabled={starting} className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm tracking-wide shadow-sm shadow-indigo-100 transition-all disabled:opacity-60">
              {starting ? 'Starting...' : 'Start Exam \u2192'}
            </button>
          </form>
        </div>
        <p className="text-center text-[11px] text-zinc-400 mt-5 font-medium">Once started, the exam timer cannot be paused.</p>
      </div>
    </motion.div>
  );
}
