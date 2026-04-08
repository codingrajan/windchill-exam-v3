import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ExamResult } from '../types/index';

export default function History() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<ExamResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) { setError('Please enter your email address.'); return; }
    setError('');
    setLoading(true);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'exam_results'),
          where('candidateEmail', '==', trimmed),
        ),
      );
      const list: ExamResult[] = [];
      snap.forEach((d) => list.push(d.data() as ExamResult));
      // Sort client-side — avoids needing a composite Firestore index
      list.sort((a, b) => new Date(b.examDate).getTime() - new Date(a.examDate).getTime());
      setResults(list);
      setSearched(true);
    } catch (err) {
      console.error('History fetch error:', err);
      setError('Could not load results. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-3xl mx-auto py-6 px-2"
    >
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-indigo-50 border border-indigo-100 rounded-2xl mb-4">
          <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-zinc-900 tracking-tight">My Result History</h2>
        <p className="text-zinc-500 text-sm font-medium mt-1">Look up past exam results by email</p>
      </div>

      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 mb-5">
        <form onSubmit={(e) => void handleSearch(e)} className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoFocus
            className="flex-1 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 font-medium outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all placeholder:text-zinc-300"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all disabled:opacity-60 flex-shrink-0"
          >
            {loading ? '...' : 'Look Up'}
          </button>
        </form>
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs font-semibold text-red-500 text-center mt-3"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {searched && (
        <div className="bg-white border border-zinc-100 rounded-2xl shadow-sm overflow-hidden">
          {results.length === 0 ? (
            <div className="text-center py-16 px-6">
              <p className="text-zinc-400 text-sm font-medium">No results found for this email.</p>
              <p className="text-zinc-300 text-xs mt-1">Results are only tracked when an email is provided during the exam.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
              </div>
              <div className="divide-y divide-zinc-50">
                {results.map((r, i) => {
                  const date = new Date(r.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const time = new Date(r.examDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const mins = Math.floor(r.timeTakenSeconds / 60);
                  const secs = r.timeTakenSeconds % 60;
                  return (
                    <div key={i} className="px-5 py-4 flex items-center gap-4 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-zinc-800 truncate">{r.sessionName ?? (r.examMode === 'preset' ? 'Preset Exam' : 'Random Exam')}</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">{date} at {time} &middot; {mins}m {secs}s</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-lg font-bold text-zinc-800">{r.scorePercentage}%</span>
                        <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${
                          r.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                        }`}>
                          {r.passed ? 'Passed' : 'Failed'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="mt-5 text-center">
        <button
          onClick={() => navigate('/')}
          className="text-[11px] font-medium text-zinc-400 hover:text-indigo-500 border border-zinc-200 hover:border-indigo-200 hover:bg-indigo-50 px-5 py-2 rounded-full transition-all"
        >
          Back to Home
        </button>
      </div>
    </motion.div>
  );
}
