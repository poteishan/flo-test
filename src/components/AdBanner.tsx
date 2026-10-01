import React, { useState } from 'react';
import { Sparkles, Terminal, Coffee, RefreshCw, Smile, Lightbulb } from 'lucide-react';

interface AdBannerProps {
  slotId: string;
  format?: 'horizontal' | 'rectangle' | 'sidebar';
  className?: string;
}

const DEV_JOKES = [
  {
    tag: "Dev Humor",
    icon: Smile,
    text: "There are 10 types of people in the world: those who understand binary, and those who don't.",
    author: "Ancient Binary Proverb"
  },
  {
    tag: "Pro Tip",
    icon: Lightbulb,
    text: "6 hours of debugging can easily save you 5 minutes of reading the documentation.",
    author: "Senior Stack Overflow Surfer"
  },
  {
    tag: "Database Wit",
    icon: Terminal,
    text: "A SQL query walks into a bar, approaches two tables and asks: 'Hey, mind if I join you?'",
    author: "Relational Comedy"
  },
  {
    tag: "Caffeine Logic",
    icon: Coffee,
    text: "A developer is an organism that turns specialty coffee into functional code and occasional git merge conflicts.",
    author: "Coffee Driven Development"
  },
  {
    tag: "Bug Lifecycle",
    icon: Sparkles,
    text: "99 little bugs in the code, 99 little bugs. Take one down, patch it around... 127 little bugs in the code.",
    author: "Git Blame Champion"
  },
  {
    tag: "Language Wars",
    icon: Terminal,
    text: "Why do Java developers wear glasses? Because they can't C#.",
    author: "Bytecode Philosopher"
  },
  {
    tag: "Study Boost",
    icon: Lightbulb,
    text: "Remember to drink water, unclench your jaw, and take a deep breath. Your code will compile soon!",
    author: "Health & Focus Reminder"
  }
];

export const AdBanner: React.FC<AdBannerProps> = ({ 
  slotId, 
  format = 'horizontal', 
  className = '' 
}) => {
  // Deterministic starting index based on slotId, with user ability to shuffle
  const initialIndex = Math.abs(
    slotId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  ) % DEV_JOKES.length;

  const [jokeIndex, setJokeIndex] = useState<number>(initialIndex);
  const currentItem = DEV_JOKES[jokeIndex];
  const IconComponent = currentItem.icon;

  const handleNextJoke = () => {
    setJokeIndex((prev) => (prev + 1) % DEV_JOKES.length);
  };

  return (
    <div className={`w-full flex flex-col items-center my-2 select-none ${className}`}>
      <div className={`w-full relative rounded-2xl border-2 border-[#121417]/15 bg-gradient-to-r from-[#F9F8F5] via-white to-[#F9F8F5] p-3 sm:p-4 flex flex-col justify-between overflow-hidden shadow-xs hover:border-[#121417]/30 transition-all ${
        format === 'sidebar' ? 'min-h-[110px]' : 'min-h-[75px]'
      }`}>
        {/* Top Mini Header: Category Badge + Shuffle Button */}
        <div className="flex items-center justify-between gap-2 mb-1.5 w-full">
          <span className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-md bg-[#EBF755] text-black border border-[#121417]/20 shadow-xs">
            <IconComponent className="w-3 h-3" />
            <span>{currentItem.tag}</span>
          </span>

          <button
            onClick={handleNextJoke}
            className="flex items-center gap-1 text-[10px] font-bold text-[#121417]/50 hover:text-[#121417] p-1 rounded-md hover:bg-black/5 transition-colors"
            title="Next Dev Quip"
          >
            <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
            <span className="hidden sm:inline">Next</span>
          </button>
        </div>

        {/* Content Joke / Quote */}
        <div className="flex-1 flex flex-col justify-center my-0.5">
          <p className="text-xs sm:text-[13px] font-semibold text-[#121417] leading-snug">
            "{currentItem.text}"
          </p>
          <span className="text-[10px] font-bold text-[#121417]/50 mt-1">
            — {currentItem.author}
          </span>
        </div>
      </div>
    </div>
  );
};
