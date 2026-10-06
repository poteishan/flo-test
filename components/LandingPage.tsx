import React, { useState, useEffect } from 'react';
import {
  SignInButton,
  SignUpButton,
  useAuth,
  useClerk,
} from '@clerk/clerk-react';
import { 
  Check, 
  Plus, 
  Minus, 
  Play, 
  Clock, 
  BookmarkPlus, 
  Flame, 
  CheckCircle2, 
  Laptop,
  Menu,
  X,
  Coffee,
  ShieldCheck,
  ArrowRight,
  FileText,
  Timer,
  SkipBack,
  SkipForward,
  Gauge,
  Maximize2,
  ListVideo,
  Star,
  Send,
  Bug,
  MessageSquare,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { submitReview } from '../services/reviews';

interface LandingPageProps {
  hasClerkKey: boolean;
  onEnterDemo: () => void;
}

// Module-level so the modal auto-opens only once per page load (not again after
// returning from the demo, and not twice under StrictMode's double effects).
let hasAutoOpenedSignIn = false;

// Opens Clerk's themed sign-in modal as soon as a signed-out visitor lands on the site.
// Rendered only when Clerk is configured, since Clerk hooks require a ClerkProvider.
const AutoOpenSignIn: React.FC = () => {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();

  useEffect(() => {
    if (!isLoaded || isSignedIn || hasAutoOpenedSignIn) return;
    hasAutoOpenedSignIn = true;
    clerk.openSignIn();
  }, [isLoaded, isSignedIn, clerk]);

  return null;
};

export const LandingPage: React.FC<LandingPageProps> = ({ hasClerkKey, onEnterDemo }) => {
  // If a signed-out visitor loads a dashboard URL (e.g. /notes), show the landing page at "/".
  useEffect(() => {
    if (/^\/(playlists|workspace|notes)\/?$/.test(window.location.pathname)) {
      window.history.replaceState(
        { ...window.history.state, floView: undefined },
        '',
        `/${window.location.search}${window.location.hash}`
      );
    }
  }, []);

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewHover, setReviewHover] = useState(0);
  const [reviewName, setReviewName] = useState('');
  const [reviewEmail, setReviewEmail] = useState('');
  const [reviewType, setReviewType] = useState<'feedback' | 'bug'>('feedback');
  const [reviewMessage, setReviewMessage] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState('');

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError('');

    if (reviewRating === 0) {
      setReviewError('Please select a star rating.');
      return;
    }
    if (!reviewName.trim()) {
      setReviewError('Please enter your name.');
      return;
    }
    if (!reviewEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewEmail)) {
      setReviewError('Please enter a valid email address.');
      return;
    }
    if (!reviewMessage.trim()) {
      setReviewError('Please write a message.');
      return;
    }

    setReviewSubmitting(true);
    try {
      await submitReview({
        name: reviewName,
        email: reviewEmail,
        rating: reviewRating,
        type: reviewType,
        message: reviewMessage,
      });
      setReviewSubmitted(true);
      setReviewRating(0);
      setReviewName('');
      setReviewEmail('');
      setReviewType('feedback');
      setReviewMessage('');
    } catch (err: any) {
      setReviewError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setReviewSubmitting(false);
    }
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="min-h-screen bg-[#F9F8F5] text-[#121417] font-sans antialiased selection:bg-[#EBF755] selection:text-black flex flex-col">
      {hasClerkKey && <AutoOpenSignIn />}

      {/* 1. TOP NAVBAR */}
      <header className="sticky top-0 z-40 w-full border-b border-[#121417]/10 bg-[#F9F8F5]/90 backdrop-blur-md px-4 sm:px-8 lg:px-12 h-20 flex items-center justify-between">
        {/* Logo */}
        <BrandLogo size="md" />

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#121417]/80">
          <a href="#how-it-works" className="hover:text-black transition-colors">How it works</a>
          <a href="#features" className="hover:text-black transition-colors">Features</a>
          <a href="#metrics" className="hover:text-black transition-colors">Stats</a>
          <a href="#faq" className="hover:text-black transition-colors">FAQ</a>
          <a href="#reviews" className="hover:text-black transition-colors">Reviews</a>
        </nav>

        {/* Right CTA / Mobile Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {hasClerkKey ? (
            <>
              <SignInButton mode="modal">
                <button className="px-3 sm:px-4 py-2 text-xs font-bold text-[#121417] hover:text-black transition-colors">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold bg-[#D4E4FC] hover:bg-[#C2DBFB] text-[#121417] border border-[#121417]/15 shadow-sm transition-all hover:scale-105">
                  Get Started Free
                </button>
              </SignUpButton>
            </>
          ) : (
            <button
              onClick={onEnterDemo}
              className="px-4 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs font-bold bg-[#D4E4FC] hover:bg-[#C2DBFB] text-[#121417] border border-[#121417]/15 shadow-sm transition-all hover:scale-105"
            >
              Launch App Demo
            </button>
          )}

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2 rounded-xl border border-[#121417]/15 hover:bg-black/5 text-[#121417] transition-colors"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* MOBILE DROPDOWN MENU */}
      {isMobileMenuOpen && (
        <div className="md:hidden sticky top-20 z-30 w-full bg-white border-b-2 border-[#121417] px-6 py-5 shadow-solid flex flex-col gap-4 text-sm font-bold text-[#121417] animate-fade-in">
          <a 
            href="#how-it-works" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-black py-1 border-b border-slate-100"
          >
            How it works
          </a>
          <a 
            href="#features" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-black py-1 border-b border-slate-100"
          >
            Features
          </a>
          <a 
            href="#metrics" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-black py-1 border-b border-slate-100"
          >
            Stats & Metrics
          </a>
          <a
            href="#faq" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-black py-1 border-b border-slate-100"
          >
            FAQ
          </a>
          <a
            href="#reviews" 
            onClick={() => setIsMobileMenuOpen(false)}
            className="hover:text-black py-1"
          >
            Reviews
          </a>
        </div>
      )}

      {/* 2. HERO SECTION (CREAM BACKGROUND) */}
      <section className="relative w-full pt-8 sm:pt-12 lg:pt-16 pb-10 sm:pb-14 lg:pb-20 px-4 sm:px-8 lg:px-12 max-w-5xl mx-auto flex flex-col items-center text-center">

        {/* Main Headline */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#121417] max-w-3xl leading-[1.12]">
          Unlock effortless YouTube learning with your own interactive course tracker.
        </h1>

        {/* Subtitle */}
        <p className="mt-4 sm:mt-6 text-base sm:text-lg text-[#121417]/75 max-w-xl leading-relaxed font-medium">
          Paste any playlist. Take timestamped notes, track your progress, and build a focus streak.
        </p>

        {/* Action Buttons */}
        <div className="mt-6 sm:mt-8 w-full max-w-xs sm:max-w-none mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 sm:flex-wrap">
          {hasClerkKey ? (
            <SignUpButton mode="modal">
              <button className="w-full sm:w-auto px-7 py-3.5 rounded-full text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                <span>Start Tracking Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </SignUpButton>
          ) : (
            <button
              onClick={onEnterDemo}
              className="w-full sm:w-auto px-7 py-3.5 rounded-full text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-2"
            >
              <span>Start Tracking Free</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}



          <a
            href="#how-it-works"
            className="mt-1 sm:mt-0 px-5 py-2 sm:py-3.5 rounded-full text-xs font-bold bg-transparent hover:bg-slate-100 text-[#5A606A] hover:text-[#121417] border-2 border-transparent transition-all"
          >
            See How It Works &darr;
          </a>
        </div>

        {/* CENTRAL VIDEO PLAYER HIGH-FIDELITY PREVIEW MOCKUP */}
        <div className="mt-8 sm:mt-10 lg:mt-14 w-full max-w-4xl relative">
          
          {/* Handwritten Annotation Sticker ("Watch Demo") */}
          <div className="absolute -top-7 right-4 sm:right-10 flex flex-col items-center pointer-events-none z-20">
            <span className="font-hand text-xl sm:text-2xl font-bold text-[#121417] -rotate-6">
              Interactive Workspace!
            </span>
            <svg className="w-8 h-8 -rotate-12 text-[#121417]" viewBox="0 0 50 50" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10 10 Q 25 35 40 40 M 30 40 L 40 40 L 38 30" />
            </svg>
          </div>

          {/* Interactive Workspace Mockup Box (Signature White Theme) */}
          <div 
            className="relative rounded-3xl overflow-hidden border-2 border-[#121417] bg-white shadow-solid-lg flex flex-col text-left"
          >
            <MockupWorkspaceContent />
          </div>

          {/* CONTINUOUS YELLOW SQUIGGLE SVG */}
          <div className="w-full flex justify-center -mb-8 pointer-events-none">
            <svg className="w-48 sm:w-64 h-32 text-[#EBF755]" viewBox="0 0 200 120" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
              <path d="M 100 0 C 120 40, 20 60, 40 100 C 50 120, 160 110, 170 140" />
            </svg>
          </div>
        </div>

        {/* PROBLEM / AGITATION SECTION */}
        <div className="mt-6 sm:mt-8 lg:mt-10 max-w-xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#121417] tracking-tight">
            Learning on standard YouTube <br />is tougher than you think.
          </h2>

          {/* Doodle Cloud Badges */}
          <div className="relative py-4 flex flex-wrap items-center justify-center gap-2.5">
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#121417]/15 text-xs font-bold text-[#121417] shadow-sm -rotate-2">
              🌀 Tutorial Hell
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#121417]/15 text-xs font-bold text-[#121417] shadow-sm rotate-3">
              ❌ Lost Timestamps
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#121417]/15 text-xs font-bold text-[#121417] shadow-sm -rotate-1">
              📑 Messy Notepad Tabs
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#121417]/15 text-xs font-bold text-[#121417] shadow-sm rotate-2">
              📉 Broken Streaks
            </span>
            <span className="px-3.5 py-1.5 rounded-full bg-white border border-[#121417]/15 text-xs font-bold text-[#121417] shadow-sm -rotate-3">
              ⏳ Random Feed Distractions
            </span>
          </div>

          <div className="pt-2">
            <h3 className="text-xl sm:text-2xl font-extrabold text-[#121417]">
              We fix that for you. Finish courses 3x faster.
            </h3>
            <p className="mt-2 text-sm text-[#121417]/70 font-medium">
              FLO turns chaotic YouTube playlists into an organized university curriculum with zero distraction feeds.
            </p>
          </div>

          {/* Squiggle down */}
          <div className="flex justify-center pt-2">
            <svg className="w-16 h-20 text-[#EBF755]" viewBox="0 0 60 80" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round">
              <path d="M 30 0 C 10 25, 50 45, 30 75" />
            </svg>
          </div>
        </div>
      </section>

      {/* 3. SIGNATURE LIME COLOR-BLOCKED FEATURES SECTION */}
      <section id="features" className="scroll-mt-24 bg-[#EBF755] text-[#121417] py-12 sm:py-16 lg:py-20 px-6 lg:px-12 border-y-2 border-[#121417]">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15]">
              We're the structured, world-class YouTube campus you've been dreaming about.
            </h2>
            <div className="mt-4 sm:mt-6 inline-flex">
              <span className="px-5 py-2 rounded-full bg-[#121417] text-white text-xs font-bold shadow-solid">
                Platform Features
              </span>
            </div>
          </div>

          {/* 4 Feature Line-Art Cards */}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-8 lg:gap-12">
            
            {/* Feature 1 */}
            <div className="p-3 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white border-2 border-[#121417] shadow-solid space-y-2 sm:space-y-4 hover:-translate-y-1 transition-transform">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#EBF755] border-2 border-[#121417] flex items-center justify-center font-bold text-lg">
                <Laptop className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight">
                One-Click Playlist Loader
              </h3>
              <p className="text-[11px] sm:text-sm text-[#121417]/80 leading-snug sm:leading-relaxed font-medium">
                Paste any YouTube Playlist URL or individual video links. FLO instantly parses every lecture, duration tag, and completion checkbox automatically.
              </p>
              <div className="pt-1 sm:pt-2 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#121417]">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                <span>Zero configuration required</span>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="p-3 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white border-2 border-[#121417] shadow-solid space-y-2 sm:space-y-4 hover:-translate-y-1 transition-transform">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#D4E4FC] border-2 border-[#121417] flex items-center justify-center font-bold text-lg">
                <BookmarkPlus className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight">
                Clickable Timestamp Seeking
              </h3>
              <p className="text-[11px] sm:text-sm text-[#121417]/80 leading-snug sm:leading-relaxed font-medium">
                Click "Timestamp Note" while watching to stamp the exact video second. Clicking any timestamp chip in your notes immediately seeks playback to that moment.
              </p>
              <div className="pt-1 sm:pt-2 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#121417]">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                <span>Bidirectional player synchronization</span>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="p-3 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white border-2 border-[#121417] shadow-solid space-y-2 sm:space-y-4 hover:-translate-y-1 transition-transform">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#D4E4FC] border-2 border-[#121417] flex items-center justify-center font-bold text-lg">
                <Clock className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight">
                Pomodoro Focus Engine
              </h3>
              <p className="text-[11px] sm:text-sm text-[#121417]/80 leading-snug sm:leading-relaxed font-medium">
                Built-in 25-minute study intervals, short breaks, and long breaks with pleasant Web Audio synthesizer chimes that keep you in flow state without audio errors.
              </p>
              <div className="pt-1 sm:pt-2 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#121417]">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                <span>Customizable focus intervals</span>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="p-3 sm:p-7 lg:p-8 rounded-2xl sm:rounded-3xl bg-white border-2 border-[#121417] shadow-solid space-y-2 sm:space-y-4 hover:-translate-y-1 transition-transform">
              <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-[#EBF755] border-2 border-[#121417] flex items-center justify-center font-bold text-lg">
                <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <h3 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight">
                Daily Streaks & Markdown Export
              </h3>
              <p className="text-[11px] sm:text-sm text-[#121417]/80 leading-snug sm:leading-relaxed font-medium">
                Build an unbreakable daily streak tracking completed sessions. Export all course notes as clean Markdown (.md) or plain text anytime.
              </p>
              <div className="pt-1 sm:pt-2 flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold text-[#121417]">
                <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 flex-shrink-0" />
                <span>One-click .md file download</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 4. METRICS SECTION */}
      <section id="metrics" className="scroll-mt-24 w-full pt-12 sm:pt-16 lg:pt-20 pb-8 sm:pb-10 lg:pb-12 px-6 lg:px-12 max-w-5xl mx-auto text-center">
        <div className="max-w-2xl mx-auto mb-8 sm:mb-10 lg:mb-14">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-snug">
            Built for learners who want real progress.
          </h2>
          <p className="mt-3 text-lg font-bold text-[#121417]/80">
            Study smarter, finish playlists, and retain what you watch.
          </p>
        </div>

        {/* 3 Pastel Stat Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
          <div className="p-6 rounded-3xl bg-white border-2 border-[#121417] shadow-solid space-y-3">
            <span className="text-4xl font-extrabold text-[#121417]">
              120k+
            </span>
            <h4 className="text-sm font-bold text-[#121417]">
              Study Minutes Logged
            </h4>
            <p className="text-xs text-[#121417]/70 font-medium leading-relaxed">
              Engineers and students logging distraction-free Pomodoro study sprints daily.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#EBF755] border-2 border-[#121417] shadow-solid space-y-3">
            <span className="text-4xl font-extrabold text-[#121417]">
              3x Faster
            </span>
            <h4 className="text-sm font-bold text-[#121417]">
              Course Completion Rate
            </h4>
            <p className="text-xs text-[#121417]/80 font-medium leading-relaxed">
              Users complete significantly more full playlists compared to standard YouTube tabs.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-[#D4E4FC] border-2 border-[#121417] shadow-solid space-y-3">
            <span className="text-4xl font-extrabold text-[#121417]">
              100% Free
            </span>
            <h4 className="text-sm font-bold text-[#121417]">
              Open-Source Spirit
            </h4>
            <p className="text-xs text-[#121417]/70 font-medium leading-relaxed">
              No paywalls, no monthly subscription fees, and no artificial course limits.
            </p>
          </div>
        </div>
      </section>

      {/* 6. DEEP FOREST GREEN "HOW IT WORKS" SECTION */}
      <section id="workflow" className="scroll-mt-24 bg-[#0D2319] text-white py-12 sm:py-16 lg:py-24 px-6 lg:px-12 border-t-2 border-[#121417]">
        <div className="max-w-4xl mx-auto text-center">

          {/* 4-STEP WINDING ROADMAP (WITH ANCHOR ID="how-it-works") */}
          <div id="how-it-works" className="max-w-2xl mx-auto space-y-8 sm:space-y-10 lg:space-y-12 relative text-center scroll-mt-24">
            
            <div className="mb-4">
              <span className="px-4 py-1.5 rounded-full bg-emerald-900 border border-emerald-700 text-emerald-200 text-xs font-bold uppercase tracking-wider">
                Step-by-Step Flow
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-3">
                How FLO Works in 4 Steps
              </h3>
            </div>

            {/* Step 1 */}
            <div className="flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-200 font-bold text-xs flex items-center justify-center border border-emerald-600 mb-3">
                1
              </span>
              <h4 className="text-lg font-extrabold text-white">
                Paste any YouTube Playlist Link
              </h4>
              <p className="text-xs text-emerald-200/70 max-w-sm mt-1">
                Paste any video or playlist URL. FLO parses the entire tracklist and durations in milliseconds.
              </p>
            </div>

            {/* Dashed connector path */}
            <div className="flex justify-center -my-2">
              <svg className="w-40 h-16 text-emerald-600" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M 50 0 C 80 20, 20 20, 50 40" />
              </svg>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-200 font-bold text-xs flex items-center justify-center border border-emerald-600 mb-3">
                2
              </span>
              <h4 className="text-lg font-extrabold text-white">
                Lock In with 25-Min Focus Sprints
              </h4>
              <p className="text-xs text-emerald-200/70 max-w-sm mt-1">
                Start the built-in Pomodoro timer to watch lectures distraction-free with gentle audio chimes.
              </p>
            </div>

            {/* Dashed connector path */}
            <div className="flex justify-center -my-2">
              <svg className="w-40 h-16 text-emerald-600" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M 50 0 C 20 20, 80 20, 50 40" />
              </svg>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-emerald-800 text-emerald-200 font-bold text-xs flex items-center justify-center border border-emerald-600 mb-3">
                3
              </span>
              <h4 className="text-lg font-extrabold text-white">
                Take Timestamped Notes with Instant Seek
              </h4>
              <p className="text-xs text-emerald-200/70 max-w-sm mt-1">
                Tag tricky code moments. Click any timestamp in your notes to jump playback directly to that second.
              </p>
            </div>

            {/* Dashed connector path */}
            <div className="flex justify-center -my-2">
              <svg className="w-40 h-16 text-emerald-600" viewBox="0 0 100 40" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
                <path d="M 50 0 C 80 20, 20 20, 50 40" />
              </svg>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col items-center">
              <span className="w-8 h-8 rounded-full bg-[#EBF755] text-black font-bold text-xs flex items-center justify-center mb-3 shadow-md">
                4
              </span>
              <h4 className="text-lg font-extrabold text-white">
                Export Your Notes & Keep Your Streak Alive
              </h4>
              <p className="text-xs text-emerald-200/70 max-w-sm mt-1">
                Download your notes as clean Markdown (.md) or plain text, build your focus streak, and finish your courses.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 7. FAQ SECTION (CREAM BACKGROUND WITH ACCORDIONS) */}
      <section id="faq" className="scroll-mt-24 w-full py-12 sm:py-16 lg:py-24 px-6 lg:px-12 max-w-4xl mx-auto">
        <div className="text-center mb-8 sm:mb-10 lg:mb-14">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#121417]">
            Frequently Asked Questions
          </h2>
          <p className="text-sm text-[#121417]/70 font-medium mt-2">
            Everything you need to know about FLO and YouTube course learning.
          </p>
        </div>

        {/* Accordion Container */}
        <div className="space-y-3">
          {[
            {
              q: "Can I import any YouTube playlist or video?",
              a: "Yes! Simply paste any standard YouTube playlist link (containing list=...), video link, or bare ID. FLO extracts the lectures and embeds the distraction-free player automatically."
            },
            {
              q: "How does the timestamp seeking feature work?",
              a: "When you click 'Timestamp Note' or press Alt+T, FLO queries the YouTube Player API for the exact second of video playback and inserts a [mm:ss] tag. Clicking that tag in your notes preview commands the player to jump right to that second."
            },
            {
              q: "Is my progress and notes saved when I close the tab?",
              a: "Yes. All added playlists, lecture completion checkmarks, notes, and Pomodoro streak counts are saved locally in your browser and synced with your cloud account."
            },
            {
              q: "Is FLO really 100% free?",
              a: "Yes! FLO is completely free and open-source. You can track unlimited courses, take unlimited notes, and use the Pomodoro timer without any subscription."
            },
            {
              q: "Can I access my courses on my phone and computer?",
              a: "Yes! When you log in on flo.protrack.club with your Google account, all your courses, lecture progress, and notebook folders synchronize automatically across all your devices."
            }
          ].map((item, idx) => (
            <div
              key={idx}
              className="border-2 border-[#121417] rounded-2xl bg-white shadow-solid overflow-hidden transition-all"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left font-extrabold text-sm sm:text-base text-[#121417] flex items-center justify-between gap-4"
              >
                <span>{item.q}</span>
                <span className="w-7 h-7 rounded-full bg-[#F9F8F5] border border-[#121417]/20 flex items-center justify-center flex-shrink-0">
                  {openFaq === idx ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                </span>
              </button>
              {openFaq === idx && (
                <div className="px-5 pb-5 text-xs sm:text-sm text-[#121417]/75 font-medium leading-relaxed border-t border-[#121417]/10 pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 8. REVIEW / FEEDBACK SECTION */}
      <section id="reviews" className="scroll-mt-24 bg-[#121417] text-white py-12 sm:py-16 lg:py-24 px-6 lg:px-12 border-y-2 border-[#121417]">
        <div className="max-w-4xl mx-auto">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
            <div className="inline-flex mb-4">
              <span className="px-4 py-1.5 rounded-full bg-[#EBF755]/15 border border-[#EBF755]/30 text-[#EBF755] text-xs font-bold uppercase tracking-wider">
                Share Your Thoughts
              </span>
            </div>
            <h2 className="text-2xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.15]">
              We'd love to hear from you.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/60 font-medium max-w-lg mx-auto">
              Found a bug? Have a feature idea? Or just want to share your experience? Your feedback makes FLO better for everyone.
            </p>
          </div>

          {/* Review Form Card */}
          {reviewSubmitted ? (
            <div className="max-w-lg mx-auto p-8 sm:p-10 rounded-3xl bg-[#1A1F26] border-2 border-[#EBF755]/30 shadow-[0_0_60px_-15px_rgba(235,247,85,0.2)] text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-[#EBF755] text-[#121417] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                Thank you for your feedback!
              </h3>
              <p className="text-sm text-white/60 font-medium">
                Your review has been submitted successfully. We appreciate you taking the time to help us improve FLO.
              </p>
              <button
                onClick={() => setReviewSubmitted(false)}
                className="mt-2 px-6 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/15 transition-all hover:scale-105"
              >
                Submit Another Review
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleReviewSubmit}
              className="max-w-lg mx-auto p-6 sm:p-8 rounded-3xl bg-[#1A1F26] border-2 border-white/10 shadow-[0_0_60px_-15px_rgba(0,0,0,0.5)] space-y-5"
            >
              {/* Review Type Toggle */}
              <div className="flex items-center gap-2 p-1 bg-[#121417] rounded-full border border-white/10">
                <button
                  type="button"
                  onClick={() => setReviewType('feedback')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all ${
                    reviewType === 'feedback'
                      ? 'bg-[#EBF755] text-[#121417] shadow-md'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Feedback</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewType('bug')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-bold transition-all ${
                    reviewType === 'bug'
                      ? 'bg-red-500 text-white shadow-md'
                      : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  <Bug className="w-3.5 h-3.5" />
                  <span>Bug Report</span>
                </button>
              </div>

              {/* Star Rating */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-white/70 uppercase tracking-wider">
                  {reviewType === 'bug' ? 'Severity' : 'Rating'}
                </label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewRating(star)}
                      onMouseEnter={() => setReviewHover(star)}
                      onMouseLeave={() => setReviewHover(0)}
                      className="p-0.5 transition-transform hover:scale-125 focus:outline-none"
                    >
                      <Star
                        className={`w-7 h-7 sm:w-8 sm:h-8 transition-colors ${
                          star <= (reviewHover || reviewRating)
                            ? reviewType === 'bug'
                              ? 'text-red-400 fill-red-400'
                              : 'text-[#EBF755] fill-[#EBF755]'
                            : 'text-white/20'
                        }`}
                      />
                    </button>
                  ))}
                  {reviewRating > 0 && (
                    <span className="ml-2 text-xs font-bold text-white/50">
                      {reviewType === 'bug'
                        ? ['', 'Minor', 'Low', 'Medium', 'High', 'Critical'][reviewRating]
                        : ['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing'][reviewRating]
                      }
                    </span>
                  )}
                </div>
              </div>

              {/* Name & Email Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="review-name" className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Name
                  </label>
                  <input
                    id="review-name"
                    type="text"
                    value={reviewName}
                    onChange={(e) => setReviewName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121417] border-2 border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#EBF755]/50 focus:ring-1 focus:ring-[#EBF755]/20 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="review-email" className="text-xs font-bold text-white/70 uppercase tracking-wider">
                    Email
                  </label>
                  <input
                    id="review-email"
                    type="email"
                    value={reviewEmail}
                    onChange={(e) => setReviewEmail(e.target.value)}
                    placeholder="you@email.com"
                    className="w-full px-4 py-2.5 rounded-xl bg-[#121417] border-2 border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#EBF755]/50 focus:ring-1 focus:ring-[#EBF755]/20 transition-colors"
                  />
                </div>
              </div>

              {/* Message Textarea */}
              <div className="space-y-1.5">
                <label htmlFor="review-message" className="text-xs font-bold text-white/70 uppercase tracking-wider">
                  {reviewType === 'bug' ? 'Describe the bug' : 'Your feedback'}
                </label>
                <textarea
                  id="review-message"
                  value={reviewMessage}
                  onChange={(e) => setReviewMessage(e.target.value)}
                  placeholder={reviewType === 'bug'
                    ? 'What happened? What did you expect? Steps to reproduce...'
                    : 'Tell us what you love, what could improve, or any feature ideas...'
                  }
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl bg-[#121417] border-2 border-white/10 text-white text-sm font-medium placeholder:text-white/30 focus:outline-none focus:border-[#EBF755]/50 focus:ring-1 focus:ring-[#EBF755]/20 transition-colors resize-none"
                />
              </div>

              {/* Error Message */}
              {reviewError && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-bold">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={reviewSubmitting}
                className={`w-full py-3.5 rounded-full text-xs font-black flex items-center justify-center gap-2 border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                  reviewType === 'bug'
                    ? 'bg-red-500 hover:bg-red-400 text-white border-red-400 shadow-[0_4px_20px_-5px_rgba(239,68,68,0.4)]'
                    : 'bg-[#EBF755] hover:bg-[#E2EF43] text-[#121417] border-[#121417] shadow-[0_4px_20px_-5px_rgba(235,247,85,0.4)]'
                } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
              >
                {reviewSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>{reviewType === 'bug' ? 'Submit Bug Report' : 'Submit Feedback'}</span>
                  </>
                )}
              </button>

              <p className="text-center text-[10px] text-white/30 font-medium">
                Your email is only used to follow up if needed. We never share it.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* 9. FOOTER */}
      <footer className="border-t border-[#121417]/15 bg-[#F9F8F5] py-8 sm:py-10 lg:py-12 px-6 lg:px-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 pb-6 sm:pb-8 border-b border-[#121417]/10 text-xs font-semibold text-[#121417]/70">

          {/* Left Brand Identity */}
          <div className="flex flex-col sm:flex-row items-center gap-3 text-center sm:text-left">
            <BrandLogo size="md" />
            <span className="text-slate-400 hidden sm:inline">&bull;</span>
            <span>The Modern YouTube Learning Hub &bull; Hey Learners 👋</span>
          </div>

          {/* Middle Navigation Links */}
          <div className="flex items-center gap-6 flex-wrap justify-center text-xs font-bold text-[#121417]/80">
            <a href="#how-it-works" className="hover:text-black transition-colors">How it works</a>
            <a href="#features" className="hover:text-black transition-colors">Features</a>
            <a href="#faq" className="hover:text-black transition-colors">FAQ</a>
            <button
              onClick={() => setIsPrivacyModalOpen(true)}
              className="hover:text-black transition-colors font-bold underline"
            >
              Privacy Policy
            </button>
          </div>

          {/* Right Link (Creator Support) */}
          <div className="flex items-center gap-4">
            <a
              href="https://buymeacoffee.com/madhurcodess"
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-full bg-[#FFF4D4] border border-[#121417]/15 text-[#121417] hover:bg-[#FFEAB0] transition-colors flex items-center gap-1.5 font-bold shadow-2xs"
            >
              <Coffee className="w-3.5 h-3.5 text-amber-900" />
              <span>Buy Me a Coffee</span>
            </a>
          </div>
        </div>

        <div className="max-w-6xl mx-auto pt-6 text-center text-[11px] text-[#121417]/50 font-medium">
          &copy; {new Date().getFullYear()} FLO (flo.protrack.club) &bull; Built with ☕ by Madhur &bull; All YouTube course rights belong to their respective creators.
        </div>
      </footer>

      {/* PRIVACY POLICY MODAL */}
      {isPrivacyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white border-2 border-[#121417] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-solid-lg text-left space-y-4">
            <div className="flex items-center justify-between border-b border-[#121417]/10 pb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="text-lg font-black text-[#121417]">Privacy Policy</h3>
              </div>
              <button 
                onClick={() => setIsPrivacyModalOpen(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500 hover:text-black"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="text-xs text-[#121417]/80 space-y-3 leading-relaxed max-h-[60vh] overflow-y-auto pr-2">
              <p>
                <strong>1. Data Ownership:</strong> Your course playlists, notes, code snippets, and study streaks belong exclusively to you. FLO does not monetize, sell, or inspect user data.
              </p>
              <p>
                <strong>2. Authentication:</strong> We use Clerk for secure authentication via Google sign-in or email. FLO only accesses your public profile (name, email, avatar) to authenticate your account.
              </p>
              <p>
                <strong>3. Cloud Storage:</strong> If signed in, your playlists, completed checkboxes, and notebook folders are synchronized to your dedicated Supabase database record. If using guest mode, data remains strictly on your local device.
              </p>
              <p>
                <strong>4. YouTube API Services:</strong> FLO uses YouTube API Services. Video playback is streamed directly through the official YouTube IFrame Player API, and lecture titles/durations are looked up via YouTube's public oEmbed endpoint &mdash; FLO does not store, redistribute, or re-host any video file. By using FLO, you are also agreeing to be bound by the{' '}
                <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="underline font-bold hover:text-black">YouTube Terms of Service</a>. Google's use of information collected via our use of YouTube API Services is governed by the{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="underline font-bold hover:text-black">Google Privacy Policy</a>.
              </p>
            </div>

            <div className="pt-2 text-right">
              <button
                onClick={() => setIsPrivacyModalOpen(false)}
                className="px-5 py-2 rounded-full bg-[#EBF755] border-2 border-[#121417] text-xs font-black shadow-xs hover:bg-[#E2EF43]"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

// HIGH-FIDELITY MOCKUP CONTENT COMPONENT (SIGNATURE WHITE THEME)
const MockupWorkspaceContent: React.FC = () => {
  return (
    <div className="w-full flex flex-col bg-white text-[#121417] select-none">
      {/* Mini App Header */}
      <div className="h-10 sm:h-12 border-b-2 border-[#121417] bg-[#FDFCF7] px-4 sm:px-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <img src="/FLO-LOGO-512x512.png" alt="FLO" className="w-6 h-6 object-contain" />
          <span className="text-xs font-black text-[#121417] tracking-wide">FLO</span>
        </div>

        {/* Center Mock Nav */}
        <div className="hidden sm:flex items-center gap-1 bg-[#F4F2EB] px-2 py-1 rounded-full border border-[#121417]/20 text-[11px] font-bold">
          <span className="px-2.5 py-0.5 rounded-full text-[#121417]/60">Playlists</span>
          <span className="px-3 py-0.5 rounded-full bg-[#EBF755] text-[#121417] shadow-2xs font-black border border-[#121417]">Workspace</span>
          <span className="px-2.5 py-0.5 rounded-full text-[#121417]/60">Notes</span>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-[#EBF755] text-black text-[11px] font-black border-2 border-[#121417] shadow-2xs">
            <Timer className="w-3 h-3 text-black" />
            <span>25:00</span>
          </div>
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-white text-[#121417] text-[11px] font-bold border-2 border-[#121417] shadow-2xs">
            <Flame className="w-3 h-3 text-amber-500 fill-current" />
            <span>3d Streak</span>
          </div>
        </div>
      </div>

      {/* Main Split Screen Body */}
      <div className="grid grid-cols-1 md:grid-cols-12 min-h-[320px] sm:min-h-[380px] bg-[#F9F8F5]">
        {/* Left: Video Player + Control Card (~62% width), mirrors the real Workspace page */}
        <div className="md:col-span-7 lg:col-span-8 p-3 sm:p-4 flex flex-col gap-3 relative border-b md:border-b-0 md:border-r-2 border-[#121417]">

          {/* Black 16:9 Video Box (matches real player container) */}
          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black border-2 border-[#121417] shadow-solid group">
            <span className="absolute top-2 left-2 px-2.5 py-0.5 rounded-full bg-[#EBF755] text-black text-[9px] font-black border border-[#121417]">
              HD 1080p
            </span>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#EBF755] text-[#121417] flex items-center justify-center border-2 border-[#121417] shadow-solid group-hover:scale-110 group-hover:bg-[#E2EF43] transition-all">
                <Play className="w-5 h-5 sm:w-6 sm:h-6 fill-current ml-0.5" />
              </div>
            </div>
            <div className="absolute bottom-2 left-2 right-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
              <div className="bg-[#EBF755] h-full w-[42%]" />
            </div>
          </div>

          {/* White Info Card (matches real control bar + lecture info card) */}
          <div className="p-2.5 sm:p-3 rounded-xl bg-white border-2 border-[#121417] shadow-2xs flex-1 flex flex-col">
            {/* Control Bar Row */}
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#121417]/10">
              <div className="flex items-center gap-1.5">
                <span className="p-1 rounded-full border border-[#121417]/30 text-[#121417]/70">
                  <SkipBack className="w-2.5 h-2.5" />
                </span>
                <span className="w-5 h-5 rounded-full bg-[#121417] text-white flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-current ml-0.3" />
                </span>
                <span className="p-1 rounded-full border border-[#121417]/30 text-[#121417]/70">
                  <SkipForward className="w-2.5 h-2.5" />
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border border-[#121417]/30 text-[9px] font-mono font-bold text-[#121417]/70">
                  <Gauge className="w-2.5 h-2.5" />1x
                </span>
                <Maximize2 className="w-3 h-3 text-[#121417]/50" />
              </div>
            </div>

            {/* Lecture Info */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-[#D4E4FC] text-[#121417] border border-[#121417]/15">
                Lecture 01 of 57
              </span>
              <span className="flex items-center gap-1 text-[9px] text-[#121417]/60 font-mono font-bold">
                <Clock className="w-2.5 h-2.5" />
                <span>04:25 / 45:10</span>
              </span>
            </div>
            <h4 className="text-[11px] sm:text-xs font-extrabold text-[#121417] leading-snug">
              Core Java &amp; Data Structures
            </h4>

            {/* Quick Actions */}
            <div className="mt-2 flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-white border-2 border-[#121417] text-[9px] font-black text-[#121417]">
                <BookmarkPlus className="w-2.5 h-2.5" />
                <span>Timestamp</span>
              </span>
              <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#EBF755] border-2 border-[#121417] text-[9px] font-black text-black">
                <CheckCircle2 className="w-2.5 h-2.5" />
                <span>Mark as Done</span>
              </span>
            </div>
          </div>


        </div>

        {/* Right: Playlist/Notes Panel (~38% width), mirrors the real WorkspaceRightPanel */}
        <div className="md:col-span-5 lg:col-span-4 bg-white p-3 sm:p-4 flex flex-col justify-between text-left space-y-3">
          <div>
            {/* Segmented Tab Switcher (Playlist | Notes) */}
            <div className="flex items-center gap-1 p-1 bg-[#F9F8F5] rounded-full border border-[#121417]/15 mb-3">
              <span className="flex-1 flex items-center justify-center gap-1 py-1 rounded-full text-[10px] font-black text-[#121417]/50">
                <ListVideo className="w-2.5 h-2.5" />
                <span>Playlist</span>
              </span>
              <span className="flex-1 flex items-center justify-center gap-1 py-1 rounded-full bg-[#121417] text-[#EBF755] text-[10px] font-black">
                <FileText className="w-2.5 h-2.5" />
                <span>Notes</span>
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b-2 border-[#121417]/10">
              <span className="text-xs font-black text-[#121417] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#121417]" />
                <span>Timestamped Notes</span>
              </span>
              <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                Auto-saved
              </span>
            </div>

            {/* Note Snippets with Timestamp Chips */}
            <div className="mt-3 space-y-2.5">
              <div className="p-2.5 rounded-xl bg-[#FDFCF7] border-2 border-[#121417] shadow-2xs text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#EBF755] text-[#121417] text-[10px] font-black border border-[#121417] cursor-pointer hover:scale-105 transition-transform mb-1 shadow-2xs">
                  ▶ [04:25]
                </span>
                <p className="text-[11px] text-[#121417]/90 font-medium">
                  Heap vs Stack memory allocation during object instantiation.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[#FDFCF7] border-2 border-[#121417] shadow-2xs text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#D4E4FC] text-[#121417] text-[10px] font-black border border-[#121417] cursor-pointer hover:scale-105 transition-transform mb-1 shadow-2xs">
                  ▶ [18:40]
                </span>
                <p className="text-[11px] text-[#121417]/90 font-medium">
                  Why ArrayList has O(1) random access amortized.
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-[#121417] border-2 border-[#121417] text-[10px] font-mono text-emerald-400 shadow-2xs">
                <code>{`// Core Syntax
public class Node<T> {
  T value; Node next;
}`}</code>
              </div>
            </div>
          </div>

          {/* Curriculum checklist preview */}
          <div className="pt-2 border-t-2 border-[#121417]/10 flex items-center justify-between text-[11px] font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>3 of 24 completed</span>
            </span>
            <span className="text-[#121417] hover:underline font-black cursor-pointer">Export .md</span>
          </div>
        </div>
      </div>
    </div>
  );
};
