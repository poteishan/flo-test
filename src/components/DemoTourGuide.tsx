import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { 
  Tv, 
  FileText, 
  ListVideo, 
  FolderPlus, 
  Cloud, 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Sparkles, 
  Copy, 
  Check, 
  Plus, 
  Play,
  Timer
} from 'lucide-react';
import { useClerk } from '@clerk/clerk-react';

const RECOMMENDED_PLAYLIST_URL = 'https://youtube.com/playlist?list=PLGjplNEQ1it8-0CmoljS5yeV-GlKSUEt0&si=EYUdMtZt0nWziZJ8';
const RECOMMENDED_PLAYLIST_NAME = 'Complete Python Masterclass';

interface TourStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  targetId?: string;
  fallbackTargetId?: string;
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'center';
  isPlaylistStep?: boolean;
  targetTab?: 'notes' | 'playlist';
  requiresWorkspace?: boolean;
  requiresPlaylistsView?: boolean;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome_link',
    stepNumber: 1,
    title: 'Step 1: Copy Sample Playlist Link',
    description: 'Copy this recommended Python playlist URL to test your first interactive course tracker:',
    icon: <Sparkles className="w-4 h-4 text-[#121417]" />,
    placement: 'center',
    isPlaylistStep: true,
  },
  {
    id: 'click_add_playlist',
    stepNumber: 2,
    title: 'Step 2: Click "+ Add New Playlist"',
    description: 'Click the "+ Add New Playlist" button to open the YouTube playlist importer.',
    icon: <FolderPlus className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-add-playlist-btn',
    fallbackTargetId: 'tour-add-playlist-btn-empty',
    placement: 'bottom',
    requiresPlaylistsView: true,
  },
  {
    id: 'paste_url',
    stepNumber: 3,
    title: 'Step 3: Paste Playlist Link',
    description: 'Paste your playlist link into the URL field (or click "⚡ Paste Recommended Playlist").',
    icon: <Copy className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-course-url-input',
    placement: 'bottom',
  },
  {
    id: 'import_course',
    stepNumber: 4,
    title: 'Step 4: Click "Import Course"',
    description: 'Click the yellow "Import Course" button to fetch lectures and add the course to your library.',
    icon: <Plus className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-import-submit-btn',
    placement: 'top',
  },
  {
    id: 'start_learning',
    stepNumber: 5,
    title: 'Step 5: Click "Start Learning"',
    description: 'Your course is saved! Click "Start Learning" on the playlist card to open the workspace.',
    icon: <Play className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-start-learning-btn',
    placement: 'top',
    requiresPlaylistsView: true,
  },
  {
    id: 'player',
    stepNumber: 6,
    title: 'Step 6: Distraction-Free Player',
    description: 'Watch lectures with zero ads, algorithm sidebars, or comments. Spacebar to play/pause.',
    icon: <Tv className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-video-title',
    fallbackTargetId: 'tour-video-player',
    placement: 'top',
    requiresWorkspace: true,
  },
  {
    id: 'notes',
    stepNumber: 7,
    title: 'Step 7: Smart Timestamped Notes',
    description: 'Click the yellow [Time] button (or Alt + T) to insert notes linked to exact video seconds!',
    icon: <FileText className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-note-timestamp-btn',
    placement: 'left',
    targetTab: 'notes',
    requiresWorkspace: true,
  },
  {
    id: 'queue',
    stepNumber: 8,
    title: 'Step 8: Lecture Queue & Progress',
    description: 'Click the "Playlist" tab to see all lectures and check off completed videos.',
    icon: <ListVideo className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-queue-tab',
    placement: 'left',
    requiresWorkspace: true,
  },
  {
    id: 'timer',
    stepNumber: 9,
    title: 'Step 9: Focus Timer',
    description: 'Click "Focus Timer" in the top bar to start a 25-min study sprint with sound alerts and streak tracking.',
    icon: <Timer className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-timer-btn',
    placement: 'bottom',
  },
  {
    id: 'cloud_sync',
    stepNumber: 10,
    title: 'Step 10: Sign In to Save & Sync',
    description: 'Click "Sign In" at the top right to permanently back up your playlists and notes across all your devices for free!',
    icon: <Cloud className="w-4 h-4 text-[#121417]" />,
    targetId: 'tour-auth-btn',
    placement: 'bottom',
  },
];

interface DemoTourGuideProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTour: () => void;
  onReturnToLanding?: () => void;
}

export const DemoTourGuide: React.FC<DemoTourGuideProps> = ({
  isOpen,
  onClose,
  onOpenTour,
  onReturnToLanding,
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [cardPosition, setCardPosition] = useState<{ top: number; left: number; placement: string }>({
    top: 100,
    left: 20,
    placement: 'center',
  });

  const { 
    courses,
    activeCourse,
    setWorkspaceRightTab, 
    setIsRightPanelOpen, 
    isAddModalOpen,
    setIsAddModalOpen,
    currentView,
    setCurrentView,
    hasClerkKey 
  } = useApp();

  let clerk: any = null;
  try {
    if (hasClerkKey) {
      clerk = useClerk();
    }
  } catch {}

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // 1. Synchronize screen to card: when user opens Add Course modal on Step 2, advance to Step 3
  useEffect(() => {
    if (isAddModalOpen && currentStepIndex === 1) {
      setCurrentStepIndex(2); // Step 3: Paste URL
    }
  }, [isAddModalOpen, currentStepIndex]);

  // 2. Synchronize screen to card: when user imports a course on Step 4, close modal & advance to Step 5
  const prevCoursesCountRef = React.useRef(courses.length);
  useEffect(() => {
    if (courses.length > prevCoursesCountRef.current && (currentStepIndex === 2 || currentStepIndex === 3)) {
      setIsAddModalOpen(false);
      setCurrentStepIndex(4); // Step 5: Start Learning
    }
    prevCoursesCountRef.current = courses.length;
  }, [courses.length, currentStepIndex, setIsAddModalOpen]);

  // 3. Synchronize screen to card: when user clicks "Start Learning" on screen, advance to Step 6 (Workspace)
  useEffect(() => {
    if (currentView === 'workspace' && currentStepIndex === 4) {
      setCurrentStepIndex(5); // Step 6: Player & Video Title
    }
  }, [currentView, currentStepIndex]);

  // Helper to locate the actual visible target element on screen (ignoring hidden/mobile drawer copies)
  const findVisibleTarget = (targetId?: string, fallbackId?: string): { element: HTMLElement; rect: DOMRect } | null => {
    const ids = [targetId, fallbackId].filter(Boolean) as string[];
    for (const id of ids) {
      const elements = Array.from(document.querySelectorAll<HTMLElement>(`#${id}, [data-tour="${id}"]`));
      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        if (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        ) {
          return { element: el, rect };
        }
      }
    }
    return null;
  };

  // Recalculate position relative to current target element
  const updatePosition = useCallback(() => {
    if (!isOpen) return;

    if (currentStep.placement === 'center' || !currentStep.targetId) {
      setTargetRect(null);
      const cardWidth = Math.min(window.innerWidth - 32, 360);
      const cardHeight = 260;
      setCardPosition({
        top: Math.max(40, window.innerHeight / 2 - cardHeight / 2),
        left: Math.max(16, window.innerWidth / 2 - cardWidth / 2),
        placement: 'center',
      });
      return;
    }

    // Modal input override when modal is open
    let overrideTargetId = currentStep.targetId;
    if (isAddModalOpen && (currentStepIndex === 1 || currentStepIndex === 2)) {
      overrideTargetId = 'tour-course-url-input';
    }

    const targetInfo = findVisibleTarget(overrideTargetId, currentStep.fallbackTargetId);

    const cardWidth = Math.min(window.innerWidth - 32, 360);
    const cardHeight = 220;

    if (targetInfo) {
      const { rect } = targetInfo;
      setTargetRect(rect);

      let top = 0;
      let left = 0;
      let placement = currentStep.placement || 'bottom';

      if (placement === 'bottom') {
        top = rect.bottom + 12;
        left = rect.left + rect.width / 2 - cardWidth / 2;
        if (top + cardHeight > window.innerHeight - 16) {
          top = Math.max(16, rect.top - cardHeight - 12);
          placement = 'top';
        }
      } else if (placement === 'top') {
        top = rect.top - cardHeight - 12;
        left = rect.left + rect.width / 2 - cardWidth / 2;
        if (top < 16) {
          top = rect.bottom + 12;
          placement = 'bottom';
        }
      } else if (placement === 'left') {
        top = Math.max(60, Math.min(window.innerHeight - cardHeight - 16, rect.top + rect.height / 2 - cardHeight / 2));
        left = rect.left - cardWidth - 14;
        if (left < 16) {
          top = rect.bottom + 12;
          left = Math.max(16, rect.left);
          placement = 'bottom';
        }
      } else {
        top = rect.bottom + 12;
        left = rect.left;
      }

      // Viewport bounds clamping
      const clampedLeft = Math.max(16, Math.min(window.innerWidth - cardWidth - 16, left));
      const clampedTop = Math.max(16, Math.min(window.innerHeight - cardHeight - 16, top));

      setCardPosition({
        top: clampedTop,
        left: clampedLeft,
        placement,
      });
    }
  }, [isOpen, currentStep, isAddModalOpen, currentStepIndex]);

  useEffect(() => {
    updatePosition();
    const handleResize = () => updatePosition();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    const interval = setInterval(updatePosition, 300);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
      clearInterval(interval);
    };
  }, [updatePosition]);

  // Handle side-effects on step change (view navigation, tab switching)
  useEffect(() => {
    if (!isOpen) return;

    if (currentStep.requiresPlaylistsView && currentView !== 'playlists') {
      setCurrentView('playlists');
    }

    if (currentStep.requiresWorkspace && currentView !== 'workspace' && activeCourse) {
      setCurrentView('workspace');
    }

    if (currentStep.targetTab) {
      setIsRightPanelOpen(true);
      setWorkspaceRightTab(currentStep.targetTab);
    } else if (currentStep.id === 'queue') {
      setIsRightPanelOpen(true);
    } else {
      // Keep the Playlist & Notes panel out of the way on steps that aren't about it
      // (e.g. Step 6's distraction-free player), so it doesn't pop up mid-tour.
      setIsRightPanelOpen(false);
    }
  }, [currentStepIndex, isOpen, currentStep, setIsRightPanelOpen, setWorkspaceRightTab, setCurrentView, currentView, activeCourse]);

  // Restore the Playlist & Notes panel to its normal default (open) once the tour is closed
  useEffect(() => {
    if (!isOpen) {
      setIsRightPanelOpen(true);
    }
  }, [isOpen, setIsRightPanelOpen]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(RECOMMENDED_PLAYLIST_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleNext = () => {
    if (isLastStep) {
      onClose();
      return;
    }

    // Advancing from Step 5 opens workspace
    if (currentStepIndex === 4) {
      setCurrentView('workspace');
    }

    setCurrentStepIndex(prev => prev + 1);
  };

  const handleBack = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSignIn = () => {
    if (clerk?.openSignUp) {
      clerk.openSignUp();
    } else if (clerk?.openSignIn) {
      clerk.openSignIn();
    } else if (onReturnToLanding) {
      onReturnToLanding();
    }
  };

  // Minimized launcher button when closed
  if (!isOpen) {
    return (
      <button
        onClick={onOpenTour}
        className="fixed bottom-4 right-4 z-50 px-3.5 py-2 rounded-full bg-[#121417] text-[#EBF755] hover:bg-black font-extrabold text-xs border-2 border-[#121417] shadow-solid flex items-center gap-1.5 transition-all hover:scale-105 active:scale-95 group"
        title="Open Step-by-Step Interactive Guide"
      >
        <Sparkles className="w-3.5 h-3.5 text-[#EBF755] group-hover:rotate-12 transition-transform" />
        <span>Guide</span>
        <span className="w-1.5 h-1.5 rounded-full bg-[#EBF755] animate-ping" />
      </button>
    );
  }

  const cardWidth = Math.min(window.innerWidth - 32, 360);

  return (
    <>
      {/* 1. Animated Spotlight Highlight Box Over Target Element */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[65] rounded-2xl border-2 border-[#EBF755] ring-4 ring-[#EBF755]/60 animate-pulse transition-all duration-300 shadow-[0_0_30px_rgba(235,247,85,0.5)]"
          style={{
            top: targetRect.top - 5,
            left: targetRect.left - 5,
            width: targetRect.width + 10,
            height: targetRect.height + 10,
          }}
        />
      )}

      {/* 2. Floating Animated Tour Guide Card with Bobbing Animation */}
      <div
        className="fixed z-[70] max-w-[360px] w-[calc(100vw-2rem)] transition-all duration-500 ease-out"
        style={{
          top: cardPosition.top,
          left: cardPosition.left,
        }}
      >
        {/* Dynamic Directional Triangle Pointer Arrow */}
        {targetRect && cardPosition.placement === 'bottom' && (
          <div 
            className="absolute -top-3 w-0 h-0 border-x-8 border-x-transparent border-b-[12px] border-b-[#121417] z-20 pointer-events-none"
            style={{
              left: Math.max(20, Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - cardPosition.left - 8)),
            }}
          />
        )}
        {targetRect && cardPosition.placement === 'top' && (
          <div 
            className="absolute -bottom-3 w-0 h-0 border-x-8 border-x-transparent border-t-[12px] border-t-[#121417] z-20 pointer-events-none"
            style={{
              left: Math.max(20, Math.min(cardWidth - 28, targetRect.left + targetRect.width / 2 - cardPosition.left - 8)),
            }}
          />
        )}
        {targetRect && cardPosition.placement === 'left' && (
          <div 
            className="absolute -right-3 w-0 h-0 border-y-8 border-y-transparent border-l-[12px] border-l-[#121417] z-20 pointer-events-none"
            style={{
              top: Math.max(16, Math.min(220, targetRect.top + targetRect.height / 2 - cardPosition.top - 8)),
            }}
          />
        )}

        {/* Inner Floating Wrapper with up/down bobbing animation */}
        <div className="animate-tour-float relative rounded-3xl bg-white border-2 border-[#121417] shadow-solid-lg p-4 sm:p-4.5 overflow-hidden flex flex-col gap-2.5">
          
          {/* Top Yellow Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-[#EBF755] border-b-2 border-[#121417]" />

          {/* Header Row */}
          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex items-center gap-1.5">
              <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#EBF755] text-black border border-[#121417]/30">
                Tour
              </span>
              <span className="text-[11px] font-black text-[#5A606A]">
                Step {currentStep.stepNumber} of {TOUR_STEPS.length}
              </span>
            </div>

            <button
              onClick={onClose}
              className="p-1 rounded-full text-[#5A606A] hover:text-[#121417] hover:bg-slate-100 transition-colors"
              title="Close tour"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar Dots */}
          <div className="grid grid-cols-10 gap-1 w-full">
            {TOUR_STEPS.map((step, idx) => (
              <button
                key={step.id}
                onClick={() => setCurrentStepIndex(idx)}
                className={`h-1 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'bg-[#121417]'
                    : idx < currentStepIndex
                    ? 'bg-[#EBF755] border border-[#121417]/40'
                    : 'bg-slate-200 hover:bg-slate-300'
                }`}
                title={`Jump to step ${idx + 1}`}
              />
            ))}
          </div>

          {/* Title & Description */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#EBF755] border border-[#121417] shadow-solid-2xs flex items-center justify-center shrink-0">
                {currentStep.icon}
              </div>
              <h3 className="text-xs sm:text-sm font-black text-[#121417] tracking-tight leading-tight">
                {currentStep.title}
              </h3>
            </div>

            <p className="text-[11px] text-[#121417]/85 leading-snug font-medium pt-0.5">
              {currentStep.description}
            </p>
          </div>

          {/* Special Playlist Link Box on Step 1 */}
          {currentStep.isPlaylistStep && (
            <div className="p-2.5 rounded-2xl bg-[#F9F8F5] border-2 border-[#121417] shadow-solid-xs space-y-2">
              <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-[#121417]">
                <span className="font-extrabold truncate">{RECOMMENDED_PLAYLIST_NAME}</span>
                <span className="bg-[#EBF755] text-black px-1.5 py-0.2 rounded font-mono text-[9px] border border-black/20">60+ Vids</span>
              </div>

              <div className="p-1.5 rounded-lg bg-white border border-[#121417]/20 font-mono text-[9px] text-[#121417]/80 truncate select-all">
                {RECOMMENDED_PLAYLIST_URL}
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full py-2 rounded-xl text-xs font-black bg-white hover:bg-slate-50 text-[#121417] border-2 border-[#121417] shadow-2xs transition-all hover:scale-102 active:scale-95 flex items-center justify-center gap-1.5"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Playlist Link</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Footer Controls */}
          <div className="pt-1.5 border-t border-[#121417]/10 flex items-center justify-between gap-2">
            <button
              onClick={handleBack}
              disabled={isFirstStep}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border border-[#121417] transition-all flex items-center gap-0.5 ${
                isFirstStep
                  ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-300'
                  : 'bg-white hover:bg-slate-50 text-[#121417] shadow-2xs hover:scale-102'
              }`}
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>

            <div className="flex items-center gap-1.5">
              {currentStepIndex === 4 && (
                <button
                  onClick={() => {
                    setCurrentView('workspace');
                    setCurrentStepIndex(5);
                  }}
                  className="px-3 py-1 rounded-full text-[11px] font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start Learning &rarr;</span>
                </button>
              )}

              {isLastStep ? (
                <button
                  onClick={handleSignIn}
                  className="px-3 py-1 rounded-full text-[11px] font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>Sign In Now</span>
                </button>
              ) : (
                currentStepIndex !== 4 && (
                  <button
                    onClick={handleNext}
                    className="px-3 py-1 rounded-full text-[11px] font-black bg-[#121417] hover:bg-black text-[#EBF755] border border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-3 h-3 text-[#EBF755]" />
                  </button>
                )
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
};
