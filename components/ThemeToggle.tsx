import React, { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'flo-theme';

/** Light/dark switch. Adds or removes the "dark" class on <html>; dark-mode.css does the rest. */
export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  // The inline script in index.html has already applied the saved theme, so read it from <html>.
  const [dark, setDark] = useState<boolean>(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    try {
      localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    } catch {
      /* storage unavailable, theme still works for this session */
    }
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`flex items-center justify-center w-9 h-9 rounded-full bg-white text-[#121417] border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95 flex-shrink-0 ${className}`}
    >
      {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};