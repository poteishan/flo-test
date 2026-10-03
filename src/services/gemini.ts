import type { Course } from '../types';

export interface QuizQuestion {
  question: string;
  options: string[]; // always 4
  correctIndex: number; // 0-3
  explanation: string;
  /** Seconds from the start of the video where the answer is explained (single-lecture tests only). */
  timestamp?: number;
}

/** What the test should cover. */
export interface QuizScope {
  kind: 'course' | 'progress' | 'lecture';
  label: string; // shown in the UI, e.g. "Lecture 4: Loops"
  videos: { n: number; title: string; youtubeId?: string }[]; // n = lecture number (1-based)
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

function buildPrompt(course: Course, count: number, scope: QuizScope, withVideo: boolean): string {
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

  const timestampRule = withVideo
    ? `\n- "timestamp" is the number of SECONDS from the very start of the video at the moment the answer is explained or shown, i.e. where a learner should rewind to. Use the real position in the video as a whole number. Never give a value larger than the video's length.`
    : '';

  return `You are an expert instructor. Write a test of exactly ${count} multiple-choice questions that checks real understanding of the topics taught in the part of the online course described below.

Rules:
- ${focus}
- Infer the subject and difficulty level from the course title, description and lecture titles.
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
      temperature: 0.8,
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

function parseQuestions(text: string, count: number, withTimestamp: boolean): QuizQuestion[] {
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

  if (questions.length < 3) throw new Error('Gemini did not return enough valid questions. Please try again.');
  return questions;
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

  if (videoUrl) {
    try {
      const text = await callGemini(
        [{ file_data: { file_uri: videoUrl } }, { text: buildPrompt(course, count, effectiveScope, true) }],
        { mediaResolution: 'MEDIA_RESOLUTION_LOW' }, // keeps long videos within token limits
        buildSchema(true),
      );
      return { questions: parseQuestions(text, count, true) };
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