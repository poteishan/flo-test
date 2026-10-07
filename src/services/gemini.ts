import type { Course } from '../types';

export interface QuizQuestion {
  question: string;
  options: string[]; // always 4
  correctIndex: number; // 0-3
  explanation: string;
  /** Seconds from the start of the video where the answer is explained (single-lecture tests only). */
  timestamp?: number;
  /** Which lecture the timestamp belongs to (set for "My progress" tests, where questions come from several videos). */
  videoId?: string;
}

/** What the test should cover. */
export interface QuizScope {
  kind: 'course' | 'progress' | 'lecture';
  label: string; // shown in the UI, e.g. "Lecture 4: Loops"
  videos: { n: number; title: string; id?: string; youtubeId?: string; durationSec?: number }[]; // n = lecture number (1-based); durationSec = real video length, used to reject out-of-range timestamps
}

export interface QuizResult {
  questions: QuizQuestion[];
  /** Set when something was skipped, e.g. timestamps unavailable. Shown to the learner. */
  notice?: string;
}

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

// "-latest" aliases always point to Google's current model, so retirements don't break the app.
// Optional override: set VITE_GEMINI_MODEL in .env (e.g. gemini-3-flash-preview).
// If a model returns 404 (retired / not available to new users), the next one is tried.
const MODEL_CANDIDATES = [
  import.meta.env.VITE_GEMINI_MODEL as string | undefined,
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3-flash-preview',
].filter((m): m is string => Boolean(m));

export const isAiConfigured = Boolean(API_KEY);

class GeminiHttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const buildSchema = (withTimestamp: boolean) => ({
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      correctIndex: { type: 'INTEGER' },
      explanation: { type: 'STRING' },
      ...(withTimestamp ? { timestamp: { type: 'INTEGER' } } : {}),
    },
    required: ['question', 'options', 'correctIndex', 'explanation', ...(withTimestamp ? ['timestamp'] : [])],
  },
});

const fmtLength = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

function buildPrompt(course: Course, count: number, scope: QuizScope, withVideo: boolean): string {
  const videoLengthSec = scope.kind === 'lecture' ? scope.videos[0]?.durationSec : undefined;
  const lectureList = scope.videos
    .map((v) => `${v.n}. ${v.title}`)
    .join('\n')
    .slice(0, 12000);

  let focus: string;
  let listHeading: string;
  if (scope.kind === 'lecture') {
    focus = withVideo
      ? `You are given the full video of this ONE lecture: "${scope.videos[0]?.title ?? ''}". Watch it. Base EVERY question on what is actually taught, said or shown in the video, not on the title alone.`
      : `Write every question about this ONE lecture only: "${scope.videos[0]?.title ?? ''}". Use the course title and outline for context. If the lecture title is short or generic, test the core concepts a lecture with that title would teach.`;
    listHeading = 'Lecture to test:';
  } else if (scope.kind === 'progress') {
    focus = `The learner has completed ONLY the lectures listed below. Test only topics those lectures cover. Do not ask about material from lectures they have not reached yet. Spread the questions across the completed lectures.`;
    listHeading = 'Completed lectures:';
  } else {
    focus = `Cover different lectures/topics across the whole course.`;
    listHeading = 'Lectures:';
  }

  // For a single lecture, give the course outline as background context only.
  const outline =
    scope.kind === 'lecture'
      ? `\nCourse outline (context only, do not test these):\n${course.videos
          .map((v, i) => `${i + 1}. ${v.title}`)
          .join('\n')
          .slice(0, 4000)}\n`
      : '';

  const lengthRule = videoLengthSec
    ? ` The video is exactly ${fmtLength(videoLengthSec)} long (${videoLengthSec} seconds), so every "timestamp" MUST be between 0 and ${videoLengthSec}. Give plain total seconds, not H:MM:SS.`
    : ' Give plain total seconds, not H:MM:SS.';
  const timestampRule = withVideo
    ? `\n- "timestamp" is the number of SECONDS from the very start of the video at the moment the answer is explained or shown, i.e. where a learner should rewind to. Use the real position in the video as a whole number. Never give a value larger than the video's length.${lengthRule}`
    : '';

  return `You are an expert instructor. Write a test of exactly ${count} multiple-choice questions that checks real understanding of the topics taught in the part of the online course described below.

Rules:
- ${focus}
- Difficulty: EASY to MEDIUM. Ask simple recall and basic-understanding questions about what the lecture itself teaches. No tricky edge cases, no multi-step puzzles, no advanced or "what if" extensions.
- Ask ONLY about content that is actually taught, said or shown in the lecture. Never use outside knowledge, and never ask about related topics the lecture does not cover, even if they belong to the same subject. ${withVideo ? 'Every question must be answerable by someone who simply watched the video.' : 'Stick to the basic core concepts the lecture titles directly name; do not go beyond them.'}
- No two questions should test the same idea.
- Each question has exactly 4 options and exactly one correct answer.
- Distractors must be plausible, not silly.
- Do not ask about lecture numbers or video titles themselves; ask about the concepts.
- Put the correct answer at varied positions; do not always use the same index.
- "correctIndex" is the 0-based index of the correct option.
- "explanation" is 1-2 sentences on why the answer is correct.${timestampRule}

Course title: ${course.title}
Description: ${course.description ?? 'n/a'}
${outline}
${listHeading}
${lectureList}`;
}

/** One Gemini call, with retry on overload and fallback across model names. Returns the raw text. */
async function callGemini(parts: unknown[], extraConfig: Record<string, unknown>, schema: object): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.5, // lower = sticks closer to the video instead of drifting
      responseMimeType: 'application/json',
      responseSchema: schema,
      ...extraConfig,
    },
  });

  // Errors worth working around: model retired (404), per-model limit (429),
  // server error (500) and "high demand" overload (503). Each model has its own capacity.
  const RETRYABLE = new Set([404, 429, 500, 503]);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  let res: Response | null = null;
  let lastStatus = 0;
  let lastDetail = '';

  outer: for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY as string },
          body,
        },
      );
      if (res.ok || !RETRYABLE.has(res.status)) break outer;

      lastStatus = res.status;
      lastDetail = await res.text().catch(() => '');
      if (res.status === 503 && attempt === 0) {
        await sleep(2000); // overloaded: wait briefly and retry the same model once
        continue;
      }
      break; // otherwise move on to the next model
    }
  }

  if (!res || !res.ok) {
    let status = lastStatus;
    let detail = lastDetail;
    if (res && !res.ok && !RETRYABLE.has(res.status)) {
      status = res.status;
      detail = await res.text().catch(() => '');
    }
    if (status === 503) throw new GeminiHttpError(status, 'Gemini is overloaded right now. Please try again in a minute.');
    if (status === 429) throw new GeminiHttpError(status, 'Gemini free-tier limit reached. Try again in a minute.');
    throw new GeminiHttpError(status, `Gemini request failed (${status}). ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiHttpError(0, 'Gemini returned an empty response. Please try again.');
  return text;
}

function parseQuestions(text: string, count: number, withTimestamp: boolean, minValid = 3): QuizQuestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch {
    throw new Error('Could not read the quiz Gemini generated. Please try again.');
  }

  const questions = (Array.isArray(parsed) ? parsed : [])
    .filter(
      (q: any): q is QuizQuestion =>
        q &&
        typeof q.question === 'string' &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.correctIndex) &&
        q.correctIndex >= 0 &&
        q.correctIndex < 4,
    )
    .slice(0, count)
    .map((q) => ({
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation ?? '',
      timestamp:
        withTimestamp && Number.isFinite(q.timestamp) && (q.timestamp as number) >= 0
          ? Math.round(q.timestamp as number)
          : undefined,
    }));

  if (questions.length < minValid) throw new Error('Gemini did not return enough valid questions. Please try again.');
  return questions;
}

/**
 * Makes sure EVERY question has a timestamp inside the video.
 * 1) Questions with a missing or out-of-range time are sent back to Gemini (with the video) to be located again.
 * 2) Anything still wrong is repaired locally, e.g. 2:20:15 on a 1-hour video was meant as 20:15.
 */
async function ensureTimestamps(
  questions: QuizQuestion[],
  videoUrl: string,
  maxSec: number | undefined,
): Promise<QuizQuestion[]> {
  const isValid = (t?: number) => t !== undefined && (!maxSec || t <= maxSec);
  const badIdx = questions.map((q, i) => (isValid(q.timestamp) ? -1 : i)).filter((i) => i >= 0);
  if (badIdx.length === 0) return questions;

  const fixed = questions.map((q) => ({ ...q }));

  // Step 1: ask Gemini to find the moments again, for just the questions that need it.
  try {
    const list = badIdx
      .map(
        (i) =>
          `${i}. Question: ${questions[i].question}\n   Correct answer: ${questions[i].options[questions[i].correctIndex]}\n   Explanation: ${questions[i].explanation}`,
      )
      .join('\n');
    const lengthText = maxSec
      ? ` The video is exactly ${fmtLength(maxSec)} long (${maxSec} seconds), so every timestamp MUST be between 0 and ${maxSec}.`
      : '';
    const text = await callGemini(
      [
        { file_data: { file_uri: videoUrl } },
        {
          text: `Watch this video. For each numbered question below, give the moment in the video, in total SECONDS from the very start (a whole number, not H:MM:SS), where the answer is explained or shown.${lengthText}\n\n${list}\n\nReturn one item per question using its number as "index".`,
        },
      ],
      { mediaResolution: 'MEDIA_RESOLUTION_LOW', temperature: 0.2 },
      {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: { index: { type: 'INTEGER' }, timestamp: { type: 'INTEGER' } },
          required: ['index', 'timestamp'],
        },
      },
    );
    const found = JSON.parse(text.replace(/```json|```/g, '').trim());
    if (Array.isArray(found)) {
      for (const f of found) {
        if (badIdx.includes(f?.index) && Number.isFinite(f?.timestamp) && f.timestamp >= 0 && isValid(Math.round(f.timestamp))) {
          fixed[f.index].timestamp = Math.round(f.timestamp);
        }
      }
    }
  } catch {
    /* fall through to local repair */
  }

  // Step 2: local repair for anything still missing or out of range.
  const lastResort = maxSec ?? 0;
  fixed.forEach((q, i) => {
    if (isValid(q.timestamp)) return;
    if (q.timestamp !== undefined && maxSec) {
      const withoutHours = q.timestamp % 3600; // 8415s (2:20:15) -> 1215s (20:15)
      q.timestamp = withoutHours <= maxSec ? withoutHours : maxSec;
      return;
    }
    // No time at all: borrow the closest question's time (or the start of the video).
    let nearest: number | undefined;
    for (let d = 1; d < fixed.length && nearest === undefined; d++) {
      const a = fixed[i - d]?.timestamp;
      const b = fixed[i + d]?.timestamp;
      if (a !== undefined && isValid(a)) nearest = a;
      else if (b !== undefined && isValid(b)) nearest = b;
    }
    q.timestamp = nearest ?? Math.min(0, lastResort);
  });
  return fixed;
}

export async function generateCourseQuiz(
  course: Course,
  count = 10,
  scope?: QuizScope,
): Promise<QuizResult> {
  if (!API_KEY) {
    throw new Error('Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.');
  }

  const effectiveScope: QuizScope = scope ?? {
    kind: 'course',
    label: 'Entire course',
    videos: course.videos.map((v, i) => ({ n: i + 1, title: v.title })),
  };

  // Timestamps need Gemini to actually watch the video, so they are only possible for a single lecture.
  const target = effectiveScope.kind === 'lecture' ? effectiveScope.videos[0] : undefined;
  const videoUrl = target?.youtubeId ? `https://www.youtube.com/watch?v=${target.youtubeId}` : undefined;

  let notice: string | undefined;

  // "My progress": watch several of the completed lectures, so each question gets a timestamp in ITS OWN video.
  if (effectiveScope.kind === 'progress') {
    const MAX_VIDEOS = 5;
    const linked = effectiveScope.videos.filter((v) => v.youtubeId && v.id);
    if (linked.length > 0) {
      // Pick up to MAX_VIDEOS lectures spread evenly across everything completed.
      const picked =
        linked.length <= MAX_VIDEOS
          ? linked
          : Array.from({ length: MAX_VIDEOS }, (_, i) => linked[Math.floor((i * linked.length) / MAX_VIDEOS)]);
      const base = Math.floor(count / picked.length);
      const extra = count % picked.length;

      const results = await Promise.allSettled(
        picked.map(async (v, i) => {
          const n = base + (i < extra ? 1 : 0);
          const url = `https://www.youtube.com/watch?v=${v.youtubeId}`;
          const single: QuizScope = { kind: 'lecture', label: v.title, videos: [v] };
          const text = await callGemini(
            [{ file_data: { file_uri: url } }, { text: buildPrompt(course, n, single, true) }],
            { mediaResolution: 'MEDIA_RESOLUTION_LOW' },
            buildSchema(true),
          );
          const qs = await ensureTimestamps(parseQuestions(text, n, true, 1), url, v.durationSec);
          return qs.map((q) => ({ ...q, videoId: v.id }));
        }),
      );

      const all = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
      if (all.length >= 3) {
        if (results.some((r) => r.status === 'rejected')) {
          notice = 'Some lectures could not be analyzed, so this test has fewer questions than requested.';
        }
        // Mix the lectures together so the test is not grouped by video.
        for (let i = all.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [all[i], all[j]] = [all[j], all[i]];
        }
        return { questions: all, notice };
      }
      notice = 'Gemini could not analyze the completed videos, so this test has no timestamps. The videos must be public.';
    }
  }

  if (videoUrl) {
    try {
      const text = await callGemini(
        [{ file_data: { file_uri: videoUrl } }, { text: buildPrompt(course, count, effectiveScope, true) }],
        { mediaResolution: 'MEDIA_RESOLUTION_LOW' }, // keeps long videos within token limits
        buildSchema(true),
      );
      const parsed = parseQuestions(text, count, true);
      return { questions: await ensureTimestamps(parsed, videoUrl, target?.durationSec) };
    } catch (e) {
      const code = e instanceof GeminiHttpError && e.status ? ` (error ${e.status})` : '';
      notice = `Gemini could not analyze the video${code}, so this test has no timestamps. The video must be public, and very long videos can exceed the free-tier limit.`;
    }
  } else if (effectiveScope.kind === 'lecture') {
    notice = 'This lecture has no YouTube link, so there are no timestamps.';
  }

  const text = await callGemini([{ text: buildPrompt(course, count, effectiveScope, false) }], {}, buildSchema(false));
  return { questions: parseQuestions(text, count, false), notice };
}