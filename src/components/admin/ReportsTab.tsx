import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ExamResult } from '../../types/index';
import LiteCheckbox from '../shared/LiteCheckbox';

interface ExamResultDoc extends ExamResult { docId: string; }
type FilterScore = 'all' | 'pass' | 'fail';

export default function ReportsTab() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ExamResultDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [sessionFilter, setSessionFilter] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [scoreFilter, setScoreFilter] = useState<FilterScore>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchRecords = () => {
    setLoading(true);
    getDocs(query(collection(db, 'exam_results'), orderBy('examDate', 'desc')))
      .then((snap) => {
        const next: ExamResultDoc[] = [];
        snap.forEach((item) => next.push({ ...(item.data() as ExamResult), docId: item.id }));
        setRecords(next);
      })
      .catch((err) => console.error('Fetch error:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRecords(); }, []);

  const sessionNames = useMemo(() => [...new Set(records.filter((r) => r.sessionName).map((r) => r.sessionName!))].sort(), [records]);

  const filtered = useMemo(() => records.filter((r) => {
    const date = r.examDate ? new Date(r.examDate) : null;
    return (!name || r.examineeName.toLowerCase().includes(name.toLowerCase()))
      && (scoreFilter === 'all' || (scoreFilter === 'pass' ? r.passed : !r.passed))
      && (!sessionFilter || r.sessionName === sessionFilter)
      && (!from || (date && date >= new Date(from)))
      && (!to || (date && date <= new Date(`${to}T23:59:59`)));
  }), [records, name, scoreFilter, sessionFilter, from, to]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.docId));
  const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';
  const fmtTime = (s?: number) => (s || s === 0) ? `${Math.floor(s / 60)}m ${s % 60}s` : '--';

  const toggleAll = () => setSelected((prev) => {
    const next = new Set(prev);
    filtered.forEach((r) => allSelected ? next.delete(r.docId) : next.add(r.docId));
    return next;
  });

  const handleDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Permanently delete ${selected.size} record(s)? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await Promise.all([...selected].map((id) => deleteDoc(doc(db, 'exam_results', id))));
      setSelected(new Set());
      fetchRecords();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Some records could not be deleted.');
    } finally { setDeleting(false); }
  };

  const exportCSV = () => {
    const rows = [
      ['Name', 'Email', 'Mode', 'Session', 'Score %', 'Correct', 'Total', 'Passed', 'Strongest Domain', 'Weakest Domain', 'Time (s)', 'Date'],
      ...filtered.map((r) => [r.examineeName, r.candidateEmail ?? '', r.examMode, r.sessionName ?? '', r.scorePercentage, r.questionsAnsweredCorrectly, r.totalQuestions, r.passed ? 'Yes' : 'No', r.strongestDomain ?? '', r.weakestDomain ?? '', r.timeTakenSeconds, r.examDate]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `exam_results_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-3">Filter Records</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <input type="text" placeholder="Search by name..." value={name} onChange={(e) => setName(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-zinc-300" />
          <select value={scoreFilter} onChange={(e) => setScoreFilter(e.target.value as FilterScore)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            <option value="all">All Results</option>
            <option value="pass">Passed Only</option>
            <option value="fail">Failed Only</option>
          </select>
          <select value={sessionFilter} onChange={(e) => setSessionFilter(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all">
            <option value="">All Sessions</option>
            {sessionNames.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-800 font-medium outline-none focus:border-indigo-400 transition-all" />
          <button onClick={exportCSV} disabled={filtered.length === 0} className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 hover:bg-indigo-100 px-4 py-2 rounded-xl transition-colors disabled:opacity-40">Export CSV</button>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm font-semibold text-zinc-600">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full">{selected.size} selected</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-red-500 bg-red-50 border border-red-100 hover:bg-red-100 px-3 py-1 rounded-full transition-colors disabled:opacity-50">{deleting ? 'Deleting...' : 'Delete Selected'}</button>
          </div>
        )}
      </div>

      <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
        {loading
          ? <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          : filtered.length === 0
            ? <div className="text-center py-16 text-zinc-400 text-sm font-medium">No records match your filters.</div>
            : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-100">
                      <th className="px-4 py-3 text-left"><LiteCheckbox checked={allSelected} onChange={toggleAll} /></th>
                      {['Examinee', 'Mode / Session', 'Score', 'Result', 'Time', 'Strongest Domain', 'Date', ''].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-zinc-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.docId} className={`border-b border-zinc-50 hover:bg-zinc-50/60 transition-colors ${selected.has(r.docId) ? 'bg-indigo-50/40' : i % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'}`}>
                        <td className="px-4 py-3"><LiteCheckbox checked={selected.has(r.docId)} onChange={() => setSelected((prev) => { const next = new Set(prev); next.has(r.docId) ? next.delete(r.docId) : next.add(r.docId); return next; })} /></td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-zinc-800 whitespace-nowrap">{r.examineeName}</p>
                          {r.candidateEmail && <p className="text-[10px] text-zinc-400">{r.candidateEmail}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-medium text-zinc-500 capitalize bg-zinc-100 px-2.5 py-1 rounded-full">{r.examMode}</span>
                          {r.sessionName && <span className="text-[10px] font-medium text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full ml-1.5 whitespace-nowrap">{r.sessionName}</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-sm font-bold ${r.scorePercentage >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>{r.scorePercentage}%</span>
                          <span className="text-[11px] text-zinc-400 ml-1">({r.questionsAnsweredCorrectly}/{r.totalQuestions})</span>
                        </td>
                        <td className="px-4 py-3"><span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${r.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-500 border-red-100'}`}>{r.passed ? 'PASS' : 'FAIL'}</span></td>
                        <td className="px-4 py-3 text-zinc-500 font-medium whitespace-nowrap">{fmtTime(r.timeTakenSeconds)}</td>
                        <td className="px-4 py-3 text-zinc-500 font-medium text-[12px] max-w-[140px] truncate">{r.strongestDomain ?? '--'}</td>
                        <td className="px-4 py-3 text-zinc-400 text-[12px] whitespace-nowrap">{fmtDate(r.examDate)}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => navigate(`/report/${r.docId}`)}
                            className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg transition-all whitespace-nowrap"
                          >
                            View Report
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
        }
      </div>

    </div>
  );
}
