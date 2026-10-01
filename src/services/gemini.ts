import type { Course } from '../types';

export interface QuizQuestion {
  question: string;
  options: string[]; // always 4
  correctIndex: number; // 0-3
  explanation: string;
}

/** What the test should cover. */
export interface QuizScope {
  kind: 'course' | 'progress' | 'lecture';
  label: string; // shown in the UI, e.g. "Lecture 4: Loops"
  videos: { n: number; title: string }[]; // n = lecture number in the course (1-based)
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

const responseSchema = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      question: { type: 'STRING' },
      options: { type: 'ARRAY', items: { type: 'STRING' } },
      correctIndex: { type: 'INTEGER' },
      explanation: { type: 'STRING' },
    },
    required: ['question', 'options', 'correctIndex', 'explanation'],
  },
};

export async function generateCourseQuiz(
  course: Course,
  count = 10,
  scope?: QuizScope,
): Promise<QuizQuestion[]> {
  if (!API_KEY) {
    throw new Error('Gemini API key missing. Add VITE_GEMINI_API_KEY to your .env file and restart the dev server.');
  }

  const effectiveScope: QuizScope = scope ?? {
    kind: 'course',
    label: 'Entire course',
    videos: course.videos.map((v, i) => ({ n: i + 1, title: v.title })),
  };

  const lectureList = effectiveScope.videos
    .map((v) => `${v.n}. ${v.title}`)
    .join('\n')
    .slice(0, 12000);

  let focus: string;
  let listHeading: string;
  if (effectiveScope.kind === 'lecture') {
    focus = `Write every question about this ONE lecture only: "${effectiveScope.videos[0]?.title ?? ''}". Use the course title and outline for context. If the lecture title is short or generic, test the core concepts a lecture with that title would teach.`;
    listHeading = 'Lecture to test:';
  } else if (effectiveScope.kind === 'progress') {
    focus = `The learner has completed ONLY the lectures listed below. Test only topics those lectures cover. Do not ask about material from lectures they have not reached yet. Spread the questions across the completed lectures.`;
    listHeading = 'Completed lectures:';
  } else {
    focus = `Cover different lectures/topics across the whole course.`;
    listHeading = 'Lectures:';
  }

  // For a single lecture, give the course outline as background context only.
  const outline =
    effectiveScope.kind === 'lecture'
      ? `\nCourse outline (context only, do not test these):\n${course.videos
          .map((v, i) => `${i + 1}. ${v.title}`)
          .join('\n')
          .slice(0, 4000)}\n`
      : '';

  const prompt = `You are an expert instructor. Write a test of exactly ${count} multiple-choice questions that checks real understanding of the topics taught in the part of the online course described below.

Rules:
- ${focus}
- Infer the subject and difficulty level from the course title, description and lecture titles.
- No two questions should test the same idea.
- Each question has exactly 4 options and exactly one correct answer.
- Distractors must be plausible, not silly.
- Do not ask about lecture numbers or video titles themselves; ask about the concepts.
- Put the correct answer at varied positions; do not always use the same index.
- "correctIndex" is the 0-based index of the correct option.
- "explanation" is 1-2 sentences on why the answer is correct.

Course title: ${course.title}
Description: ${course.description ?? 'n/a'}
${outline}
${listHeading}
${lectureList}`;

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.8,
      responseMimeType: 'application/json',
      responseSchema,
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
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
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
    if (status === 503) throw new Error('Gemini is overloaded right now. Please try again in a minute.');
    if (status === 429) throw new Error('Gemini free-tier limit reached. Try again in a minute.');
    throw new Error(`Gemini request failed (${status}). ${detail.slice(0, 200)}`);
  }

  const data = await res.json();
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned an empty response. Please try again.');

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
    .map((q) => ({ ...q, explanation: q.explanation ?? '' }));

  if (questions.length < 3) throw new Error('Gemini did not return enough valid questions. Please try again.');
  return questions;
}