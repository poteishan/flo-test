import React, { useState } from 'react';
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
  BrainCircuit,
  Coffee,
  Award,
  Clock,
  PanelRightClose
} from 'lucide-react';

export const CompactTimerBar: React.FC = () => {
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
    setIsNotesOpen,
  } = useApp();

  // Dropdown state for the full Focus Engine container
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isCustomizing, setIsCustomizing] = useState<boolean>(true);
  const [customWork, setCustomWork] = useState<number>(pomodoroSettings.workDuration);
  const [customShort, setCustomShort] = useState<number>(pomodoroSettings.shortBreakDuration);
  const [customLong, setCustomLong] = useState<number>(pomodoroSettings.longBreakDuration);

  const currentDurationSec = (
    pomodoroMode === 'work' 
      ? pomodoroSettings.workDuration 
      : pomodoroMode === 'shortBreak' 
      ? pomodoroSettings.shortBreakDuration 
      : pomodoroSettings.longBreakDuration
  ) * 60;

  const progressPercent = Math.min(100, Math.max(0, ((currentDurationSec - pomodoroTimeLeft) / currentDurationSec) * 100));

  const modes: { key: typeof pomodoroMode; label: string }[] = [
    { key: 'work', label: 'Focus' },
    { key: 'shortBreak', label: 'Short Break' },
    { key: 'longBreak', label: 'Long Break' },
  ];

  const handleToggleSettingsDropdown = () => {
    if (!isExpanded) {
      setIsExpanded(true);
      setIsCustomizing(true); // Open settings drawer by default
    } else {
      setIsExpanded(false);
    }
  };

  const handleSaveCustomSettings = () => {
    updatePomodoroSettings({
      workDuration: Math.max(1, customWork),
      shortBreakDuration: Math.max(1, customShort),
      longBreakDuration: Math.max(1, customLong),
    });
    setIsCustomizing(false);
  };

  return (
    <div className="bg-white border-b-2 border-[#121417]/10 flex flex-col select-none shadow-xs transition-all">
      {/* 1. COMPACT RECTANGULAR TIMER BAR */}
      <div className="p-3 flex flex-col gap-2.5">
        {/* Top row: Mode Pills + Sound Toggle + Settings Button + Streak */}
        <div className="flex items-center justify-between gap-1.5 flex-wrap">
          {/* Mode switcher pills */}
          <div className="flex items-center gap-1 bg-[#F9F8F5] p-1 rounded-xl border border-[#121417]/15">
            {modes.map(m => (
              <button
                key={m.key}
                onClick={() => setPomodoroMode(m.key)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-extrabold transition-all ${
                  pomodoroMode === m.key
                    ? 'bg-[#121417] text-[#EBF755] shadow-xs scale-102'
                    : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            {/* Sound Toggle */}
            <button
              onClick={() => updatePomodoroSettings({ soundEnabled: !pomodoroSettings.soundEnabled })}
              className={`p-1.5 rounded-lg border text-xs transition-colors ${
                pomodoroSettings.soundEnabled
                  ? 'bg-white border-[#121417]/20 text-[#121417] hover:bg-slate-50'
                  : 'bg-slate-100 border-slate-200 text-slate-400'
              }`}
              title={pomodoroSettings.soundEnabled ? "Mute Timer Sounds" : "Enable Timer Sounds"}
            >
              {pomodoroSettings.soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            </button>

            {/* Settings Button: Drops down the full Focus Engine container */}
            <button
              onClick={handleToggleSettingsDropdown}
              className={`p-1.5 rounded-lg border text-xs transition-all ${
                isExpanded
                  ? 'bg-[#EBF755] text-black border-[#121417]/30 shadow-xs scale-105'
                  : 'bg-white border-[#121417]/20 text-[#121417] hover:bg-slate-50'
              }`}
              title={isExpanded ? "Close Focus Engine" : "Open Focus Engine Settings"}
            >
              <Settings className={`w-3.5 h-3.5 ${isExpanded ? 'animate-spin-slow' : ''}`} />
            </button>

            {/* Hide Notes Panel Button */}
            <button
              onClick={() => setIsNotesOpen(false)}
              className="p-1.5 rounded-lg border border-[#121417]/20 text-[#121417]/60 hover:text-[#121417] hover:bg-slate-50 text-xs transition-colors"
              title="Hide Notes Panel"
            >
              <PanelRightClose className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Bottom row: Countdown Display + Controls */}
        <div className="flex items-center justify-between gap-3 bg-[#F9F8F5] px-3.5 py-2 rounded-2xl border border-[#121417]/15">
          {/* Countdown */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-[#EBF755] border border-[#121417]/20 flex items-center justify-center text-[#121417]">
              <Timer className="w-3.5 h-3.5" />
            </div>
            <span className="font-mono text-xl font-black text-[#121417] tracking-tight">
              {formatTime(pomodoroTimeLeft)}
            </span>
            {isPomodoroRunning && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping ml-1" />
            )}
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={isPomodoroRunning ? pausePomodoro : startPomodoro}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all ${
                isPomodoroRunning
                  ? 'bg-amber-200 text-amber-950 hover:bg-amber-300 border border-amber-400 shadow-xs'
                  : 'bg-[#EBF755] hover:bg-[#E2EF43] text-[#121417] border border-[#121417]/30 shadow-solid active:scale-95'
              }`}
            >
              {isPomodoroRunning ? (
                <>
                  <Pause className="w-3 h-3 fill-current" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="w-3 h-3 fill-current" />
                  <span>Start</span>
                </>
              )}
            </button>

            <button
              onClick={resetPomodoro}
              className="p-1.5 rounded-full bg-white hover:bg-slate-100 border border-[#121417]/20 text-[#121417]/70 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={skipPomodoro}
              className="p-1.5 rounded-full bg-white hover:bg-slate-100 border border-[#121417]/20 text-[#121417]/70 transition-colors"
              title="Skip Interval"
            >
              <FastForward className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Slim Progress Bar */}
        <div className="w-full h-1.5 bg-[#121417]/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#EBF755] transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* 2. DROP-DOWN FOCUS ENGINE CONTAINER (IMAGE 2) */}
      {isExpanded && (
        <div className="border-t-2 border-[#121417]/15 bg-[#F9F8F5] p-4 animate-fade-in overflow-y-auto max-h-[520px]">
          <div className="rounded-3xl bg-white border-2 border-[#121417] shadow-solid overflow-hidden text-[#121417]">
            {/* Modal Top Bar */}
            <div className="px-4 py-3 border-b border-[#121417]/10 bg-[#F9F8F5] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EBF755] border border-[#121417] text-[#121417] flex items-center justify-center font-bold">
                  <BrainCircuit className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#121417]">
                    Focus Engine
                  </h3>
                  <p className="text-[10px] text-[#121417]/60 font-semibold">Pomodoro Study Sprints</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => updatePomodoroSettings({ soundEnabled: !pomodoroSettings.soundEnabled })}
                  className="p-1.5 rounded-full hover:bg-black/5 text-[#121417] transition-colors"
                  title={pomodoroSettings.soundEnabled ? "Sound enabled" : "Sound muted"}
                >
                  {pomodoroSettings.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                </button>
                <button
                  onClick={() => setIsCustomizing(!isCustomizing)}
                  className={`p-1.5 rounded-full transition-colors ${
                    isCustomizing ? 'bg-[#EBF755] text-black border border-[#121417]/30' : 'hover:bg-black/5 text-[#121417]'
                  }`}
                  title="Customize durations"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-1.5 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                  title="Close Focus Engine"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Focus Engine Body */}
            <div className="p-4">
              {/* Mode Switcher Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-[#F9F8F5] p-1 rounded-2xl border border-[#121417]/10 mb-4">
                <button
                  onClick={() => setPomodoroMode('work')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    pomodoroMode === 'work'
                      ? 'bg-[#EBF755] text-black border border-[#121417] shadow-sm'
                      : 'text-[#121417]/60 hover:text-[#121417]'
                  }`}
                >
                  <BrainCircuit className="w-3.5 h-3.5" />
                  <span>Work</span>
                </button>
                <button
                  onClick={() => setPomodoroMode('shortBreak')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    pomodoroMode === 'shortBreak'
                      ? 'bg-[#D4E4FC] text-black border border-[#121417] shadow-sm'
                      : 'text-[#121417]/60 hover:text-[#121417]'
                  }`}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>Short</span>
                </button>
                <button
                  onClick={() => setPomodoroMode('longBreak')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                    pomodoroMode === 'longBreak'
                      ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                      : 'text-[#121417]/60 hover:text-[#121417]'
                  }`}
                >
                  <span>Long</span>
                </button>
              </div>

              {/* Circular Progress Display */}
              <div className="flex flex-col items-center justify-center my-2">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      className="stroke-slate-100"
                      strokeWidth="7"
                      fill="transparent"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="44"
                      className={`transition-all duration-500 ease-linear ${
                        pomodoroMode === 'work'
                          ? 'stroke-[#121417]'
                          : pomodoroMode === 'shortBreak'
                          ? 'stroke-blue-500'
                          : 'stroke-amber-500'
                      }`}
                      strokeWidth="7"
                      strokeDasharray="276.46"
                      strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                    />
                  </svg>

                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-mono text-3xl font-black tracking-tight text-[#121417]">
                      {formatTime(pomodoroTimeLeft)}
                    </span>
                    <span className="text-[10px] font-bold text-[#121417]/60 uppercase tracking-wider mt-1">
                      {pomodoroMode === 'work' ? 'Deep Work' : 'Rest & Recharge'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Controls */}
              <div className="flex items-center justify-center gap-3 mt-3">
                <button
                  onClick={resetPomodoro}
                  className="p-2.5 rounded-full bg-[#F9F8F5] hover:bg-slate-200 text-[#121417] border border-[#121417]/20 transition-colors"
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={isPomodoroRunning ? pausePomodoro : startPomodoro}
                  className={`px-6 py-2.5 rounded-full font-black text-xs flex items-center gap-2 border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 ${
                    isPomodoroRunning
                      ? 'bg-amber-200 text-amber-950'
                      : 'bg-[#121417] text-[#EBF755]'
                  }`}
                >
                  {isPomodoroRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{isPomodoroRunning ? 'PAUSE' : 'START SPRINT'}</span>
                </button>

                <button
                  onClick={skipPomodoro}
                  className="p-2.5 rounded-full bg-[#F9F8F5] hover:bg-slate-200 text-[#121417] border border-[#121417]/20 transition-colors"
                  title="Skip to Next Session"
                >
                  <FastForward className="w-4 h-4" />
                </button>
              </div>

              {/* Custom Settings Form Drawer (Opens by default or via Settings button) */}
              {isCustomizing && (
                <div className="mt-4 p-3.5 bg-[#F9F8F5] rounded-2xl border border-[#121417]/15 space-y-2.5 animate-fade-in">
                  <div className="text-xs font-black text-[#121417] flex items-center justify-between">
                    <span>Custom Durations (minutes)</span>
                    <span className="text-[10px] text-[#121417]/50 font-normal">Auto-applies</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-[#121417]/60 block mb-1">Work</label>
                      <input
                        type="number"
                        min="1"
                        max="120"
                        value={customWork}
                        onChange={(e) => setCustomWork(Number(e.target.value))}
                        className="w-full bg-white border border-[#121417]/20 rounded-xl p-1.5 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#121417]/60 block mb-1">Short Break</label>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        value={customShort}
                        onChange={(e) => setCustomShort(Number(e.target.value))}
                        className="w-full bg-white border border-[#121417]/20 rounded-xl p-1.5 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-[#121417]/60 block mb-1">Long Break</label>
                      <input
                        type="number"
                        min="1"
                        max="90"
                        value={customLong}
                        onChange={(e) => setCustomLong(Number(e.target.value))}
                        className="w-full bg-white border border-[#121417]/20 rounded-xl p-1.5 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveCustomSettings}
                    className="w-full py-2 rounded-full bg-[#121417] hover:bg-black text-[#EBF755] text-xs font-black transition-all shadow-xs"
                  >
                    Apply Custom Times
                  </button>
                </div>
              )}

              {/* Daily Stats Section (Sessions, Focused, Streak) */}
              <div className="mt-4 pt-3 border-t border-[#121417]/10 grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded-2xl bg-[#F9F8F5] border border-[#121417]/10">
                  <div className="flex items-center justify-center text-[#121417] mb-0.5">
                    <Award className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-xs font-black text-[#121417] block">
                    {pomodoroStats.sessionsCompleted}
                  </span>
                  <span className="text-[9px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                    Sessions
                  </span>
                </div>

                <div className="p-2 rounded-2xl bg-[#F9F8F5] border border-[#121417]/10">
                  <div className="flex items-center justify-center text-emerald-600 mb-0.5">
                    <Clock className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-mono text-xs font-black text-[#121417] block">
                    {pomodoroStats.todayFocusMinutes}m
                  </span>
                  <span className="text-[9px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                    Focused
                  </span>
                </div>

                <div 
                  className={`p-2 rounded-2xl border transition-all ${
                    pomodoroStats.todayFocusMinutes >= 10
                      ? 'bg-[#EBF755]/40 border-[#121417]/20'
                      : 'bg-[#F9F8F5] border-[#121417]/10'
                  }`}
                  title={
                    pomodoroStats.todayFocusMinutes >= 10
                      ? `Streak unlocked today! (${pomodoroStats.todayFocusMinutes} mins)`
                      : `${pomodoroStats.todayFocusMinutes}/10 mins today to unlock streak`
                  }
                >
                  <div className="flex items-center justify-center text-orange-500 mb-0.5">
                    <Flame className={`w-3.5 h-3.5 fill-current ${pomodoroStats.todayFocusMinutes >= 10 ? 'text-orange-500' : 'text-slate-400'}`} />
                  </div>
                  <span className="font-mono text-xs font-black text-[#121417] block">
                    {pomodoroStats.streakDays}d
                  </span>
                  <span className="text-[9px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                    {pomodoroStats.todayFocusMinutes >= 10 ? 'Streak 🔥' : `${pomodoroStats.todayFocusMinutes}/10m`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
