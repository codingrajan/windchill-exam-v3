import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { AnswerValue, ExamResult, Question } from '../types/index';
import { getQuestionDomain, loadQuestionPool } from '../utils/examLogic';

function DiffBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${styles[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'}`}>
      {level}
    </span>
  );
}

function StatBox({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-zinc-50 border border-zinc-100 rounded-2xl p-4 text-center">
      <div className={`text-2xl font-bold mb-1 ${color}`}>{value}</div>
      <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function QuestionReview({
  question,
  index,
  correct,
  skipped,
  selectedAnswer,
  timeTaken,
}: {
  question: Question;
  index: number;
  correct: boolean;
  skipped: boolean;
  selectedAnswer: AnswerValue | undefined;
  timeTaken: number;
}) {
  const [open, setOpen] = useState(false);
  const isMulti = Array.isArray(question.correctAnswer);
  const statusIcon = correct ? 'OK' : skipped ? '--' : 'NO';
  const borderColor = correct ? 'border-emerald-200' : skipped ? 'border-zinc-200' : 'border-red-200';
  const iconColor = correct ? 'text-emerald-600 bg-emerald-50' : skipped ? 'text-zinc-400 bg-zinc-50' : 'text-red-600 bg-red-50';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-shadow ${borderColor} hover:shadow-sm`}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-start gap-4 p-4 text-left hover:bg-zinc-50 transition-colors"
      >
        <span className={`w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-xs font-bold mt-0.5 ${iconColor}`}>
          {statusIcon}
        </span>
        <div className="flex-grow min-w-0">
          <p className="text-sm font-semibold text-zinc-800 leading-snug line-clamp-2 mb-1.5">
            <span className="text-zinc-400 mr-1">Q{index + 1}.</span>
            {question.question}
          </p>
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">{getQuestionDomain(question)}</span>
            <DiffBadge level={question.difficulty ?? 'unrated'} />
            {isMulti && <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">Multiple Response</span>}
            {timeTaken > 0 && <span className="text-[10px] font-medium text-zinc-400 ml-auto">{timeTaken}s</span>}
          </div>
        </div>
        <span className="text-zinc-300 font-bold text-lg flex-shrink-0">{open ? '-' : '+'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-zinc-100 pt-4 bg-zinc-50/50">
              <div className="space-y-2 mb-4">
                {question.options.map((option, oi) => {
                  const isCorrectOption = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.includes(oi)
                    : question.correctAnswer === oi;
                  const didSelect = Array.isArray(selectedAnswer)
                    ? selectedAnswer.includes(oi)
                    : selectedAnswer === oi;
                  let cls = 'border-zinc-200 bg-white text-zinc-600';
                  if (isCorrectOption) cls = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold';
                  else if (didSelect && !correct) cls = 'border-red-200 bg-red-50 text-red-700 line-through';
                  return (
                    <div key={oi} className={`flex gap-3 p-3 rounded-xl border text-sm ${cls}`}>
                      <span className="font-bold flex-shrink-0">{String.fromCharCode(65 + oi)}.</span>
                      <span>{option}</span>
                    </div>
                  );
                })}
              </div>
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
                <p className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wider mb-1.5">Explanation</p>
                <p className="text-sm text-zinc-700 leading-relaxed">{question.explanation}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function ReportDetail() {
  const { resultId } = useParams<{ resultId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<ExamResult | null>(null);
  const [questionPool, setQuestionPool] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!resultId) { setError('Invalid report link.'); setLoading(false); return; }
    const load = async () => {
      try {
        const [snap, pool] = await Promise.all([
          getDoc(doc(db, 'exam_results', resultId)),
          loadQuestionPool(),
        ]);
        if (!snap.exists()) { setError('Report not found.'); setLoading(false); return; }
        setResult(snap.data() as ExamResult);
        setQuestionPool(pool);
      } catch (err) {
        console.error('ReportDetail load error:', err);
        setError('Could not load this report. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [resultId]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="text-center py-20">
        <p className="text-zinc-400 font-medium text-sm mb-4">{error || 'Report not found.'}</p>
        <button onClick={() => navigate(-1)} className="text-indigo-500 text-sm font-semibold underline">Go back</button>
      </div>
    );
  }

  const questionItems = (result.questionResults ?? [])
    .map((qr) => ({ qr, question: questionPool.find((q) => q.id === qr.questionId) }))
    .filter((x): x is { qr: typeof x.qr; question: Question } => !!x.question);

  const correct = result.questionsAnsweredCorrectly;
  const total = result.totalQuestions;
  const incorrect = questionItems.filter((x) => !x.qr.correct && !x.qr.skipped).length;
  const skipped = questionItems.filter((x) => x.qr.skipped).length;
  const passColor = result.passed ? 'text-emerald-600' : 'text-red-500';
  const date = new Date(result.examDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = `${Math.floor(result.timeTakenSeconds / 60)}m ${result.timeTakenSeconds % 60}s`;

  // Domain analysis from stored questionResults
  const domainStats: Record<string, { correct: number; total: number }> = {};
  questionItems.forEach(({ qr, question }) => {
    const d = getQuestionDomain(question);
    if (!domainStats[d]) domainStats[d] = { correct: 0, total: 0 };
    domainStats[d].total++;
    if (qr.correct) domainStats[d].correct++;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto py-6 px-2"
    >
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-zinc-700 mb-5 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 md:p-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-8 items-center mb-10 pb-10 border-b border-zinc-100">
          <div className="relative w-36 h-36 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="68" fill="none" stroke="#f4f4f5" strokeWidth="12" />
              <circle cx="80" cy="80" r="68" fill="none"
                stroke={result.passed ? '#059669' : '#ef4444'} strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${427.26 * (result.scorePercentage / 100)} 427.26`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-3xl font-bold ${passColor}`}>{result.scorePercentage}%</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1">Score</span>
            </div>
          </div>

          <div className="flex-grow w-full">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className={`text-2xl font-bold uppercase tracking-wide ${passColor}`}>{result.passed ? 'Passed' : 'Failed'}</h2>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${result.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'}`}>
                {result.passed ? 'Above threshold' : 'Below 80%'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mb-1">Candidate: <span className="font-semibold text-zinc-800">{result.examineeName}</span></p>
            {result.sessionName && <p className="text-sm text-zinc-500 mb-1">Session: <span className="font-semibold text-zinc-800">{result.sessionName}</span></p>}
            <p className="text-xs text-zinc-400 mb-4">{date}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Correct" value={correct} color="text-emerald-600" />
              <StatBox label="Incorrect" value={incorrect} color="text-red-500" />
              <StatBox label="Skipped" value={skipped} color="text-zinc-400" />
              <StatBox label="Time Taken" value={timeStr} color="text-zinc-700" />
            </div>
          </div>
        </div>

        {/* Domain analysis */}
        {Object.keys(domainStats).length > 0 && (
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Domain Analysis</h3>
            <div className="space-y-3">
              {Object.entries(domainStats)
                .sort((a, b) => {
                  const pa = a[1].total > 0 ? a[1].correct / a[1].total : 0;
                  const pb = b[1].total > 0 ? b[1].correct / b[1].total : 0;
                  return pa - pb;
                })
                .map(([domain, stats]) => {
                  const pct = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
                  return (
                    <div key={domain} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs font-semibold text-zinc-600 truncate pr-3">{domain}</span>
                        <span className={`text-xs font-bold flex-shrink-0 ${pct >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {stats.correct}/{stats.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Question review */}
        <div className="border-t border-zinc-100 pt-10">
          <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-6">
            Question-by-Question Review
            {questionItems.length < total && (
              <span className="ml-2 text-[10px] font-normal normal-case text-zinc-400">
                ({questionItems.length} of {total} questions have detailed tracking)
              </span>
            )}
          </h3>

          {questionItems.length === 0 ? (
            <p className="text-zinc-400 text-sm text-center py-8">
              Detailed question data is available for exams taken after the analytics update was deployed.
            </p>
          ) : (
            <div className="space-y-3">
              {questionItems.map(({ qr, question }, idx) => (
                <QuestionReview
                  key={qr.questionId}
                  question={question}
                  index={idx}
                  correct={qr.correct}
                  skipped={qr.skipped}
                  selectedAnswer={qr.selectedAnswer}
                  timeTaken={qr.timeTaken}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
