import { supabase, isSupabaseConfigured } from '../lib/supabase';

/**
 * Review Service — handles submitting user reviews/bug reports to Supabase.
 *
 * Supabase table: "reviews"
 * Columns:
 *   id          UUID  (auto-generated, primary key)
 *   created_at  TIMESTAMPTZ (default now())
 *   name        TEXT
 *   email       TEXT
 *   rating      INT (1–5)
 *   type        TEXT ('feedback' | 'bug')
 *   message     TEXT
 */

export interface ReviewPayload {
  name: string;
  email: string;
  rating: number;
  type: 'feedback' | 'bug';
  message: string;
}

/**
 * Submit a review to the "reviews" table in Supabase.
 * Returns true on success, or throws with a user-friendly message on failure.
 */
export async function submitReview(payload: ReviewPayload): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Database is not configured. Please try again later.');
  }

  const { error } = await supabase.from('reviews').insert([
    {
      name: payload.name.trim(),
      email: payload.email.trim(),
      rating: payload.rating,
      type: payload.type,
      message: payload.message.trim(),
    },
  ]);

  if (error) {
    console.error('Supabase submitReview error:', error.message);
    throw new Error('Failed to submit review. Please try again.');
  }

  return true;
}
