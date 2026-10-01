import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  RefreshCw, 
  Terminal, 
  Coffee, 
  Code2, 
  Cpu, 
  Rocket, 
  ShieldCheck
} from 'lucide-react';

interface PartnerItem {
  id: string;
  tag: string;
  badgeColor: string;
  badgeBg: string;
  icon: React.ElementType;
  title: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  sponsorName: string;
}

const PARTNER_ITEMS: PartnerItem[] = [
  {
    id: 'nextjs',
    tag: 'DEVELOPER ECOSYSTEM',
    badgeColor: 'text-black',
    badgeBg: 'bg-[#EBF755]',
    icon: Rocket,
    title: 'Supercharge Your Next Course with Fullstack Next.js & React 19',
    description: 'Build fast, interactive web applications with modern server actions, edge rendering, and zero-config caching.',
    ctaText: 'Explore Stack',
    ctaLink: 'https://nextjs.org',
    sponsorName: 'FLO Community Partner'
  },
  {
    id: 'supabase',
    tag: 'FEATURED TOOL',
    badgeColor: 'text-emerald-950',
    badgeBg: 'bg-emerald-200',
    icon: Terminal,
    title: 'PostgreSQL Database & Realtime Auth for Fullstack Learners',
    description: 'Never worry about database configuration again. Instantly spin up Postgres with instant APIs, Auth, and Storage.',
    ctaText: 'Try Free Tier',
    ctaLink: 'https://supabase.com',
    sponsorName: 'Open Source Cloud Partner'
  },
  {
    id: 'buymeacoffee',
    tag: 'SUPPORT THE CREATOR',
    badgeColor: 'text-amber-950',
    badgeBg: 'bg-[#FFF4D4]',
    icon: Coffee,
    title: 'Enjoying FLO? Fuel the Developer Behind This Platform',
    description: 'FLO is 100% free and open. A small coffee contribution keeps server costs covered and new features rolling out!',
    ctaText: 'Buy A Coffee ☕',
    ctaLink: 'https://buymeacoffee.com/madhurcodess',
    sponsorName: 'Developer Care Fund'
  },
  {
    id: 'clever-dev',
    tag: 'DEV LIFE PRO TIP',
    badgeColor: 'text-purple-950',
    badgeBg: 'bg-purple-200',
    icon: Code2,
    title: '“6 hours of debugging can save you 5 minutes of reading docs.”',
    description: 'Keep your focus streak alive! Review lecture notes, test your code line-by-line, and unclench your jaw while coding.',
    ctaText: 'Review Notes',
    ctaLink: '#',
    sponsorName: 'Senior Engineering Proverb'
  },
  {
    id: 'copilot',
    tag: 'AI WORKFLOW',
    badgeColor: 'text-sky-950',
    badgeBg: 'bg-sky-200',
    icon: Cpu,
    title: 'Pair Programming & Automated Unit Tests for Modern Learners',
    description: 'Accelerate your learning curve with smart autocomplete, doc generation, and instant algorithm explanations.',
    ctaText: 'Learn More',
    ctaLink: 'https://github.com/features/copilot',
    sponsorName: 'Developer Productivity'
  }
];

export const WorkspaceAdBanner: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const activeItem = PARTNER_ITEMS[currentIndex];
  const IconComp = activeItem.icon;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % PARTNER_ITEMS.length);
  };

  return (
    <div className={`w-full rounded-2xl 2xl:rounded-3xl border-2 border-[#121417] bg-white shadow-solid overflow-hidden p-4 sm:p-6 transition-all ${className}`}>
      {/* Top Meta Bar */}
      <div className="flex items-center justify-between gap-3 mb-3 pb-3 border-b border-[#121417]/10 flex-wrap">
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-[#121417]/20 ${activeItem.badgeBg} ${activeItem.badgeColor}`}>
            <IconComp className="w-3.5 h-3.5" />
            <span>{activeItem.tag}</span>
          </span>
          <span className="flex items-center gap-1 text-[11px] font-bold text-[#121417]/60">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{activeItem.sponsorName}</span>
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold text-[#121417]/40">ADVERTISEMENT</span>
          <button
            onClick={handleNext}
            className="flex items-center gap-1 text-xs font-black text-[#121417] hover:bg-[#121417]/5 px-2 py-1 rounded-lg border border-[#121417]/15 transition-all active:scale-95"
            title="Next Sponsor / Tip"
          >
            <RefreshCw className="w-3 h-3 hover:rotate-180 transition-transform duration-300" />
            <span className="hidden sm:inline text-[11px]">Shuffle</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-black text-[#121417] leading-snug tracking-tight mb-1">
            {activeItem.title}
          </h3>
          <p className="text-xs sm:text-[13px] font-medium text-[#121417]/75 leading-relaxed max-w-3xl">
            {activeItem.description}
          </p>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0 w-full sm:w-auto">
          {activeItem.ctaLink.startsWith('http') ? (
            <a
              href={activeItem.ctaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#EBF755] hover:bg-[#E2EF43] border-2 border-[#121417] shadow-solid-xs text-xs font-black text-black transition-all hover:scale-102 active:scale-95"
            >
              <span>{activeItem.ctaText}</span>
              <ExternalLink className="w-3.5 h-3.5 ml-0.5" />
            </a>
          ) : (
            <button
              onClick={handleNext}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#121417] hover:bg-black text-[#EBF755] border-2 border-[#121417] shadow-solid-xs text-xs font-black transition-all hover:scale-102 active:scale-95"
            >
              <span>{activeItem.ctaText}</span>
              <Sparkles className="w-3.5 h-3.5 ml-0.5 fill-current" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
