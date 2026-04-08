import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { motion } from 'framer-motion';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { Preset, Question } from '../../types/index';
import { getQuestionDomain, loadQuestionPool } from '../../utils/examLogic';
import { PRESET_SLOTS, type SlotId } from '../../constants/presets';
import DiffBadge from '../shared/DiffBadge';
import LiteCheckbox from '../shared/LiteCheckbox';

export default function PresetsTab() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSlot, setActiveSlot] = useState<SlotId>('preset_1');
  const [presets, setPresets] = useState<Partial<Record<SlotId, Preset>>>({});
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState('');
  const slot = PRESET_SLOTS.find((s) => s.id === activeSlot)!;

  useEffect(() => { void loadQuestionPool().then((pool) => { setQuestions(pool); setLoading(false); }); }, []);
  useEffect(() => {
    PRESET_SLOTS.forEach((s) => {
      void getDoc(doc(db, 'exam_presets', s.id)).then((snap) => {
        if (snap.exists()) setPresets((prev) => ({ ...prev, [s.id]: snap.data() as Preset }));
      });
    });
  }, []);
  useEffect(() => {
    const current = presets[activeSlot];
    setPresetName(current?.name ?? '');
    setSelected(new Set(current?.questions ?? []));
  }, [activeSlot, presets]);

  const topics = useMemo(() => [...new Set(questions.map((q) => getQuestionDomain(q)))].sort(), [questions]);
  const filtered = useMemo(() => questions.filter((q) =>
    (!search || q.question.toLowerCase().includes(search.toLowerCase()))
    && (!topic || getQuestionDomain(q) === topic)
    && (!difficulty || q.difficulty?.toLowerCase() === difficulty)
  ), [questions, search, topic, difficulty]);
  const allFiltered = filtered.length > 0 && filtered.every((q) => selected.has(q.id));

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    filtered.forEach((q) => allFiltered ? next.delete(q.id) : next.add(q.id));
    return next;
  });

  const savePreset = async (e: FormEvent) => {
    e.preventDefault();
    if (selected.size !== slot.targetCount || !presetName.trim()) return;
    setSaving(true); setMessage('');
    try {
      const payload: Preset = { id: activeSlot, name: presetName.trim(), questions: [...selected], targetCount: slot.targetCount, updatedAt: new Date().toISOString() };
      await setDoc(doc(db, 'exam_presets', activeSlot), payload);
      setPresets((prev) => ({ ...prev, [activeSlot]: payload }));
      setMessage('Preset saved successfully.');
    } catch (err) {
      console.error('Save error:', err);
      setMessage('Error saving preset.');
    } finally { setSaving(false); }
  };

  const deletePreset = async () => {
    if (!confirm(`Delete the preset in ${slot.label}?`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'exam_presets', activeSlot));
      setPresets((prev) => { const next = { ...prev }; delete next[activeSlot]; return next; });
      setPresetName(''); setSelected(new Set()); setMessage('Preset deleted.');
    } catch (err) { console.error('Delete error:', err); setMessage('Error deleting preset.'); }
    finally { setDeleting(false); }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Preset Slots</p>
          <div className="space-y-2">
            {PRESET_SLOTS.map((s) => (
              <button key={s.id} onClick={() => setActiveSlot(s.id)} className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all text-left ${activeSlot === s.id ? 'border-indigo-400 bg-indigo-50' : 'border-zinc-100 bg-zinc-50 hover:border-indigo-200'}`}>
                <div><span className={`text-sm font-semibold ${activeSlot === s.id ? 'text-indigo-700' : 'text-zinc-700'}`}>{s.label}</span><span className="text-[11px] text-zinc-400 ml-2">{s.targetCount}Q</span></div>
                {presets[s.id] ? <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">Active</span> : <span className="text-[10px] font-medium text-zinc-400">Empty</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{slot.label} — {slot.targetCount} Questions</p>
            {presets[activeSlot] && <button onClick={deletePreset} disabled={deleting} className="text-[11px] font-semibold text-red-500 hover:text-red-600 disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete Preset'}</button>}
          </div>
          <form onSubmit={savePreset} className="space-y-4">
            <input type="text" placeholder="e.g. Week 3 Mock Exam" value={presetName} onChange={(e) => setPresetName(e.target.value)} className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <div className={`rounded-xl px-4 py-3 border text-center ${selected.size === slot.targetCount ? 'bg-emerald-50 border-emerald-100' : 'bg-zinc-50 border-zinc-100'}`}>
              <span className={`text-sm font-bold ${selected.size === slot.targetCount ? 'text-emerald-600' : 'text-zinc-500'}`}>{selected.size} / {slot.targetCount} selected</span>
              {selected.size !== slot.targetCount && <p className="text-[11px] text-zinc-400 mt-0.5">Select exactly {slot.targetCount} questions</p>}
            </div>
            <button type="submit" disabled={selected.size !== slot.targetCount || !presetName.trim() || saving} className="w-full py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">{saving ? 'Saving...' : `Save ${slot.label} Preset`}</button>
            {message && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`text-[12px] font-medium text-center ${message.includes('Error') ? 'text-red-500' : 'text-emerald-600'}`}>{message}</motion.p>}
          </form>
        </div>
      </div>

      <div className="xl:col-span-2 space-y-4">
        <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Filter Question Pool</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="Search questions..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
            <select value={topic} onChange={(e) => setTopic(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="">All Topics</option>
              {topics.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
              <option value="">All Difficulties</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <>
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b border-zinc-100">
                <LiteCheckbox checked={allFiltered} onChange={toggleAll} />
                <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{filtered.length} question{filtered.length !== 1 ? 's' : ''} shown</span>
              </div>
              <div className="max-h-[520px] overflow-y-auto divide-y divide-zinc-50">
                {filtered.map((q) => (
                  <div key={q.id} onClick={() => setSelected((prev) => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; })} className={`flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-colors ${selected.has(q.id) ? 'bg-indigo-50/50' : 'hover:bg-zinc-50'}`}>
                    <LiteCheckbox checked={selected.has(q.id)} onChange={() => setSelected((prev) => { const next = new Set(prev); next.has(q.id) ? next.delete(q.id) : next.add(q.id); return next; })} />
                    <div className="flex-grow min-w-0">
                      <p className="text-[13px] font-medium text-zinc-700 leading-snug line-clamp-2">{q.question}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(q)}</span>
                        <DiffBadge level={q.difficulty} />
                        {Array.isArray(q.correctAnswer) && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-500 border border-indigo-100 px-2 py-0.5 rounded-full">Multi</span>}
                        <span className="text-[10px] text-zinc-300 font-medium ml-auto">#{q.id}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
