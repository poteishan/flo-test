import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ClipboardCheck,
  BookOpen,
  ListChecks,
  PlayCircle,
  ArrowLeft,
  Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { parseTimestampToSeconds } from '../utils/youtube';
import { generateCourseQuiz, isAiConfigured } from '../services/gemini';
import type { QuizQuestion, QuizScope } from '../services/gemini';

type Mode = 'course' | 'progress' | 'lecture';

const LETTERS = ['A', 'B', 'C', 'D'];

// 75 -> "1:15", 3725 -> "1:02:05"
const fmtTime = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Small string hash so cache keys stay short and change whenever lecture titles change.
const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
};

export const CourseTest: React.FC = () => {
  const { activeCourse, activeVideoId, setActiveVideoId, seekTo, toggleVideoCompletion, ytPlayer } = useApp();

  const [stage, setStage] = useState<'setup' | 'quiz'>('setup');
  const [mode, setMode] = useState<Mode>('course');
  const [quizLabel, setQuizLabel] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [quizNotice, setQuizNotice] = useState<string | undefined>(undefined);
  const [quizVideoId, setQuizVideoId] = useState<string | undefined>(undefined); // video the timestamps belong to

  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [current, setCurrent] = useState(0);
  const [finished, setFinished] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100, shown while generating
  const [error, setError] = useState<string | null>(null);

  const courseId = activeCourse?.id;

  const openQuiz = (qs: QuizQuestion[], label: string, opts?: { notice?: string; videoId?: string }) => {
    setQuestions(qs);
    setQuizLabel(label);
    setQuizNotice(opts?.notice);
    setQuizVideoId(opts?.videoId);
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
    const vs = activeCourse?.videos ?? [];
    const done = vs.filter((v) => v.completed).length;
    setMode(vs.length > 0 && done === vs.length ? 'course' : done > 0 ? 'progress' : 'lecture');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  // The AI gives no real progress signal, so ease toward 92% while waiting
  // and jump to 100% once the questions arrive.
  useEffect(() => {
    if (!loading) return;
    setProgress(4);
    const id = setInterval(() => {
      // Watching a whole video takes longer, so the bar moves more slowly for single-lecture tests.
      const rate = mode === 'lecture' ? 0.02 : 0.05;
      setProgress((p) => (p >= 92 ? p : p + Math.max(0.2, (92 - p) * rate)));
    }, 250);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  if (!activeCourse) return null;

  const videos = activeCourse.videos;
  const completedCount = videos.filter((v) => v.completed).length;
  const allCompleted = videos.length > 0 && completedCount === videos.length;

  // How many questions each test type offers.
  //  - Entire course: 10 / 20 / 30
  //  - My progress: 10 / 20 once 5 or more lectures are completed (otherwise 10)
  //  - One lecture: 10
  const allowedCounts = (m: Mode): number[] =>
    m === 'course' ? [10, 20, 30] : m === 'progress' && completedCount >= 5 ? [10, 20] : [10];
  const countFor = (m: Mode) => (allowedCounts(m).includes(questionCount) ? questionCount : 10);
  // The single-lecture test always uses the video that is open in the player.
  const lectureIndex = Math.max(0, videos.findIndex((v) => v.id === activeVideoId));
  const lecture = videos[lectureIndex];
  // Jump the player to the moment in the video where the answer is explained.
  const goToTimestamp = (seconds: number) => {
    if (!quizVideoId) return;
    const needsSwitch = quizVideoId !== activeVideoId;
    if (needsSwitch) setActiveVideoId(quizVideoId);
    // After switching videos, wait for the player to load before seeking (seeking twice is harmless).
    (needsSwitch ? [1500, 3500] : [0]).forEach((d) => setTimeout(() => seekTo(seconds), d));
  };

  // Real length of a lecture in seconds: the live player knows it best, otherwise the saved "H:MM:SS" string.
  const durationSecFor = (videoId: string | undefined): number | undefined => {
    if (!videoId) return undefined;
    if (videoId === activeVideoId && ytPlayer && typeof ytPlayer.getDuration === 'function') {
      const d = Number(ytPlayer.getDuration());
      if (Number.isFinite(d) && d > 0) return Math.floor(d);
    }
    const stored = videos.find((v) => v.id === videoId)?.duration;
    const parsed = stored ? parseTimestampToSeconds(stored) : null;
    return parsed && parsed > 0 ? parsed : undefined;
  };

  const renderTimestamp = (qq: QuizQuestion) => {
    if (qq.timestamp === undefined || !quizVideoId) return null;
    // Hide timestamps past the end of the video (also covers tests saved before this check existed).
    const maxSec = durationSecFor(quizVideoId);
    if (maxSec && qq.timestamp > maxSec) return null;
    return (
      <button
        onClick={() => goToTimestamp(qq.timestamp as number)}
        title="Jump to this moment in the video (AI estimate, may be a few seconds off)"
        className="inline-flex items-center gap-1.5 max-w-full text-[11px] font-black text-[#121417] bg-[#EBF755]/70 hover:bg-[#EBF755] border border-[#121417]/40 rounded-lg px-2 py-1 transition-colors"
      >
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">Answer explained at {fmtTime(qq.timestamp)}</span>
      </button>
    );
  };

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
        scope: {
          kind: 'lecture',
          label: `Lecture ${n}: ${title}`,
          videos: [{ n, title, youtubeId: lecture?.youtubeId, durationSec: durationSecFor(lecture?.id) }],
        },
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

  const cacheKeyFor = (key: string) => `flo-quiz:v5:${activeCourse.id}:${key}:q${countFor(mode)}`;

  const current_scope = scopeFor(mode);
  let hasSaved = false;
  try {
    hasSaved = Boolean(localStorage.getItem(cacheKeyFor(current_scope.key)));
  } catch {
    /* ignore */
  }

  const canStart =
    isAiConfigured || hasSaved
      ? !stillLoadingPlaylist && !(mode === 'progress' && completedCount === 0) && !(mode === 'lecture' && !lecture?.completed) && !(mode === 'course' && !allCompleted)
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
            openQuiz(saved.questions, scope.label, { notice: saved.notice, videoId: saved.videoId });
            return;
          }
        }
      } catch {
        /* bad cache, regenerate */
      }
    }

    setLoading(true);
    try {
      const { questions: qs, notice } = await generateCourseQuiz(activeCourse, countFor(mode), scope);
      const videoId = scope.kind === 'lecture' ? lecture?.id : undefined;
      try {
        localStorage.setItem(ck, JSON.stringify({ label: scope.label, questions: qs, notice, videoId }));
      } catch {
        /* storage full, quiz still works */
      }
      setProgress(100);
      await wait(400);
      openQuiz(qs, scope.label, { notice, videoId });
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
          ? mode === 'lecture'
            ? 'Watching the lecture...'
            : 'Reading the course outline...'
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
          {mode === 'lecture'
            ? 'Well Done! now Test for skills for real you!'
            : countFor(mode) > 10
              ? 'Longer tests take a bit more time, usually under a minute.'
              : 'This usually takes 5 to 20 seconds.'}
        </p>
      </div>
    );
  }

  // ---------- Setup: choose what to be tested on ----------
  if (stage === 'setup' || !questions) {
    const options: { id: Mode; icon: React.ElementType; title: string; desc: string; disabled?: boolean }[] = [
      {
        id: 'course',
        icon: BookOpen,
        title: 'Entire course',
        desc: allCompleted
          ? `All ${videos.length} lecture${videos.length === 1 ? '' : 's'} completed`
          : `Unlocks when every lecture is completed (${completedCount}/${videos.length} done)`,
        disabled: !allCompleted,
      },
      {
        id: 'progress',
        icon: ListChecks,
        title: 'My progress',
        desc: completedCount > 0 ? `Only the ${completedCount} lecture${completedCount === 1 ? '' : 's'} you completed` : 'Mark a lecture as completed first',
        disabled: completedCount === 0,
      },
      { id: 'lecture', icon: PlayCircle, title: 'One lecture', desc: 'The video you have open (must be marked completed)' },
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

        {allowedCounts(mode).length > 1 && !(mode === 'course' && !allCompleted) && (
          <div>
            <p className="text-[11px] font-bold text-[#121417]/70 mb-1">Number of questions</p>
            <div className="flex gap-2">
              {allowedCounts(mode).map((n) => {
                const selected = countFor(mode) === n;
                return (
                  <button
                    key={n}
                    onClick={() => setQuestionCount(n)}
                    className={`flex-1 py-2 rounded-xl border-2 text-xs font-black transition-all active:scale-95 ${
                      selected
                        ? 'bg-[#121417] text-[#EBF755] border-[#121417] shadow-solid-xs'
                        : 'bg-white text-[#121417] border-[#121417]/20 hover:border-[#121417]'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'progress' && completedCount > 0 && completedCount < 5 && (
          <p className="text-[10px] font-bold text-[#121417]/55">
            Complete 5 lectures to choose a 20-question test ({completedCount}/5 done).
          </p>
        )}

        {mode === 'course' && !allCompleted && (
          <div className="rounded-xl border-2 border-[#121417]/20 bg-[#F9F8F5] p-3 space-y-1.5">
            <p className="text-xs font-black text-[#121417]">
              {completedCount} of {videos.length} lectures completed
            </p>
            <div className="w-full h-1.5 bg-[#121417]/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#EBF755] border-r border-[#121417]/30"
                style={{ width: `${Math.round((completedCount / (videos.length || 1)) * 100)}%` }}
              />
            </div>
            <p className="text-[11px] font-medium text-[#121417]/70">
              Complete the whole course to unlock this test. You can use the check-all button in the Playlist tab.
            </p>
          </div>
        )}

        {mode === 'lecture' && lecture && (
          <div className="rounded-xl border-2 border-[#121417]/20 bg-[#F9F8F5] p-3 space-y-2">
            <p className="text-[10px] font-bold text-[#121417]/60">The test covers the video you have open</p>
            <p className="text-xs font-black text-[#121417]">
              Lecture {lectureIndex + 1}: {lecture.title}
            </p>
            {lecture.completed ? (
              <p className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Marked as completed
              </p>
            ) : (
              <>
                <p className="text-[11px] font-medium text-[#121417]/70">
                  Mark this lecture as completed to unlock its test.
                </p>
                <button
                  onClick={() => toggleVideoCompletion(activeCourse.id, lecture.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-[#121417] shadow-solid-xs text-[11px] font-black text-[#121417] active:scale-95"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as completed
                </button>
              </>
            )}
            <p className="text-[10px] font-medium text-[#121417]/50">
              To test a different lecture, open it from the Playlist tab first.
            </p>
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
          {quizNotice && <div className="text-[10px] font-bold text-[#121417]/70 mt-1">{quizNotice}</div>}
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
              {renderTimestamp(q) && <div className="pl-6 pt-0.5">{renderTimestamp(q)}</div>}
            </div>
          );
        })}

        <div className="space-y-2 pb-2">
          <div className="flex gap-2">
            <button
              onClick={() => openQuiz(questions, quizLabel, { notice: quizNotice, videoId: quizVideoId })}
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
            <span>Go back</span>
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
        {quizNotice && <p className="text-[10px] font-bold text-amber-700 mb-0.5">{quizNotice}</p>}
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

        {answered && renderTimestamp(q)}
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
          <div className="space-y-2">
            <div className="flex gap-2">
              <button
                onClick={() => setCurrent((c) => Math.max(0, c - 1))}
                disabled={current === 0}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white border-2 border-[#121417] shadow-solid-xs text-xs font-black text-[#121417] active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                onClick={() => {
                  if (!isLast) setCurrent((c) => c + 1);
                  else if (unansweredCount === 0) setFinished(true);
                  else setConfirmEnd(true); // some questions skipped: ask before finishing
                }}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs text-xs font-black active:scale-95"
              >
                <span>{isLast ? 'See results' : 'Next'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <button
              onClick={() => (unansweredCount === 0 ? setFinished(true) : setConfirmEnd(true))}
              className="w-full text-[11px] font-black text-[#121417]/65 hover:text-[#121417] underline underline-offset-2"
            >
              End test
            </button>
          </div>
        )}
      </div>
    </div>
  );
};