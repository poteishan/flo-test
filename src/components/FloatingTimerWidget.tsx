import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime } from '../utils/youtube';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Timer, 
  Flame, 
  Volume2, 
  VolumeX, 
  Settings, 
  X, 
  GripHorizontal,
  Minimize2,
  Maximize2
} from 'lucide-react';

export const FloatingTimerWidget: React.FC = () => {
  const {
    pomodoroMode,
    pomodoroTimeLeft,
    isPomodoroRunning,
    pomodoroSettings,
    pomodoroStats,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    skipPomodoro,
    setPomodoroMode,
    updatePomodoroSettings,
    isFloatingTimerOpen,
    setIsFloatingTimerOpen,
  } = useApp();

  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const defaultX = typeof window !== 'undefined' ? Math.max(16, window.innerWidth - 380) : 100;
    const defaultY = 80;
    return { x: defaultX, y: defaultY };
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [customWork, setCustomWork] = useState(pomodoroSettings.workDuration);
  const [customShort, setCustomShort] = useState(pomodoroSettings.shortBreakDuration);
  const [customLong, setCustomLong] = useState(pomodoroSettings.longBreakDuration);

  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
  });

  // Handle Dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag when clicking the drag handle or header background, not interactive buttons
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    };
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input')) {
      return;
    }
    if (e.touches[0]) {
      setIsDragging(true);
      dragRef.current = {
        startX: e.touches[0].clientX,
        startY: e.touches[0].clientY,
        initialX: position.x,
        initialY: position.y,
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const widgetWidth = isMinimized ? 240 : 340;
      const maxX = Math.max(10, window.innerWidth - widgetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - 100);

      setPosition({
        x: Math.max(10, Math.min(maxX, dragRef.current.initialX + dx)),
        y: Math.max(10, Math.min(maxY, dragRef.current.initialY + dy)),
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !e.touches[0]) return;
      const dx = e.touches[0].clientX - dragRef.current.startX;
      const dy = e.touches[0].clientY - dragRef.current.startY;
      const widgetWidth = isMinimized ? 240 : 340;
      const maxX = Math.max(10, window.innerWidth - widgetWidth - 10);
      const maxY = Math.max(10, window.innerHeight - 100);

      setPosition({
        x: Math.max(10, Math.min(maxX, dragRef.current.initialX + dx)),
        y: Math.max(10, Math.min(maxY, dragRef.current.initialY + dy)),
      });
    };

    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isMinimized]);

  if (!isFloatingTimerOpen) return null;

  const currentDurationSec = (
    pomodoroMode === 'work' 
      ? pomodoroSettings.workDuration 
      : pomodoroMode === 'shortBreak' 
      ? pomodoroSettings.shortBreakDuration 
      : pomodoroSettings.longBreakDuration
  ) * 60;

  const progressPercent = Math.min(100, Math.max(0, ((currentDurationSec - pomodoroTimeLeft) / currentDurationSec) * 100));

  const handleApplySettings = () => {
    updatePomodoroSettings({
      workDuration: Math.max(1, customWork),
      shortBreakDuration: Math.max(1, customShort),
      longBreakDuration: Math.max(1, customLong),
    });
    setIsSettingsOpen(false);
  };

  return (
    <div
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
      className={`fixed z-50 bg-white border-2 border-[#121417] shadow-solid-lg rounded-3xl transition-shadow select-none ${
        isDragging ? 'cursor-grabbing opacity-90 shadow-2xl scale-[1.02]' : 'shadow-solid'
      }`}
    >
      {/* Drag Header Bar */}
      <div
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        className="flex items-center justify-between px-3.5 py-2.5 bg-[#F9F8F5] rounded-t-3xl border-b border-[#121417]/10 cursor-grab"
      >
        <div className="flex items-center gap-2">
          <GripHorizontal className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-black text-[#121417] flex items-center gap-1.5">
            <Timer className="w-3.5 h-3.5 text-[#121417]" />
            <span>Focus Timer</span>
          </span>
          {isPomodoroRunning && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-black/5 transition-colors"
            title={isMinimized ? "Expand Timer" : "Minimize to Pill"}
          >
            {isMinimized ? <Maximize2 className="w-3.5 h-3.5" /> : <Minimize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setIsFloatingTimerOpen(false)}
            className="p-1 rounded-lg text-slate-500 hover:text-black hover:bg-black/5 transition-colors"
            title="Close Timer (can reopen from Header)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Minimized Pill View */}
      {isMinimized ? (
        <div className="p-3 flex items-center justify-between gap-3 w-64 bg-white rounded-b-3xl">
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${pomodoroMode === 'work' ? 'bg-[#EBF755] border border-black' : 'bg-sky-400'}`} />
            <span className="font-mono text-base font-black text-[#121417]">
              {formatTime(pomodoroTimeLeft)}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => isPomodoroRunning ? pausePomodoro() : startPomodoro()}
              className="p-1.5 rounded-full bg-[#121417] text-white hover:bg-black transition-colors"
              title={isPomodoroRunning ? "Pause" : "Start"}
            >
              {isPomodoroRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.2" />}
            </button>
            <button
              onClick={resetPomodoro}
              className="p-1.5 rounded-full bg-slate-100 text-slate-600 hover:text-black transition-colors"
              title="Reset"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        /* Full Draggable Widget Content */
        <div className="p-4 w-[340px] bg-white rounded-b-3xl space-y-3.5">
          {/* Mode Selector Pills */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#F9F8F5] rounded-2xl border border-[#121417]/10">
            {(['work', 'shortBreak', 'longBreak'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setPomodoroMode(mode)}
                className={`py-1.5 text-center text-xs font-bold rounded-xl transition-all ${
                  pomodoroMode === mode
                    ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                    : 'text-[#121417]/70 hover:text-[#121417]'
                }`}
              >
                {mode === 'work' ? 'Focus' : mode === 'shortBreak' ? 'Short' : 'Long'}
              </button>
            ))}
          </div>

          {/* Large Digital Timer & Progress Bar */}
          <div className="text-center py-2 relative">
            <div className="font-mono text-4xl font-extrabold text-[#121417] tracking-tight">
              {formatTime(pomodoroTimeLeft)}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-1 text-[11px] font-bold text-[#121417]/60">
              <Flame className={`w-3.5 h-3.5 fill-current ${pomodoroStats.todayFocusMinutes >= 10 ? 'text-orange-500' : 'text-slate-400'}`} />
              <span>{pomodoroStats.streakDays}d Streak ({pomodoroStats.todayFocusMinutes}/10m today) • {pomodoroStats.sessionsCompleted} Sessions</span>
            </div>

            {/* Progress Track */}
            <div className="w-full h-1.5 bg-[#121417]/10 rounded-full overflow-hidden mt-3">
              <div 
                className="h-full bg-[#EBF755] border-r border-black/30 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => updatePomodoroSettings({ soundEnabled: !pomodoroSettings.soundEnabled })}
                className={`p-2 rounded-xl border transition-colors ${
                  pomodoroSettings.soundEnabled
                    ? 'bg-white border-[#121417]/20 text-[#121417] hover:bg-slate-50'
                    : 'bg-rose-50 border-rose-200 text-rose-600'
                }`}
                title={pomodoroSettings.soundEnabled ? "Sound ON" : "Sound Muted"}
              >
                {pomodoroSettings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                className={`p-2 rounded-xl border transition-colors ${
                  isSettingsOpen 
                    ? 'bg-[#EBF755] border-black text-black' 
                    : 'bg-white border-[#121417]/20 text-[#121417] hover:bg-slate-50'
                }`}
                title="Customize Durations"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={resetPomodoro}
                className="p-2 rounded-xl bg-white border border-[#121417]/20 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors"
                title="Reset Timer"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => isPomodoroRunning ? pausePomodoro() : startPomodoro()}
                className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs font-black shadow-solid transition-all hover:scale-105 active:scale-95 ${
                  isPomodoroRunning 
                    ? 'bg-[#121417] text-white hover:bg-black' 
                    : 'bg-[#EBF755] text-black hover:bg-[#E2EF43]'
                }`}
              >
                {isPomodoroRunning ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                <span>{isPomodoroRunning ? 'Pause' : 'Start Focus'}</span>
              </button>

              <button
                onClick={skipPomodoro}
                className="p-2 rounded-xl bg-white border border-[#121417]/20 text-slate-600 hover:text-black hover:bg-slate-50 transition-colors"
                title="Skip Session"
              >
                <FastForward className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Expandable Custom Duration Settings */}
          {isSettingsOpen && (
            <div className="p-3 bg-[#F9F8F5] rounded-2xl border border-[#121417]/15 space-y-2.5 animate-fade-in text-xs">
              <div className="font-extrabold text-[#121417]">Customize Durations (minutes)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Focus</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={customWork}
                    onChange={(e) => setCustomWork(Number(e.target.value))}
                    className="w-full bg-white border border-[#121417]/20 rounded-xl px-2 py-1 font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Short Break</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customShort}
                    onChange={(e) => setCustomShort(Number(e.target.value))}
                    className="w-full bg-white border border-[#121417]/20 rounded-xl px-2 py-1 font-mono font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 block mb-1">Long Break</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={customLong}
                    onChange={(e) => setCustomLong(Number(e.target.value))}
                    className="w-full bg-white border border-[#121417]/20 rounded-xl px-2 py-1 font-mono font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={handleApplySettings}
                  className="px-3 py-1 bg-[#121417] text-[#EBF755] font-bold rounded-full text-xs hover:bg-black transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
