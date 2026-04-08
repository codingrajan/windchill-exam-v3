import { useEffect, useState } from 'react';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ExamResult, ExamSession } from '../../types/index';

interface SessionStats {
  session: ExamSession;
  results: ExamResult[];
  passRate: number;
  avgScore: number;
  avgTime: number;
  total: number;
  topDomains: { domain: string; count: number }[];
}

const COLORS = ['border-indigo-200 bg-indigo-50/40', 'border-emerald-200 bg-emerald-50/40', 'border-amber-200 bg-amber-50/40'];
const BAR_COLORS = ['bg-indigo-500', 'bg-emerald-500', 'bg-amber-500'];

export default function CohortCompareTab() {
  const [sessions, setSessions] = useState<ExamSession[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statsMap, setStatsMap] = useState<Map<string, SessionStats>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getDocs(query(collection(db, 'exam_sessions'), orderBy('createdAt', 'desc')))
      .then((snap) => {
        const list: ExamSession[] = [];
        snap.forEach((d) => list.push({ ...(d.data() as ExamSession), id: d.id }));
        setSessions(list);
      })
      .finally(() => setLoading(false));
  }, []);

  const toggleSession = async (session: ExamSession) => {
    if (selected.has(session.id)) {
      setSelected((prev) => { const next = new Set(prev); next.delete(session.id); return next; });
      return;
    }
    if (selected.size >= 3) return;
    setSelected((prev) => new Set([...prev, session.id]));

    if (!statsMap.has(session.id)) {
      setLoadingIds((prev) => new Set([...prev, session.id]));
      try {
        const snap = await getDocs(query(collection(db, 'exam_results'), where('sessionId', '==', session.id)));
        const results: ExamResult[] = [];
        snap.forEach((d) => results.push(d.data() as ExamResult));

        const total = results.length;
        const passed = results.filter((r) => r.passed).length;
        const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
        const avgScore = total > 0 ? Math.round(results.reduce((s, r) => s + r.scorePercentage, 0) / total) : 0;
        const avgTime = total > 0 ? Math.round(results.reduce((s, r) => s + r.timeTakenSeconds, 0) / total) : 0;

        const domainCount: Record<string, number> = {};
        results.forEach((r) => { if (r.strongestDomain) domainCount[r.strongestDomain] = (domainCount[r.strongestDomain] ?? 0) + 1; });
        const topDomains = Object.entries(domainCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([domain, count]) => ({ domain, count }));

        setStatsMap((prev) => new Map(prev).set(session.id, { session, results, passRate, avgScore, avgTime, total, topDomains }));
      } catch (err) { console.error('Cohort load error:', err); }
      finally { setLoadingIds((prev) => { const next = new Set(prev); next.delete(session.id); return next; }); }
    }
  };

  const selectedStats = [...selected].map((id) => statsMap.get(id)).filter(Boolean) as SessionStats[];

  return (
    <div className="space-y-5">
      {/* Session picker */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Select Sessions to Compare (up to 3)</p>
          {selected.size > 0 && <button onClick={() => setSelected(new Set())} className="text-[11px] font-semibold text-zinc-400 hover:text-red-500 transition-colors">Clear All</button>}
        </div>
        {loading ? (
          <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        ) : sessions.length === 0 ? (
          <p className="text-sm text-zinc-400">No sessions found.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sessions.map((s) => {
              const isSelected = selected.has(s.id);
              const colorIdx = [...selected].indexOf(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => void toggleSession(s)}
                  disabled={!isSelected && selected.size >= 3}
                  className={`px-4 py-2 rounded-xl border-2 text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${isSelected ? `border-current ${['text-indigo-600 bg-indigo-50 border-indigo-300', 'text-emerald-600 bg-emerald-50 border-emerald-300', 'text-amber-600 bg-amber-50 border-amber-300'][colorIdx] ?? 'text-indigo-600 bg-indigo-50 border-indigo-300'}` : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300'}`}
                >
                  {loadingIds.has(s.id) ? '…' : s.name}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Comparison cards */}
      {selectedStats.length > 0 && (
        <div className={`grid gap-5 grid-cols-1 ${selectedStats.length >= 2 ? 'sm:grid-cols-2' : ''} ${selectedStats.length === 3 ? 'lg:grid-cols-3' : ''}`}>
          {selectedStats.map((stat, idx) => (
            <div key={stat.session.id} className={`bg-white border-2 rounded-2xl shadow-sm overflow-hidden ${COLORS[idx]}`}>
              <div className="px-5 py-4 border-b border-zinc-100">
                <p className="text-sm font-bold text-zinc-800">{stat.session.name}</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">{stat.session.presetName}</p>
              </div>
              <div className="p-5 space-y-4">
                {/* Key metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Candidates', value: stat.total, color: 'text-zinc-800' },
                    { label: 'Pass Rate', value: `${stat.passRate}%`, color: stat.passRate >= 80 ? 'text-emerald-600' : stat.passRate >= 60 ? 'text-amber-500' : 'text-red-500' },
                    { label: 'Avg Score', value: `${stat.avgScore}%`, color: stat.avgScore >= 80 ? 'text-emerald-600' : stat.avgScore >= 60 ? 'text-amber-500' : 'text-red-500' },
                    { label: 'Avg Time', value: `${Math.floor(stat.avgTime / 60)}m ${stat.avgTime % 60}s`, color: 'text-zinc-800' },
                  ].map((m) => (
                    <div key={m.label} className="bg-white/80 rounded-xl p-3 text-center border border-zinc-100">
                      <div className={`text-xl font-bold ${m.color}`}>{m.value}</div>
                      <div className="text-[9px] font-semibold text-zinc-400 uppercase tracking-wider mt-0.5">{m.label}</div>
                    </div>
                  ))}
                </div>

                {/* Pass rate bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Pass Rate</span>
                    <span className="text-[11px] font-bold text-zinc-600">{stat.passRate}%</span>
                  </div>
                  <div className="bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[idx]}`} style={{ width: `${stat.passRate}%` }} />
                  </div>
                </div>

                {/* Avg score bar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Avg Score</span>
                    <span className="text-[11px] font-bold text-zinc-600">{stat.avgScore}%</span>
                  </div>
                  <div className="bg-zinc-100 rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${BAR_COLORS[idx]} opacity-70`} style={{ width: `${stat.avgScore}%` }} />
                  </div>
                </div>

                {/* Top domains */}
                {stat.topDomains.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Top Strongest Domains</p>
                    <div className="space-y-1.5">
                      {stat.topDomains.map((d) => (
                        <div key={d.domain} className="flex items-center justify-between">
                          <span className="text-[11px] text-zinc-600 font-medium truncate mr-2">{d.domain}</span>
                          <span className="text-[10px] font-semibold text-zinc-400 flex-shrink-0">{d.count} candidate{d.count !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {stat.total === 0 && (
                  <p className="text-center text-xs text-zinc-400 py-2">No results recorded for this session yet.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {selected.size === 0 && !loading && sessions.length > 0 && (
        <div className="py-12 px-5 text-zinc-400 text-sm font-medium bg-white border border-zinc-100 rounded-2xl">
          Select 2 or 3 sessions above to compare their performance side-by-side.
        </div>
      )}
    </div>
  );
}
