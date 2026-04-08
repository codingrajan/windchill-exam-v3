import { useEffect, useRef, useState } from 'react';
import type { FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ExamSession, Preset } from '../../types/index';
import { PRESET_SLOTS } from '../../constants/presets';

export default function SessionsTab() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [candidateText, setCandidateText] = useState<Record<string, string>>({});
  const [savingCandidates, setSavingCandidates] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPresetId, setFormPresetId] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formExpiry, setFormExpiry] = useState('');
  const [formStartsAt, setFormStartsAt] = useState('');
  const [formMaxRetakes, setFormMaxRetakes] = useState('0');

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'exam_sessions'), orderBy('createdAt', 'desc')));
      const list: ExamSession[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as ExamSession), id: d.id }));
      setSessions(list);
      const initial: Record<string, string> = {};
      list.forEach((s) => { initial[s.id] = (s.allowedCandidates ?? []).join('\n'); });
      setCandidateText(initial);
    } catch (err) { console.error('Session fetch error:', err); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    void fetchSessions();
    PRESET_SLOTS.forEach((slot) => {
      void getDoc(doc(db, 'exam_presets', slot.id)).then((snap) => {
        if (snap.exists()) setPresets((prev) => prev.find((p) => p.id === slot.id) ? prev : [...prev, snap.data() as Preset]);
      });
    });
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formPresetId || !formCode.trim()) return;
    setCreating(true); setMessage('');
    try {
      const selectedPreset = presets.find((p) => p.id === formPresetId);
      const payload: Omit<ExamSession, 'id'> = {
        name: formName.trim(),
        presetId: formPresetId,
        presetName: selectedPreset?.name ?? formPresetId,
        accessCode: formCode.trim(),
        isActive: true,
        createdAt: new Date().toISOString(),
        maxRetakes: parseInt(formMaxRetakes, 10) || 0,
        ...(formExpiry ? { expiresAt: new Date(formExpiry).toISOString() } : {}),
        ...(formStartsAt ? { startsAt: new Date(formStartsAt).toISOString() } : {}),
      };
      const ref = await addDoc(collection(db, 'exam_sessions'), payload);
      const newSession = { ...payload, id: ref.id } as ExamSession;
      setSessions((prev) => [newSession, ...prev]);
      setCandidateText((prev) => ({ ...prev, [ref.id]: '' }));
      setFormName(''); setFormPresetId(''); setFormCode('');
      setFormExpiry(''); setFormStartsAt(''); setFormMaxRetakes('0');
      setMessage('Session created successfully.');
    } catch (err) { console.error('Create session error:', err); setMessage('Error creating session.'); }
    finally { setCreating(false); }
  };

  const toggleActive = async (session: ExamSession) => {
    setToggling(session.id);
    try {
      await updateDoc(doc(db, 'exam_sessions', session.id), { isActive: !session.isActive });
      setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, isActive: !s.isActive } : s));
    } finally { setToggling(null); }
  };

  const deleteSession = async (id: string) => {
    if (!confirm('Permanently delete this session?')) return;
    setDeleting(id);
    try {
      await deleteDoc(doc(db, 'exam_sessions', id));
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } finally { setDeleting(null); }
  };

  const copyLink = (id: string) => {
    void navigator.clipboard.writeText(`${window.location.origin}/session/${id}`).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const handleCsvUpload = (sessionId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const names = text.split(/[\n,]/).map((n) => n.trim()).filter(Boolean).join('\n');
      setCandidateText((prev) => ({ ...prev, [sessionId]: names }));
    };
    reader.readAsText(file);
  };

  const saveCandidates = async (session: ExamSession) => {
    setSavingCandidates(session.id);
    try {
      const names = (candidateText[session.id] ?? '').split('\n').map((n) => n.trim()).filter(Boolean);
      await updateDoc(doc(db, 'exam_sessions', session.id), { allowedCandidates: names });
      setSessions((prev) => prev.map((s) => s.id === session.id ? { ...s, allowedCandidates: names } : s));
    } catch (err) { console.error('Save candidates error:', err); }
    finally { setSavingCandidates(null); }
  };

  const fileInputRef = useRef<Record<string, HTMLInputElement | null>>({});
  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      {/* Create form */}
      <div className="xl:col-span-1">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">Create New Session</p>
          <form onSubmit={handleCreate} className="space-y-3">
            <input type="text" placeholder="Session name, e.g. Batch Jan 2025 – A" value={formName} onChange={(e) => setFormName(e.target.value)} required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <select value={formPresetId} onChange={(e) => setFormPresetId(e.target.value)} required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="">Select a preset exam…</option>
              {PRESET_SLOTS.map((slot) => {
                const p = presets.find((x) => x.id === slot.id);
                return p ? <option key={slot.id} value={slot.id}>{p.name} ({slot.targetCount}Q)</option>
                  : <option key={slot.id} value="" disabled>{slot.label} – not configured</option>;
              })}
            </select>
            <input type="text" placeholder="Access code (shared with candidates)" value={formCode} onChange={(e) => setFormCode(e.target.value)} required className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Max Retakes (0 = unlimited)</label>
              <input type="number" min="0" value={formMaxRetakes} onChange={(e) => setFormMaxRetakes(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Opens At (optional)</label>
              <input type="datetime-local" value={formStartsAt} onChange={(e) => setFormStartsAt(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Expires At (optional)</label>
              <input type="datetime-local" value={formExpiry} onChange={(e) => setFormExpiry(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
            </div>
            <button type="submit" disabled={creating} className="w-full py-3 rounded-xl font-semibold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all disabled:opacity-50">{creating ? 'Creating...' : 'Create Session'}</button>
            {message && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[12px] font-medium text-center ${message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>{message}</motion.p>}
          </form>
        </div>
      </div>

      {/* Sessions list */}
      <div className="xl:col-span-2">
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 bg-zinc-50">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Sessions ({sessions.length})</p>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-16 text-zinc-400 text-sm font-medium">No sessions yet.</div>
          ) : (
            <div className="divide-y divide-zinc-50">
              {sessions.map((session) => (
                <div key={session.id}>
                  <div className="px-5 py-4 hover:bg-zinc-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-zinc-800">{session.name}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${session.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-zinc-100 text-zinc-400 border-zinc-200'}`}>
                            {session.isActive ? 'Active' : 'Inactive'}
                          </span>
                          {(session.allowedCandidates?.length ?? 0) > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100">
                              {session.allowedCandidates!.length} registered
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                          <p className="text-[12px] text-zinc-400">Preset: <span className="text-zinc-600">{session.presetName}</span></p>
                          <p className="text-[12px] text-zinc-400">Code: <span className="text-zinc-600 font-mono">{session.accessCode}</span></p>
                          {(session.maxRetakes ?? 0) > 0 && <p className="text-[12px] text-zinc-400">Max retakes: <span className="text-zinc-600">{session.maxRetakes}</span></p>}
                          {session.startsAt && <p className="text-[12px] text-zinc-400">Opens: <span className="text-zinc-600">{fmtDate(session.startsAt)}</span></p>}
                          {session.expiresAt && <p className="text-[12px] text-zinc-400">Expires: <span className="text-zinc-600">{fmtDate(session.expiresAt)}</span></p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <button onClick={() => setExpandedId(expandedId === session.id ? null : session.id)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 transition-all">
                          {expandedId === session.id ? 'Collapse' : 'Manage'}
                        </button>
                        <button onClick={() => copyLink(session.id)} className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all ${copied === session.id ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}>
                          {copied === session.id ? 'Copied!' : 'Copy Link'}
                        </button>
                        <button onClick={() => void toggleActive(session)} disabled={toggling === session.id} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 transition-all disabled:opacity-50">
                          {toggling === session.id ? '...' : session.isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button onClick={() => void deleteSession(session.id)} disabled={deleting === session.id} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 transition-all disabled:opacity-50">
                          {deleting === session.id ? '...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandable candidate import panel */}
                  <AnimatePresence>
                    {expandedId === session.id && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden border-t border-zinc-100">
                        <div className="px-5 py-4 bg-zinc-50/60">
                          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Registered Candidates (Bulk Import)</p>
                          <p className="text-[11px] text-zinc-500 mb-3">Enter one name per line, or upload a CSV/TXT file. If this list is non-empty, only these candidates can take the exam.</p>
                          <textarea
                            rows={6}
                            value={candidateText[session.id] ?? ''}
                            onChange={(e) => setCandidateText((prev) => ({ ...prev, [session.id]: e.target.value }))}
                            placeholder="John Smith&#10;Jane Doe&#10;..."
                            className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all placeholder:text-zinc-300 resize-none"
                          />
                          <div className="flex items-center gap-3 mt-3 flex-wrap">
                            <button onClick={() => fileInputRef.current[session.id]?.click()} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:border-indigo-300 transition-all">
                              Upload CSV / TXT
                            </button>
                            <input
                              ref={(el) => { fileInputRef.current[session.id] = el; }}
                              type="file"
                              accept=".csv,.txt"
                              className="hidden"
                              onChange={(e) => handleCsvUpload(session.id, e)}
                            />
                            <button onClick={() => void saveCandidates(session)} disabled={savingCandidates === session.id} className="text-[11px] font-semibold px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all disabled:opacity-50">
                              {savingCandidates === session.id ? 'Saving...' : 'Save List'}
                            </button>
                            {(candidateText[session.id] ?? '').split('\n').filter(Boolean).length > 0 && (
                              <span className="text-[11px] text-zinc-400">{(candidateText[session.id] ?? '').split('\n').filter(Boolean).length} candidate{(candidateText[session.id] ?? '').split('\n').filter(Boolean).length !== 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
