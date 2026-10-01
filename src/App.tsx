import React, { useState, useEffect, useRef } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { PlayerWorkspace } from './components/PlayerWorkspace';
import { WorkspaceRightPanel } from './components/WorkspaceRightPanel';
import { AddCourseModal } from './components/AddCourseModal';
import { LandingPage } from './components/LandingPage';
import { PlaylistsView } from './components/PlaylistsView';
import { NotesView } from './components/NotesView';
import { TimerCelebrationModal } from './components/TimerCelebrationModal';
import { FloatingTimerWidget } from './components/FloatingTimerWidget';
import { DemoTourGuide } from './components/DemoTourGuide';
import { formatTime } from './utils/youtube';
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react';
import { Home, ListVideo } from 'lucide-react';

// Each dashboard section gets its own URL (/playlists, /workspace, /notes) and browser
// history entry, so the browser's Back/Forward buttons move between sections.
const VIEWS = ['playlists', 'workspace', 'notes'] as const;
type View = typeof VIEWS[number];
const isView = (value: unknown): value is View => VIEWS.includes(value as View);
const viewFromPath = () => {
  const segment = window.location.pathname.replace(/^\/+|\/+$/g, '');
  return isView(segment) ? segment : null;
};

interface DashboardProps {
  onBackToLanding?: () => void;
  isDemoMode?: boolean;
}

const Dashboard: React.FC<DashboardProps> = ({ onBackToLanding, isDemoMode = false }) => {
  const [isTourOpen, setIsTourOpen] = useState<boolean>(isDemoMode);
  const {
    currentView,
    setCurrentView,
    activeCourse,
    isRightPanelOpen,
    setIsRightPanelOpen,
    workspaceRightTab,
    setWorkspaceRightTab,
    isPomodoroRunning,
    startPomodoro,
    pausePomodoro,
    getCurrentPlayerTime,
    getNoteForCurrentVideo,
    saveNoteForCurrentVideo,
    isPomodoroExpanded,
    setIsPomodoroExpanded,
  } = useApp();

  // Browser history <-> section sync.
  // On mount, open the section named in the URL (e.g. after a reload on /notes) and tag the
  // current history entry with it. Afterwards, every section change pushes a new entry.
  const historyInitializedRef = useRef(false);
  const pendingInitialViewRef = useRef<View | null>(null);

  useEffect(() => {
    if (!historyInitializedRef.current) {
      historyInitializedRef.current = true;
      const urlView = viewFromPath();
      const initialView: View = urlView && !(urlView === 'workspace' && !activeCourse) ? urlView : currentView;
      const state = { ...window.history.state, floView: initialView };
      const url = `/${initialView}${window.location.search}${window.location.hash}`;

      // Entering the demo from the landing page keeps the landing page as the previous
      // entry, so Back returns to it. Otherwise the entry is replaced, not duplicated.
      if (isDemoMode && !urlView) {
        window.history.pushState(state, '', url);
      } else {
        window.history.replaceState(state, '', url);
      }

      if (initialView !== currentView) {
        pendingInitialViewRef.current = initialView;
        setCurrentView(initialView);
      }
      return;
    }

    // Wait until the initial section from the URL has been applied before pushing anything.
    if (pendingInitialViewRef.current) {
      if (currentView !== pendingInitialViewRef.current) return;
      pendingInitialViewRef.current = null;
    }

    if (window.history.state?.floView !== currentView) {
      window.history.pushState({ ...window.history.state, floView: currentView }, '', `/${currentView}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentView]);

  // Back/Forward: show the section stored on that history entry.
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      const view = e.state?.floView;
      if (isView(view)) {
        setCurrentView(view);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setCurrentView]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = 
        !target ||
        target.tagName === 'INPUT' || 
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        Boolean(target.closest?.('[contenteditable="true"]')) ||
        Boolean(target.closest?.('.ProseMirror')) ||
        Boolean(target.closest?.('.tiptap'));

      // Alt + T: Insert timestamp note anytime
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        const currentSec = getCurrentPlayerTime();
        const formatted = formatTime(currentSec);
        const existing = getNoteForCurrentVideo();
        saveNoteForCurrentVideo({ content: existing.content + `<p><br></p><p>▶ [${formatted}] </p>` });
        return;
      }

      // Alt + P: Toggle Pomodoro start/pause
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        if (isPomodoroRunning) {
          pausePomodoro();
        } else {
          startPomodoro();
        }
        return;
      }

      // Alt + S: Toggle Queue / Playlist
      if (!isInput && e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!isRightPanelOpen) {
          setIsRightPanelOpen(true);
          setWorkspaceRightTab('playlist');
        } else if (workspaceRightTab === 'playlist') {
          setIsRightPanelOpen(false);
        } else {
          setWorkspaceRightTab('playlist');
        }
      }

      // Alt + N: Toggle Notes
      if (!isInput && e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        if (!isRightPanelOpen) {
          setIsRightPanelOpen(true);
          setWorkspaceRightTab('notes');
        } else if (workspaceRightTab === 'notes') {
          setIsRightPanelOpen(false);
        } else {
          setWorkspaceRightTab('notes');
        }
      }

      // Alt + O: Toggle Pomodoro Dock
      if (!isInput && e.altKey && (e.key === 'o' || e.key === 'O')) {
        e.preventDefault();
        setIsPomodoroExpanded(!isPomodoroExpanded);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    getCurrentPlayerTime,
    getNoteForCurrentVideo,
    saveNoteForCurrentVideo,
    isPomodoroRunning,
    startPomodoro,
    pausePomodoro,
    isRightPanelOpen,
    setIsRightPanelOpen,
    workspaceRightTab,
    setWorkspaceRightTab,
    isPomodoroExpanded,
    setIsPomodoroExpanded,
  ]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F9F8F5] text-[#121417] font-sans selection:bg-[#EBF755] selection:text-black">
      {/* Header Bar */}
      <Header />

      {/* Dynamic Content: Playlists Hub vs. Notes Hub vs. Learning Workspace */}
      {currentView === 'playlists' ? (
        <PlaylistsView />
      ) : currentView === 'notes' ? (
        <NotesView />
      ) : (
        <div className="flex-1 flex min-h-0 relative overflow-hidden">
          {/* Left Main Column: Video Player & Lecture Workspace */}
          <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
            <PlayerWorkspace />
          </div>

          {/* Right Column: YouTube Playlist Queue & Notes with Pomodoro Timer - Desktop Only.
              Below lg, PlayerWorkspace renders its own embedded copy inline beneath the
              video's control bar instead, so it scrolls with the page rather than
              popping up as a full-screen overlay. */}
          <div className={`hidden lg:flex w-[400px] lg:w-[37%] xl:w-[38%] 2xl:w-[39%] min-w-[380px] max-w-[680px] flex-shrink-0 h-full flex-col min-h-0 pt-3 sm:pt-4 lg:pt-6 pb-6 pr-3 sm:pr-4 lg:pr-6 ${!isRightPanelOpen ? '!hidden' : ''}`}>
            <WorkspaceRightPanel isMobileDrawer={false} />
          </div>

          {/* Desktop Re-open Button when Right Panel is collapsed */}
          {!isRightPanelOpen && (
            <button
              onClick={() => setIsRightPanelOpen(true)}
              className="hidden lg:flex absolute right-4 top-3 z-30 items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#EBF755] hover:bg-[#E2EF43] border-2 border-[#121417] shadow-solid text-black text-xs font-black transition-all hover:scale-105 active:scale-95"
              title="Show Playlist & Notes"
            >
              <ListVideo className="w-3.5 h-3.5 text-black" />
              <span>Queue & Notes</span>
            </button>
          )}
        </div>
      )}

      {/* Floating Draggable Focus Engine Widget */}
      <FloatingTimerWidget />

      {/* Add Course / YouTube Playlist Modal */}
      <AddCourseModal />

      {/* Focus & Break Completion Celebration Modal */}
      <TimerCelebrationModal />

      {/* Interactive Step-by-Step Demo Tour Guide - Only in Demo Mode */}
      {isDemoMode && (
        <DemoTourGuide
          isOpen={isTourOpen}
          onClose={() => setIsTourOpen(false)}
          onOpenTour={() => setIsTourOpen(true)}
          onReturnToLanding={onBackToLanding}
        />
      )}

      {/* Optional Back to Landing Page button in bottom left */}
      {onBackToLanding && (
        <button
          onClick={onBackToLanding}
          className="fixed bottom-4 left-4 z-40 px-4 py-2 rounded-full bg-white hover:bg-slate-50 border-2 border-[#121417] text-xs font-bold text-[#121417] transition-all shadow-solid flex items-center gap-2 hover:scale-105"
          title="Return to Landing Page"
        >
          <Home className="w-3.5 h-3.5 text-[#121417]" />
          <span>Landing Page</span>
        </button>
      )}
    </div>
  );
};

export function App({ hasClerkKey = false }: { hasClerkKey?: boolean }) {
  const [guestView, setGuestView] = useState<'landing' | 'workspace'>('landing');

  // Signed-out visitors: Back from the demo returns to the landing page, Forward re-enters it.
  // Dashboard history entries carry a `floView`; the landing page's entry does not.
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      setGuestView(isView(e.state?.floView) ? 'workspace' : 'landing');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const goToLanding = () => {
    window.history.pushState({ ...window.history.state, floView: undefined }, '', '/');
    setGuestView('landing');
  };

  // If Clerk is fully active, use Clerk's SignedIn / SignedOut routing with user sync
  if (hasClerkKey) {
    return (
      <>
        <SignedOut>
          <AppProvider hasClerkKey={true} userId={null}>
            {guestView === 'landing' ? (
              <LandingPage 
                hasClerkKey={true} 
                onEnterDemo={() => setGuestView('workspace')} 
              />
            ) : (
              <Dashboard onBackToLanding={goToLanding} isDemoMode={true} />
            )}
          </AppProvider>
        </SignedOut>
        <SignedIn>
          <SignedInWorkspace />
        </SignedIn>
      </>
    );
  }

  // Fallback demo/preview mode before Clerk key is supplied
  return (
    <AppProvider hasClerkKey={false} userId={null}>
      {guestView === 'landing' ? (
        <LandingPage 
          hasClerkKey={false} 
          onEnterDemo={() => setGuestView('workspace')} 
        />
      ) : (
        <Dashboard onBackToLanding={goToLanding} isDemoMode={true} />
      )}
    </AppProvider>
  );
}

const SignedInWorkspace: React.FC = () => {
  const { user } = useUser();
  return (
    <AppProvider hasClerkKey={true} userId={user?.id || null}>
      <Dashboard />
    </AppProvider>
  );
};

export default App;
