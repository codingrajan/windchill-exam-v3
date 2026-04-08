import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { ExamResult } from '../types/index';

interface ExamResultDoc extends ExamResult { docId: string; }

function buildCertificateHTML(opts: {
  name: string; score: number; date: string; examTitle: string;
  totalQuestions: number; correct: number; ptcLogoUrl: string; pluralLogoUrl: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Certificate of Achievement</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
*{margin:0;padding:0;box-sizing:border-box;}
body{font-family:'Plus Jakarta Sans',sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:32px;}
.cert{width:800px;border:8px solid #4f46e5;border-radius:24px;padding:60px 72px;text-align:center;position:relative;background:#fff;}
.cert::before{content:'';position:absolute;inset:12px;border:2px solid #e0e7ff;border-radius:16px;pointer-events:none;}
.logo-row{display:flex;align-items:center;justify-content:center;gap:24px;margin-bottom:12px;}
.logo-img{height:48px;object-fit:contain;border-radius:10px;border:1px solid #e4e4e7;padding:6px;background:#fff;}
.logo-x{font-size:18px;font-weight:800;color:#a1a1aa;}
.platform-label{font-size:11px;font-weight:700;color:#6366f1;letter-spacing:3px;text-transform:uppercase;margin-bottom:32px;}
.subtitle{font-size:13px;font-weight:600;color:#a1a1aa;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;}
h1{font-size:36px;font-weight:800;color:#18181b;margin-bottom:24px;}
.presented{font-size:14px;color:#71717a;margin-bottom:8px;font-weight:600;}
.name{font-size:48px;font-weight:800;color:#4f46e5;margin-bottom:8px;border-bottom:3px solid #e0e7ff;padding-bottom:16px;}
.exam-title{font-size:16px;color:#52525b;font-weight:600;margin:24px 0;}
.score-circle{width:120px;height:120px;border-radius:50%;background:#f0fdf4;border:6px solid #059669;display:inline-flex;flex-direction:column;align-items:center;justify-content:center;margin:16px 0;}
.score-pct{font-size:32px;font-weight:800;color:#059669;line-height:1;}
.score-label{font-size:10px;font-weight:700;color:#059669;letter-spacing:2px;text-transform:uppercase;margin-top:4px;}
.meta{font-size:12px;color:#a1a1aa;margin-top:8px;font-weight:600;}
.pass-badge{display:inline-block;background:#f0fdf4;color:#059669;border:2px solid #bbf7d0;border-radius:100px;padding:8px 28px;font-size:14px;font-weight:800;letter-spacing:2px;text-transform:uppercase;margin-top:24px;}
.footer{margin-top:40px;padding-top:24px;border-top:2px solid #f4f4f5;font-size:11px;color:#d4d4d8;font-weight:600;letter-spacing:1px;}
@media print{body{padding:0;}.cert{border-width:6px;}}
</style></head><body>
<div class="cert">
  <div class="logo-row">
    <img class="logo-img" src="${opts.ptcLogoUrl}" alt="PTC"/>
    <span class="logo-x">&times;</span>
    <img class="logo-img" src="${opts.pluralLogoUrl}" alt="Plural"/>
  </div>
  <div class="platform-label">PTC &times; Plural Mock Exam</div>
  <div class="subtitle">Certificate of Achievement</div>
  <h1>This certifies that</h1>
  <div class="presented">the following candidate has successfully passed</div>
  <div class="name">${opts.name}</div>
  <div class="exam-title">${opts.examTitle}</div>
  <div class="score-circle">
    <div class="score-pct">${opts.score}%</div>
    <div class="score-label">Score</div>
  </div>
  <div class="meta">${opts.correct} of ${opts.totalQuestions} questions correct &nbsp;&middot;&nbsp; Issued ${opts.date}</div>
  <div class="pass-badge">&#10003; Passed</div>
  <div class="footer">PTC &times; Plural Windchill Exam Platform &nbsp;&bull;&nbsp; Issued on ${opts.date}</div>
</div></body></html>`;
}

function openCertificate(r: ExamResultDoc) {
  const win = window.open('', '_blank', 'width=920,height=680');
  if (!win) return;
  const origin = window.location.origin;
  win.document.write(buildCertificateHTML({
    name: r.examineeName,
    score: r.scorePercentage,
    date: new Date(r.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
    examTitle: r.sessionName ?? 'PTC \u00d7 Plural Mock Exam',
    totalQuestions: r.totalQuestions,
    correct: r.questionsAnsweredCorrectly,
    ptcLogoUrl: `${origin}/images/ptc_logo.png`,
    pluralLogoUrl: `${origin}/images/plural_logo.jpg`,
  }));
  win.document.close();
  setTimeout(() => win.print(), 600);
}

export default function History() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [results, setResults] = useState<ExamResultDoc[]>([]);
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
        query(collection(db, 'exam_results'), where('candidateEmail', '==', trimmed)),
      );
      const list: ExamResultDoc[] = [];
      snap.forEach((d) => list.push({ ...(d.data() as ExamResult), docId: d.id }));
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
            <div className="py-16 px-6">
              <p className="text-zinc-400 text-sm font-medium">No results found for this email.</p>
              <p className="text-zinc-300 text-xs mt-1">Results are only tracked when an email is provided during the exam.</p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 bg-zinc-50 border-b border-zinc-100">
                <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{results.length} result{results.length !== 1 ? 's' : ''} found</p>
              </div>
              <div className="divide-y divide-zinc-50">
                {results.map((r) => {
                  const date = new Date(r.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                  const time = new Date(r.examDate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                  const mins = Math.floor(r.timeTakenSeconds / 60);
                  const secs = r.timeTakenSeconds % 60;
                  const canCert = r.passed && r.examMode === 'preset';
                  return (
                    <div key={r.docId} className="px-5 py-4">
                      <div className="flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-zinc-800 truncate">{r.sessionName ?? (r.examMode === 'preset' ? 'Preset Exam' : 'Random Exam')}</p>
                          <p className="text-[11px] text-zinc-400 mt-0.5">{date} at {time} &middot; {mins}m {secs}s</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                          <span className="text-lg font-bold text-zinc-800">{r.scorePercentage}%</span>
                          <span className={`text-[11px] font-semibold px-3 py-1 rounded-full border ${r.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                            {r.passed ? 'Passed' : 'Failed'}
                          </span>
                          <button
                            onClick={() => navigate(`/report/${r.docId}`)}
                            className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 px-3 py-1 rounded-lg transition-all"
                          >
                            View Report
                          </button>
                          {canCert && (
                            <button
                              onClick={() => openCertificate(r)}
                              className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-lg transition-all"
                            >
                              Certificate
                            </button>
                          )}
                        </div>
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
