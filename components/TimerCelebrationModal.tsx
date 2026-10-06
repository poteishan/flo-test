import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useApp } from '../context/AppContext';
import { 
  Flame, 
  Coffee, 
  Play, 
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';

const WORK_QUOTES = [
  "Synapses firing on all cylinders! You just made 10x developer progress without breaking a sweat. 🧠⚡",
  "Brain overclocked, dopamine flowing, syntax errors trembling. You are legitimately unstoppable! 🚀",
  "Legend has it your focus just prevented 100 lines of messy spaghetti code from ever existing. 🍝✨",
  "Caffeine digested, logic executed, sprint conquered. Stand up, stretch, and claim your victory! 🏆"
];

const BREAK_QUOTES = [
  "Caffeine absorbed, eyes rested, fingers loose. Time to show that codebase who is boss! 🚀",
  "Break mission accomplished! Ready to write clean, bug-free, perfectly indented code? 💻✨",
  "Battery fully recharged! Let's lock in and crush the next lecture module. 🔋🔥"
];

export const TimerCelebrationModal: React.FC = () => {
  const { 
    timerCelebration, 
    setTimerCelebration, 
    startNextSprint, 
    startBreakAfterWork, 
    extendBreak 
  } = useApp();

  const [portalTarget, setPortalTarget] = useState<HTMLElement>(document.body);
  const [quoteIndex, setQuoteIndex] = useState<number>(0);

  // Pick a fresh quote when celebration triggers
  useEffect(() => {
    if (timerCelebration) {
      if (timerCelebration.type === 'work') {
        setQuoteIndex(Math.floor(Math.random() * WORK_QUOTES.length));
        // Fire confetti
        confetti({
          particleCount: 70,
          spread: 80,
          origin: { y: 0.5 },
          zIndex: 9999999
        });
      } else {
        setQuoteIndex(Math.floor(Math.random() * BREAK_QUOTES.length));
      }
    }
  }, [timerCelebration]);

  // Fullscreen detection: ensure modal is mounted inside the active fullscreen element
  useEffect(() => {
    const handleFullscreenUpdate = () => {
      const fsElement = document.fullscreenElement as HTMLElement | null;
      if (fsElement) {
        // If it's an iframe, exit fullscreen so user sees the celebration dialog cleanly
        if (fsElement.tagName === 'IFRAME') {
          try {
            document.exitFullscreen().catch(() => {});
          } catch {}
          setPortalTarget(document.body);
        } else {
          setPortalTarget(fsElement);
        }
      } else {
        setPortalTarget(document.body);
      }
    };

    handleFullscreenUpdate();
    document.addEventListener('fullscreenchange', handleFullscreenUpdate);
    document.addEventListener('webkitfullscreenchange', handleFullscreenUpdate);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenUpdate);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenUpdate);
    };
  }, [timerCelebration]);

  if (!timerCelebration) return null;

  const isWork = timerCelebration.type === 'work';
  const quote = isWork ? WORK_QUOTES[quoteIndex] : BREAK_QUOTES[quoteIndex];

  const modalContent = (
    <div 
      className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      style={{ pointerEvents: 'auto' }}
    >
      <div 
        className="relative w-full max-w-md bg-white border-3 border-[#121417] rounded-3xl p-6 sm:p-7 shadow-solid-lg text-[#121417] transform transition-all scale-100 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={() => setTimerCelebration(null)}
          className="absolute top-4 right-4 p-2 rounded-full text-[#121417]/50 hover:text-[#121417] hover:bg-black/5 transition-colors"
          title="Dismiss"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon */}
        <div className="flex flex-col items-center text-center">
          <div className={`w-16 h-16 rounded-2xl border-2 border-[#121417] flex items-center justify-center shadow-solid mb-4 ${
            isWork ? 'bg-[#EBF755] text-black' : 'bg-[#D4E4FC] text-[#121417]'
          }`}>
            {isWork ? (
              <Flame className="w-8 h-8 fill-current text-orange-500 animate-bounce-subtle" />
            ) : (
              <Coffee className="w-8 h-8 text-amber-900 animate-bounce-subtle" />
            )}
          </div>

          {/* Badge */}
          <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-2 border ${
            isWork 
              ? 'bg-[#EBF755]/40 text-black border-[#121417]/20' 
              : 'bg-blue-100 text-blue-900 border-blue-200'
          }`}>
            {isWork ? 'Focus Goal Achieved!' : 'Break Finished!'}
          </span>

          {/* Main Title */}
          <h2 className="text-xl sm:text-2xl font-black text-[#121417] tracking-tight">
            {isWork 
              ? `You Crushed ${timerCelebration.durationMinutes} Minutes! 🎯` 
              : `Battery Fully Recharged! 🔋`}
          </h2>

          {/* Motivational / Friendly Quote */}
          <p className="text-xs sm:text-sm text-[#121417]/80 font-medium mt-3 px-2 leading-relaxed bg-[#F9F8F5] p-3 rounded-2xl border border-[#121417]/10 w-full">
            "{quote}"
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-6">
            {isWork ? (
              <>
                {/* Take a Break */}
                <button
                  onClick={startBreakAfterWork}
                  className="w-full py-3 px-4 rounded-full bg-[#D4E4FC] hover:bg-[#C2DBFB] text-[#121417] font-black text-xs sm:text-sm border-2 border-[#121417] shadow-solid transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-2"
                >
                  <Coffee className="w-4 h-4" />
                  <span>Take a Break ☕</span>
                </button>

                {/* Continue Focus */}
                <button
                  onClick={startNextSprint}
                  className="w-full py-3 px-4 rounded-full bg-[#121417] hover:bg-black text-[#EBF755] font-black text-xs sm:text-sm border-2 border-[#121417] shadow-solid transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-2"
                >
                  <Flame className="w-4 h-4 fill-current text-orange-500" />
                  <span>Keep Crushing 🔥</span>
                </button>
              </>
            ) : (
              <>
                {/* Start Next Focus Session */}
                <button
                  onClick={startNextSprint}
                  className="w-full py-3 px-4 rounded-full bg-[#EBF755] hover:bg-[#E2EF43] text-black font-black text-xs sm:text-sm border-2 border-[#121417] shadow-solid transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>Start Focus Session 🚀</span>
                </button>

                {/* Extend Break 5 Mins */}
                <button
                  onClick={() => extendBreak(5)}
                  className="w-full py-3 px-4 rounded-full bg-white hover:bg-slate-100 text-[#121417] font-bold text-xs sm:text-sm border-2 border-[#121417] shadow-solid transition-all hover:scale-102 active:scale-98 flex items-center justify-center gap-2"
                >
                  <Coffee className="w-4 h-4 text-amber-800" />
                  <span>Just 5 More Mins ☕</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, portalTarget);
};
