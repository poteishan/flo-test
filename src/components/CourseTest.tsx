import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  ClipboardCheck,
  BookOpen,
  ListChecks,
  PlayCircle,
  ArrowLeft,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { generateCourseQuiz, isAiConfigured } from '../services/gemini';
import type { QuizQuestion, QuizScope } from '../services/gemini';

type Mode = 'course' | 'progress' | 'lecture';

const LETTERS = ['A', 'B', 'C', 'D'];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Small string hash so cache keys stay short and change whenever lecture titles change.
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export const CourseTest: React.FC = () => {
  const { activeCourse, activeVideoId } = useApp();

  const [stage, setStage] = useState<'setup' | 'quiz'>('setup');
  const [mode, setMode] = useState<Mode>('course');
  const [lectureId, setLectureId] = useState('');
  const [quizLabel, setQuizLabel] = useState('');

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100, shown while generating
  const [error, setError] = useState<string | null>(null);

  const courseId = activeCourse?.id;

  const openQuiz = (qs: QuizQuestion[], label: string) => {
    setQuestions(qs);
    setQuizLabel(label);
    setAnswers(new Array(qs.length).fill(null));
    setCurrent(0);
    setFinished(false);
    setConfirmEnd(false);
    setStage('quiz');
  };

  const backToSetup = () => {
    setStage('setup');
    setQuestions(null);
    setFinished(false);
    setConfirmEnd(false);
    setError(null);
  };

  // New course selected: go back to the picker, defaulting the lecture to the one being watched.
  useEffect(() => {
    backToSetup();
    setMode('course');
    setLectureId(activeVideoId || activeCourse?.videos[0]?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // The AI gives no real progress signal, so ease toward 92% while waiting
  // and jump to 100% once the questions arrive.
  useEffect(() => {
    if (!loading) return;
    setProgress(4);
    const id = setInterval(() => {
      setProgress((p) => (p >= 92 ? p : p + Math.max(0.4, (92 - p) * 0.05)));
    }, 250);
    return () => clearInterval(id);
  }, [loading]);

  if (!activeCourse) return null;

  const videos = activeCourse.videos;
  const completedCount = videos.filter((v) => v.completed).length;
  const lectureIndex = Math.max(0, videos.findIndex((v) => v.id === lectureId));
  const lecture = videos[lectureIndex];
  const stillLoadingPlaylist = videos.some((v) => /loading course playlist/i.test(v.title));

  // What the selected test type covers, plus a cache key so each scope keeps its own saved test.
  const scopeFor = (m: Mode): { scope: QuizScope; key: string } => {
    if (m === 'progress') {
      const items = videos
        .map((v, i) => ({ n: i + 1, title: v.title, done: v.completed }))
        .filter((x) => x.done)
        .map(({ n, title }) => ({ n, title }));
      return {
        scope: {
          kind: 'progress',
          label: `My progress (${items.length} lecture${items.length === 1 ? '' : 's'} completed)`,
          videos: items,
        },
        key: `progress:${hash(items.map((i) => `${i.n}${i.title}`).join('|'))}`,
      };
    }
    if (m === 'lecture') {
      const n = lectureIndex + 1;
      const title = lecture?.title ?? '';
      return {
        scope: { kind: 'lecture', label: `Lecture ${n}: ${title}`, videos: [{ n, title }] },
        key: `lecture:${lecture?.id ?? ''}:${hash(title)}`,
      };
    }
    return {
      scope: {
        kind: 'course',
        label: 'Entire course',
        videos: videos.map((v, i) => ({ n: i + 1, title: v.title })),
      },
      key: `course:${hash(videos.map((v) => v.title).join('|'))}`,
    };
  };

  const cacheKeyFor = (key: string) => `flo-quiz:v2:${activeCourse.id}:${key}`;

  const current_scope = scopeFor(mode);
  let hasSaved = false;
  try {
    hasSaved = Boolean(localStorage.getItem(cacheKeyFor(current_scope.key)));
  } catch {
    /* ignore */
  }

  const canStart =
    isAiConfigured || hasSaved
      ? !stillLoadingPlaylist && !(mode === 'progress' && completedCount === 0) && !(mode === 'lecture' && !lecture)
      : false;

  const begin = async (forceNew = false) => {
    setError(null);
    const { scope, key } = scopeFor(mode);
    const ck = cacheKeyFor(key);

    // Use the saved test for this scope when there is one (no API call).
    if (!forceNew) {
      try {
        const raw = localStorage.getItem(ck);
        if (raw) {
          const saved = JSON.parse(raw);
          if (Array.isArray(saved?.questions) && saved.questions.length > 0) {
            openQuiz(saved.questions, scope.label);
            return;
          }
        }
      } catch {
        /* bad cache, regenerate */
      }
    }

    setLoading(true);
    try {
      const qs = await generateCourseQuiz(activeCourse, 10, scope);
      try {
        localStorage.setItem(ck, JSON.stringify({ label: scope.label, questions: qs }));
      } catch {
        /* storage full, quiz still works */
      }
      setProgress(100);
      await wait(400);
      openQuiz(qs, scope.label);
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong while creating the test.');
    } finally {
      setLoading(false);
    }
  };

  const pick = (optionIndex: number) => {
    if (answers[current] !== null) return; // locked after answering
    setAnswers((prev) => prev.map((a, i) => (i === current ? optionIndex : a)));
  };

  // ---------- Generating: progress bar ----------
  if (loading) {
    const pct = Math.min(100, Math.round(progress));
    const status =
      pct >= 100
        ? 'Test ready'
        : pct < 25
          ? 'Reading the course outline...'
          : pct < 60
            ? 'Writing questions...'
            : pct < 90
              ? 'Checking answers and explanations...'
              : 'Almost there...';
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#EBF755] border-2 border-[#121417] shadow-solid-xs flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-[#121417] animate-pulse" />
        </div>
        <h3 className="text-sm font-black text-[#121417]">Creating your test</h3>
        <p className="text-[11px] font-bold text-[#121417]/60 max-w-[240px] truncate">{current_scope.scope.label}</p>

        <div className="w-full max-w-[260px]">
          <div className="flex items-center justify-between text-[10px] font-bold text-[#121417]/70 mb-1">
            <span>{status}</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-2 bg-[#121417]/10 rounded-full overflow-hidden border border-[#121417]/20">
            <div
              className="h-full bg-[#EBF755] border-r border-[#121417]/40 transition-all duration-300 ease-out"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <p className="text-[11px] font-medium text-[#121417]/55 max-w-[240px]">
          This usually takes 5 to 20 seconds.
        </p>
      </div>
    );
  }

  // ---------- Setup: choose what to be tested on ----------
  if (stage === 'setup' || !questions) {
    const options: { id: Mode; icon: React.ElementType; title: string; desc: string; disabled?: boolean }[] = [
      { id: 'course', icon: BookOpen, title: 'Entire course', desc: `All ${videos.length} lecture${videos.length === 1 ? '' : 's'}` },
      {
        id: 'progress',
        icon: ListChecks,
        title: 'My progress',
        desc: completedCount > 0 ? `Only the ${completedCount} lecture${completedCount === 1 ? '' : 's'} you completed` : 'Mark a lecture as completed first',
        disabled: completedCount === 0,
      },
      { id: 'lecture', icon: PlayCircle, title: 'One lecture', desc: 'Pick a single video' },
    ];

    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#EBF755] border-2 border-[#121417] shadow-solid-xs flex items-center justify-center flex-shrink-0">
            <ClipboardCheck className="w-4 h-4 text-[#121417]" />
          </div>
          <div>
            <h3 className="text-sm font-black text-[#121417] leading-tight">Test yourself</h3>
            <p className="text-[11px] font-medium text-[#121417]/65">10 multiple-choice questions, written by AI</p>
          </div>
        </div>

        <div className="space-y-2">
          {options.map((o) => {
            const selected = mode === o.id;
            const Icon = o.icon;
            return (
              <button
                key={o.id}
                disabled={o.disabled}
                onClick={() => setMode(o.id)}
                className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all disabled:opacity-45 disabled:cursor-not-allowed ${
                  selected
                    ? 'bg-[#EBF755] border-[#121417] shadow-solid-xs text-black'
                    : 'bg-white border-[#121417]/20 hover:border-[#121417] text-[#121417]'
                }`}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="flex-1">
                  <span className="block text-xs font-black">{o.title}</span>
                  <span className="block text-[11px] font-medium text-[#121417]/70">{o.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        {mode === 'lecture' && (
          <div>
            <label className="block text-[11px] font-bold text-[#121417]/70 mb-1">Lecture</label>
            <select
              value={lecture?.id ?? ''}
              onChange={(e) => setLectureId(e.target.value)}
              className="w-full bg-[#F9F8F5] text-[#121417] text-xs font-bold px-3 py-2 rounded-xl border-2 border-[#121417]/20 focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
            >
              {videos.map((v, i) => (
                <option key={v.id} value={v.id}>
                  {i + 1}. {v.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {!isAiConfigured && !hasSaved && (
          <p className="text-[11px] font-bold text-red-600">
            Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.
          </p>
        )}
        {stillLoadingPlaylist && (
          <p className="text-[11px] font-bold text-[#121417]/60">
            Wait for the playlist to finish loading so the test can use the real lecture titles.
          </p>
        )}
        {error && <p className="text-[11px] font-bold text-red-600">{error}</p>}

        <button
          onClick={() => begin(false)}
          disabled={loading || !canStart}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs text-xs font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 fill-current" />}
          <span>{loading ? 'Writing your test...' : hasSaved ? 'Start saved test' : 'Generate test'}</span>
        </button>

        {hasSaved && !loading && (
          <button
            onClick={() => begin(true)}
            disabled={!isAiConfigured || !canStart}
            className="w-full text-[11px] font-black text-[#121417]/70 hover:text-[#121417] underline underline-offset-2 disabled:opacity-40 disabled:no-underline"
          >
            Generate fresh questions instead
          </button>
        )}
      </div>
    );
  }

  // ---------- Results ----------
  if (finished) {
    const score = answers.reduce<number>((s, a, i) => (a === questions[i].correctIndex ? s + 1 : s), 0);
    const answeredCount = answers.filter((a) => a !== null).length;
    return (
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        <div className="rounded-2xl border-2 border-[#121417] bg-[#EBF755] shadow-solid-xs p-4 text-center">
          <div className="text-[11px] font-bold text-[#121417]/70 mb-1 truncate">{quizLabel}</div>
          <div className="text-3xl font-black text-[#121417]">
            {score}/{questions.length}
          </div>
          <div className="text-xs font-bold text-[#121417]/80">
            {answeredCount} of {questions.length} answered.{' '}
            {score >= 8 ? 'Excellent work' : score >= 5 ? 'Good progress, review the misses below' : 'Keep going, rewatch the lectures and retry'}
          </div>
        </div>

        {questions.map((q, i) => {
          const right = answers[i] === q.correctIndex;
          return (
            <div key={i} className="rounded-xl border border-[#121417]/15 bg-white p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                {right ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <p className="text-xs font-bold text-[#121417]">{q.question}</p>
              </div>
              {!right && (
                <p className="text-[11px] font-medium text-red-600 pl-6">
                  Your answer: {answers[i] === null ? 'skipped' : q.options[answers[i] as number]}
                </p>
              )}
              <p className="text-[11px] font-bold text-emerald-700 pl-6">Correct: {q.options[q.correctIndex]}</p>
              {q.explanation && <p className="text-[11px] font-medium text-[#121417]/70 pl-6">{q.explanation}</p>}
            </div>
          );
        })}

        <div className="space-y-2 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => openQuiz(questions, quizLabel)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border-2 border-[#121417] shadow-solid-xs text-xs font-black text-[#121417] active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake</span>
            </button>
            <button
              onClick={() => {
                setStage('setup');
                begin(true);
              }}
              disabled={loading || !isAiConfigured}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs text-xs font-black active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>New questions</span>
            </button>
          </div>
          <button
            onClick={backToSetup}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-white border-2 border-[#121417]/30 hover:border-[#121417] text-xs font-black text-[#121417] active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Change test type</span>
          </button>
        </div>
      </div>
    );
  }

  // ---------- Question view ----------
  const q = questions[current];
  const chosen = answers[current];
  const answered = chosen !== null;
  const isLast = current === questions.length - 1;
  const unansweredCount = answers.filter((a) => a === null).length;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="p-3 border-b border-[#121417]/10 flex-shrink-0">
        <p className="text-[10px] font-bold text-[#121417]/55 truncate mb-0.5">{quizLabel}</p>
        <div className="flex items-center justify-between text-[10px] font-bold text-[#121417]/70">
          <span>
            Question {current + 1} of {questions.length}
          </span>
          <span>{answers.filter((a) => a !== null).length} answered</span>
        </div>
        <div className="w-full h-1.5 bg-[#121417]/10 rounded-full overflow-hidden mt-1">
          <div
            className="h-full bg-[#EBF755] border-r border-[#121417]/30 transition-all duration-300"
            style={{ width: `${((current + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2.5">
        <p className="text-sm font-black text-[#121417] leading-snug">{q.question}</p>

        {q.options.map((opt, i) => {
          const isCorrect = i === q.correctIndex;
          const isChosen = i === chosen;
          let style = 'bg-white border-[#121417]/20 hover:border-[#121417] text-[#121417]';
          if (answered && isCorrect) style = 'bg-emerald-50 border-emerald-600 text-emerald-900';
          else if (answered && isChosen) style = 'bg-red-50 border-red-500 text-red-900';
          else if (answered) style = 'bg-white border-[#121417]/10 text-[#121417]/50';

          return (
            <button
              key={i}
              onClick={() => pick(i)}
              disabled={answered}
              className={`w-full text-left flex items-start gap-2.5 px-3 py-2.5 rounded-xl border-2 text-xs font-bold transition-all ${style}`}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-md border border-current flex items-center justify-center text-[10px] font-black">
                {LETTERS[i]}
              </span>
              <span className="flex-1">{opt}</span>
            </button>
          );
        })}

        {answered && q.explanation && (
          <p className="text-[11px] font-medium text-[#121417]/75 bg-[#F9F8F5] rounded-xl border border-[#121417]/10 p-2.5">
            {q.explanation}
          </p>
        )}
      </div>

      <div className="p-3 border-t border-[#121417]/10 flex-shrink-0">
        {confirmEnd ? (
          <div className="space-y-2">
            <p className="text-xs font-bold text-[#121417]">
              End the test now? {unansweredCount} unanswered question{unansweredCount === 1 ? '' : 's'} will count as skipped.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmEnd(false)}
                className="flex-1 py-2.5 rounded-xl bg-white border-2 border-[#121417] shadow-solid-xs text-xs font-black text-[#121417] active:scale-95"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirmEnd(false);
                  setFinished(true);
                }}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white border-2 border-[#121417] shadow-solid-xs text-xs font-black active:scale-95"
              >
                End test
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => (unansweredCount === 0 ? setFinished(true) : setConfirmEnd(true))}
              className="px-4 py-2.5 rounded-xl bg-white border-2 border-[#121417] shadow-solid-xs text-xs font-black text-[#121417] active:scale-95"
            >
              End test
            </button>
            <button
              onClick={() => (isLast ? setFinished(true) : setCurrent((c) => c + 1))}
              disabled={!answered}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs text-xs font-black active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span>{isLast ? 'See results' : 'Next question'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};