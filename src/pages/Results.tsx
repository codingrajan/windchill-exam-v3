import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { addDoc, collection, doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { AnswerMap, EvaluatedQuestion, ExamMode, ExamResult, Question, QuestionResult } from '../types/index';
import { evaluateExam, getQuestionDomain } from '../utils/examLogic';

function DiffBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    easy: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    medium: 'bg-amber-50 text-amber-600 border-amber-100',
    hard: 'bg-red-50 text-red-600 border-red-100',
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
        styles[level?.toLowerCase()] ?? 'bg-zinc-100 text-zinc-500 border-zinc-200'
      }`}
    >
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

function ReviewItem({
  question,
  index,
  userAnswer,
}: {
  question: Question;
  index: number;
  userAnswer: number | number[] | undefined;
}) {
  const [open, setOpen] = useState(false);
  const evaluated = evaluateExam([question], { 0: userAnswer } as AnswerMap);
  const review = evaluated.evaluatedQuestions[0];
  const isMulti = Array.isArray(question.correctAnswer);

  const statusIcon = review.isCorrect ? 'OK' : review.isSkipped ? '--' : 'NO';
  const borderColor = review.isCorrect
    ? 'border-emerald-200'
    : review.isSkipped
      ? 'border-zinc-200'
      : 'border-red-200';
  const iconColor = review.isCorrect
    ? 'text-emerald-600 bg-emerald-50'
    : review.isSkipped
      ? 'text-zinc-400 bg-zinc-50'
      : 'text-red-600 bg-red-50';

  return (
    <div className={`border rounded-2xl overflow-hidden transition-shadow ${borderColor} hover:shadow-sm`}>
      <button
        onClick={() => setOpen((previous) => !previous)}
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
            <span className="text-[10px] font-medium bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded-full">
              {getQuestionDomain(question)}
            </span>
            <DiffBadge level={question.difficulty ?? 'unrated'} />
            {isMulti && (
              <span className="text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full">
                Multiple Response
              </span>
            )}
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
                {question.options.map((option, optionIndex) => {
                  const isOptionCorrect = Array.isArray(question.correctAnswer)
                    ? question.correctAnswer.includes(optionIndex)
                    : question.correctAnswer === optionIndex;
                  const didSelect = Array.isArray(userAnswer)
                    ? userAnswer.includes(optionIndex)
                    : userAnswer === optionIndex;
                  let cls = 'border-zinc-200 bg-white text-zinc-600';
                  if (isOptionCorrect) cls = 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold';
                  else if (didSelect && !review.isCorrect) cls = 'border-red-200 bg-red-50 text-red-700 line-through';
                  return (
                    <div key={optionIndex} className={`flex gap-3 p-3 rounded-xl border text-sm ${cls}`}>
                      <span className="font-bold flex-shrink-0">{String.fromCharCode(65 + optionIndex)}.</span>
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

function buildCertificateHTML(opts: {
  name: string;
  score: number;
  date: string;
  examTitle: string;
  totalQuestions: number;
  correct: number;
  ptcLogoUrl: string;
  pluralLogoUrl: string;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>Certificate of Achievement</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Plus Jakarta Sans', sans-serif; background: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 32px; }
  .cert { width: 800px; border: 8px solid #4f46e5; border-radius: 24px; padding: 60px 72px; text-align: center; position: relative; background: #fff; }
  .cert::before { content: ''; position: absolute; inset: 12px; border: 2px solid #e0e7ff; border-radius: 16px; pointer-events: none; }
  .logo-row { display: flex; align-items: center; justify-content: center; gap: 24px; margin-bottom: 12px; }
  .logo-img { height: 48px; object-fit: contain; border-radius: 10px; border: 1px solid #e4e4e7; padding: 6px; background: #fff; }
  .logo-divider { width: 1px; height: 32px; background: #e4e4e7; }
  .logo-x { font-size: 18px; font-weight: 800; color: #a1a1aa; }
  .platform-label { font-size: 11px; font-weight: 700; color: #6366f1; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 32px; }
  .subtitle { font-size: 13px; font-weight: 600; color: #a1a1aa; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 8px; }
  h1 { font-size: 36px; font-weight: 800; color: #18181b; margin-bottom: 24px; }
  .presented { font-size: 14px; color: #71717a; margin-bottom: 8px; font-weight: 600; }
  .name { font-size: 48px; font-weight: 800; color: #4f46e5; margin-bottom: 8px; border-bottom: 3px solid #e0e7ff; padding-bottom: 16px; }
  .exam-title { font-size: 16px; color: #52525b; font-weight: 600; margin: 24px 0; }
  .score-circle { width: 120px; height: 120px; border-radius: 50%; background: #f0fdf4; border: 6px solid #059669; display: inline-flex; flex-direction: column; align-items: center; justify-content: center; margin: 16px 0; }
  .score-pct { font-size: 32px; font-weight: 800; color: #059669; line-height: 1; }
  .score-label { font-size: 10px; font-weight: 700; color: #059669; letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
  .meta { font-size: 12px; color: #a1a1aa; margin-top: 8px; font-weight: 600; }
  .pass-badge { display: inline-block; background: #f0fdf4; color: #059669; border: 2px solid #bbf7d0; border-radius: 100px; padding: 8px 28px; font-size: 14px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; margin-top: 24px; }
  .footer { margin-top: 40px; padding-top: 24px; border-top: 2px solid #f4f4f5; font-size: 11px; color: #d4d4d8; font-weight: 600; letter-spacing: 1px; }
  @media print { body { padding: 0; } .cert { border-width: 6px; } }
</style>
</head>
<body>
<div class="cert">
  <div class="logo-row">
    <img class="logo-img" src="${opts.ptcLogoUrl}" alt="PTC" />
    <span class="logo-x">&times;</span>
    <img class="logo-img" src="${opts.pluralLogoUrl}" alt="Plural" />
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
</div>
</body>
</html>`;
}

export default function Results() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as {
    questions?: Question[];
    answers?: AnswerMap;
    timeTaken?: number;
    examineeName?: string;
    examMode?: ExamMode;
    sessionId?: string;
    sessionName?: string;
    candidateEmail?: string;
    participantId?: string;
    questionTimings?: Record<number, number>;
  };

  const hasSaved = useRef(false);
  const questions = state.questions ?? [];
  const answers = state.answers ?? {};
  const timeTaken = state.timeTaken ?? 0;
  const examineeName = state.examineeName ?? 'Anonymous';
  const examMode = state.examMode ?? 'random';
  const sessionId = state.sessionId;
  const sessionName = state.sessionName;
  const candidateEmail = state.candidateEmail;
  const participantId = state.participantId;
  const questionTimings = state.questionTimings ?? {};
  const summary = evaluateExam(questions, answers);

  useEffect(() => {
    if (questions.length === 0 || hasSaved.current) return;
    hasSaved.current = true;

    const submittedAt = new Date().toISOString();

    const questionResults: QuestionResult[] = summary.evaluatedQuestions.map(
      (eq: EvaluatedQuestion, idx: number) => ({
        questionId: eq.question.id,
        correct: eq.isCorrect,
        skipped: eq.isSkipped,
        timeTaken: questionTimings[idx] ?? 0,
        ...(eq.answer !== undefined ? { selectedAnswer: eq.answer } : {}),
      }),
    );

    const payload: ExamResult = {
      examineeName,
      examMode,
      scorePercentage: summary.percentage,
      questionsAnsweredCorrectly: summary.correctCount,
      totalQuestions: questions.length,
      passed: summary.passed,
      strongestDomain: summary.strongestTopic.topic,
      weakestDomain: summary.weakestTopic.topic,
      timeTakenSeconds: timeTaken,
      examDate: submittedAt,
      questionResults,
      ...(sessionId ? { sessionId } : {}),
      ...(sessionName ? { sessionName } : {}),
      ...(candidateEmail ? { candidateEmail } : {}),
      ...(participantId ? { participantId } : {}),
    };

    void addDoc(collection(db, 'exam_results'), payload).catch((error: unknown) => {
      console.error('Result save error:', error);
    });

    if (participantId) {
      void updateDoc(doc(db, 'session_participants', participantId), {
        status: 'completed',
        submittedAt,
        score: summary.percentage,
        passed: summary.passed,
      }).catch((error: unknown) => {
        console.error('Participant update error:', error);
      });
    }
  }, [
    examMode,
    examineeName,
    candidateEmail,
    participantId,
    questions.length,
    questionTimings,
    sessionId,
    sessionName,
    summary.correctCount,
    summary.evaluatedQuestions,
    summary.passed,
    summary.percentage,
    summary.strongestTopic.topic,
    summary.weakestTopic.topic,
    timeTaken,
  ]);

  const openCertificate = () => {
    const win = window.open('', '_blank', 'width=920,height=680');
    if (!win) return;
    const origin = window.location.origin;
    const html = buildCertificateHTML({
      name: examineeName,
      score: summary.percentage,
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      examTitle: sessionName ?? 'PTC \u00d7 Plural Mock Exam',
      totalQuestions: questions.length,
      correct: summary.correctCount,
      ptcLogoUrl: `${origin}/images/ptc_logo.png`,
      pluralLogoUrl: `${origin}/images/plural_logo.jpg`,
    });
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 600);
  };

  if (questions.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-400 font-medium">
        No exam data found.{' '}
        {!sessionId && (
          <button onClick={() => navigate('/')} className="text-indigo-500 underline">
            Return home
          </button>
        )}
      </div>
    );
  }

  const passColor = summary.passed ? 'text-emerald-600' : 'text-red-500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="max-w-5xl mx-auto py-6 px-2"
    >
      <div className="bg-white border border-zinc-100 rounded-3xl shadow-sm p-8 md:p-12">
        <div className="flex flex-col md:flex-row gap-8 items-center mb-10 pb-10 border-b border-zinc-100">
          <div className="relative w-40 h-40 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="68" fill="none" stroke="#f4f4f5" strokeWidth="12" />
              <circle
                cx="80"
                cy="80"
                r="68"
                fill="none"
                stroke={summary.passed ? '#059669' : '#ef4444'}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${427.26 * (summary.percentage / 100)} 427.26`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-4xl font-bold ${passColor}`}>{summary.percentage}%</span>
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mt-1">Score</span>
            </div>
          </div>

          <div className="flex-grow w-full">
            <div className="flex items-center gap-3 mb-4">
              <h2 className={`text-2xl font-bold uppercase tracking-wide ${passColor}`}>
                {summary.passed ? 'Passed' : 'Failed'}
              </h2>
              <span
                className={`text-xs font-semibold px-3 py-1 rounded-full border ${
                  summary.passed ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-red-50 text-red-600 border-red-200'
                }`}
              >
                {summary.passed ? 'Above threshold' : 'Below 80%'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 mb-4">
              Candidate: <span className="font-semibold text-zinc-800">{examineeName}</span>
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatBox label="Correct" value={summary.correctCount} color="text-emerald-600" />
              <StatBox label="Incorrect" value={summary.incorrectCount} color="text-red-500" />
              <StatBox label="Skipped" value={summary.skippedCount} color="text-zinc-400" />
              <StatBox label="Time Taken" value={`${Math.floor(timeTaken / 60)}m ${timeTaken % 60}s`} color="text-zinc-700" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wider mb-0.5">Strongest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">
              {summary.strongestTopic.topic} <span className="text-emerald-600">({summary.strongestTopic.percentage}%)</span>
            </p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
            <p className="text-[10px] font-semibold text-amber-600 uppercase tracking-wider mb-0.5">Weakest Domain</p>
            <p className="text-sm font-semibold text-zinc-800">
              {summary.weakestTopic.topic} <span className="text-amber-600">({summary.weakestTopic.percentage}%)</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Domain Analysis</h3>
            <div className="space-y-3">
              {Object.entries(summary.topicStats).map(([topic, stats]) => {
                const pct = stats.total === 0 ? 0 : Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={topic} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-zinc-600 truncate pr-3">{topic}</span>
                      <span className={`text-xs font-bold flex-shrink-0 ${pct >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {stats.correct}/{stats.total} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${pct >= 80 ? 'bg-emerald-500' : 'bg-red-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider mb-4">Difficulty Matrix</h3>
            <div className="space-y-3">
              {(['easy', 'medium', 'hard', 'unrated'] as const).map((level) => {
                const stats = summary.difficultyStats[level];
                if (stats.total === 0) return null;
                const pct = Math.round((stats.correct / stats.total) * 100);
                return (
                  <div key={level} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 flex items-center justify-between">
                    <DiffBadge level={level} />
                    <div className="text-right">
                      <span className="text-sm font-bold text-zinc-900">{stats.correct}</span>
                      <span className="text-zinc-400 text-xs font-medium"> / {stats.total}</span>
                      <div className={`text-[10px] font-bold mt-0.5 ${pct >= 80 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {pct}% accuracy
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="border-t border-zinc-100 pt-10">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-sm font-semibold text-zinc-700 uppercase tracking-wider">Detailed Question Review</h3>
            <div className="flex items-center gap-3 flex-wrap">
              {summary.passed && examMode === 'preset' && (
                <button
                  onClick={openCertificate}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  Download Certificate
                </button>
              )}
              {sessionId ? (
                <p className="text-sm text-zinc-400 font-medium">Your results have been recorded.</p>
              ) : (
                <button
                  onClick={() => navigate('/')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm w-full sm:w-auto"
                >
                  Return Home
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {questions.map((question, index) => (
              <ReviewItem key={question.id} question={question} index={index} userAnswer={answers[index]} />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
