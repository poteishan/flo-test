import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Flame,
  Coffee,
  LayoutGrid,
  Tv,
  FileText,
  Timer,
  Menu,
  X
} from 'lucide-react';
import { AuthBar } from './AuthBar';
import { BrandLogo } from './BrandLogo';
import { formatTime } from '../utils/youtube';

export const Header: React.FC = () => {
  const {
    activeCourse,
    pomodoroStats,
    pomodoroTimeLeft,
    isFloatingTimerOpen,
    setIsFloatingTimerOpen,
    hasClerkKey,
    currentView,
    setCurrentView,
  } = useApp();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const goToView = (view: 'playlists' | 'workspace' | 'notes') => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b border-[#121417]/10 bg-[#F9F8F5]/95 backdrop-blur-md relative">
      <div className="h-16 px-3 sm:px-5 lg:px-6 flex items-center justify-between gap-3">
        {/* Left: Brand Logo */}
        <div className="flex items-center min-w-fit">
          <button
            onClick={() => setCurrentView('playlists')}
            className="flex items-center text-left transition-transform hover:scale-102"
            title="Back to All Playlists"
          >
            <BrandLogo size="md" />
          </button>
        </div>

        {/* Center: View Switcher Hub (Playlists | Workspace | Notes) - Desktop Only */}
        <nav className="hidden lg:flex items-center gap-1 bg-white p-1 rounded-2xl border border-[#121417]/15 shadow-2xs">
        <button
          onClick={() => setCurrentView('playlists')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
            currentView === 'playlists'
              ? 'bg-[#121417] text-[#EBF755] shadow-xs'
              : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
          }`}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Playlists</span>
        </button>

        <button
          onClick={() => setCurrentView('workspace')}
          disabled={!activeCourse}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
            currentView === 'workspace'
              ? 'bg-[#121417] text-[#EBF755] shadow-xs'
              : activeCourse
              ? 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
              : 'opacity-40 cursor-not-allowed text-[#121417]/40'
          }`}
          title={!activeCourse ? 'Select a playlist to start learning' : 'Open Learning Workspace'}
        >
          <Tv className="w-3.5 h-3.5" />
          <span>Workspace</span>
        </button>

        <button
          onClick={() => setCurrentView('notes')}
          className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
            currentView === 'notes'
              ? 'bg-[#121417] text-[#EBF755] shadow-xs'
              : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>
        </nav>

        {/* Right: Timer, Streak, and (Tablet+) Developer/Auth */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Focus Timer Button (To the left of Streak) */}
          <button
            id="tour-timer-btn"
            onClick={() => setIsFloatingTimerOpen(!isFloatingTimerOpen)}
            className="flex items-center gap-1 sm:gap-1.5 text-xs font-black px-2 sm:px-3.5 py-1.5 rounded-full bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95"
            title="Focus Timer"
          >
            <Timer className="w-3.5 h-3.5 text-black flex-shrink-0" />
            <span className="hidden sm:inline font-black text-xs">Focus Timer</span>
            <span className="font-mono text-[11px] font-extrabold bg-black/10 px-1.5 py-0.2 rounded-md whitespace-nowrap">{formatTime(pomodoroTimeLeft)}</span>
          </button>

          {/* Focus Streak Badge */}
          <div
            className={`flex items-center gap-1 sm:gap-1.5 text-xs font-black px-2 sm:px-3.5 py-1.5 rounded-full border-2 border-[#121417] shadow-solid-xs transition-colors ${
              pomodoroStats.todayFocusMinutes >= 10
                ? 'bg-[#EBF755] text-[#121417]'
                : 'bg-white text-[#121417]'
            }`}
            title={
              pomodoroStats.todayFocusMinutes >= 10
                ? `🔥 Streak Active! ${pomodoroStats.streakDays}d streak (${pomodoroStats.todayFocusMinutes} mins logged today)`
                : `⚡ Today: ${pomodoroStats.todayFocusMinutes}/10 mins. Study at least 10 mins (watching videos or focus sessions) to unlock today's streak!`
            }
          >
            <Flame className={`w-4 h-4 fill-current flex-shrink-0 ${pomodoroStats.todayFocusMinutes >= 10 ? 'text-orange-500 animate-pulse' : 'text-slate-400'}`} />
            <span className="whitespace-nowrap">{pomodoroStats.streakDays}d Streak</span>
            {pomodoroStats.todayFocusMinutes < 10 && (
              <span className="hidden sm:inline text-[10px] font-bold text-[#121417]/60 whitespace-nowrap">({pomodoroStats.todayFocusMinutes}/10m)</span>
            )}
          </div>

          {/* Buy a Coffee For Developer Button - Desktop Only (moved into hamburger menu below lg) */}
          <a
            href={import.meta.env.VITE_BUY_ME_COFFEE_URL || "https://buymeacoffee.com/madhurcodess"}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:flex items-center gap-1.5 text-xs font-black px-3.5 py-1.5 rounded-full bg-[#FFF4D4] hover:bg-[#EBF755] border-2 border-[#121417] text-[#121417] transition-all shadow-solid-xs hover:scale-105 active:scale-95"
            title="Support the developer on Buy Me a Coffee!"
          >
            <Coffee className="w-3.5 h-3.5 text-black" />
            <span>Fuel The Dev</span>
          </a>

          {/* Clerk Authentication / Profile - Desktop Only (moved into hamburger menu below lg) */}
          <div id="tour-auth-btn" className="hidden lg:flex items-center">
            <AuthBar hasClerkKey={hasClerkKey} />
          </div>

          {/* Hamburger Menu Toggle - Mobile/Tablet Only */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl border border-[#121417]/15 hover:bg-black/5 text-[#121417] transition-colors flex-shrink-0"
            aria-label="Toggle navigation menu"
          >
            {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Hamburger Dropdown Menu: Workspace / Playlists / Notes / Profile / Developer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 z-40 bg-white border-b-2 border-[#121417] shadow-solid-lg px-4 py-4 flex flex-col gap-1.5 animate-fade-in">
          <button
            onClick={() => goToView('workspace')}
            disabled={!activeCourse}
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-black transition-all ${
              currentView === 'workspace'
                ? 'bg-[#121417] text-[#EBF755]'
                : activeCourse
                ? 'text-[#121417] hover:bg-black/5'
                : 'opacity-40 cursor-not-allowed text-[#121417]/40'
            }`}
          >
            <Tv className="w-4 h-4" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => goToView('playlists')}
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-black transition-all ${
              currentView === 'playlists'
                ? 'bg-[#121417] text-[#EBF755]'
                : 'text-[#121417] hover:bg-black/5'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>Playlists</span>
          </button>

          <button
            onClick={() => goToView('notes')}
            className={`flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-black transition-all ${
              currentView === 'notes'
                ? 'bg-[#121417] text-[#EBF755]'
                : 'text-[#121417] hover:bg-black/5'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Notes</span>
          </button>

          <div className="my-1.5 border-t border-[#121417]/10" />

          {/* Buy Me a Coffee Row */}
          <a
            href={import.meta.env.VITE_BUY_ME_COFFEE_URL || "https://buymeacoffee.com/madhurcodess"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-2.5 py-2.5 px-3 rounded-xl text-sm font-black text-[#121417] hover:bg-black/5 transition-colors"
          >
            <Coffee className="w-4 h-4 text-amber-700" />
            <span>Fuel The Dev</span>
          </a>

          {/* Profile Row */}
          <div className="flex items-center py-1.5 px-3 rounded-xl">
            <AuthBar hasClerkKey={hasClerkKey} />
          </div>
        </div>
      )}
    </header>
  );
};
