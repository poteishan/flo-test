import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime } from '../utils/youtube';
import { 
  Play, 
  Pause, 
  RotateCcw, 
  FastForward, 
  Settings, 
  Flame, 
  Volume2, 
  VolumeX, 
  X, 
  Clock, 
  Award, 
  Coffee, 
  BrainCircuit, 
  Armchair 
} from 'lucide-react';

export const PomodoroTimer: React.FC = () => {
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
    isPomodoroExpanded,
    setIsPomodoroExpanded,
  } = useApp();

  const [isCustomizing, setIsCustomizing] = useState(false);
  const [customWork, setCustomWork] = useState(pomodoroSettings.workDuration);
  const [customShort, setCustomShort] = useState(pomodoroSettings.shortBreakDuration);
  const [customLong, setCustomLong] = useState(pomodoroSettings.longBreakDuration);

  if (!isPomodoroExpanded) return null;

  const currentDurationSec = (
    pomodoroMode === 'work' 
      ? pomodoroSettings.workDuration 
      : pomodoroMode === 'shortBreak' 
      ? pomodoroSettings.shortBreakDuration 
      : pomodoroSettings.longBreakDuration
  ) * 60;

  const progressPercent = Math.min(100, Math.max(0, ((currentDurationSec - pomodoroTimeLeft) / currentDurationSec) * 100));

  const handleSaveCustomSettings = () => {
    updatePomodoroSettings({
      workDuration: Math.max(1, customWork),
      shortBreakDuration: Math.max(1, customShort),
      longBreakDuration: Math.max(1, customLong),
    });
    setIsCustomizing(false);
  };

  return (
    <div className="fixed bottom-5 right-5 sm:right-8 z-50 animate-fade-in">
      <div className="w-84 sm:w-96 rounded-3xl bg-white border-2 border-[#121417] shadow-solid-lg overflow-hidden text-[#121417]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 border-b border-[#121417]/10 bg-[#F9F8F5] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EBF755] border border-[#121417] text-[#121417] flex items-center justify-center font-bold">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#121417]">
                Focus Engine
              </h3>
              <p className="text-[10px] text-[#121417]/60 font-semibold">Pomodoro Study Sprints</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => updatePomodoroSettings({ soundEnabled: !pomodoroSettings.soundEnabled })}
              className="p-2 rounded-full hover:bg-black/5 text-[#121417] transition-colors"
              title={pomodoroSettings.soundEnabled ? "Sound enabled" : "Sound muted"}
            >
              {pomodoroSettings.soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            </button>
            <button
              onClick={() => setIsCustomizing(!isCustomizing)}
              className={`p-2 rounded-full transition-colors ${
                isCustomizing ? 'bg-[#EBF755] text-black' : 'hover:bg-black/5 text-[#121417]'
              }`}
              title="Customize durations"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsPomodoroExpanded(false)}
              className="p-2 rounded-full hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
              title="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5">
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-3 gap-1 bg-[#F9F8F5] p-1 rounded-2xl border border-[#121417]/10 mb-5">
            <button
              onClick={() => setPomodoroMode('work')}
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
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
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
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
              className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl transition-all ${
                pomodoroMode === 'longBreak'
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm'
                  : 'text-[#121417]/60 hover:text-[#121417]'
              }`}
            >
              <Armchair className="w-3.5 h-3.5" />
              <span>Long</span>
            </button>
          </div>

          {/* Center Timer Display with Circular Progress */}
          <div className="flex flex-col items-center justify-center my-4">
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* SVG Ring */}
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

              {/* Digits in Center */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-mono text-4xl font-extrabold tracking-tight text-[#121417]">
                  {formatTime(pomodoroTimeLeft)}
                </span>
                <span className="text-[10px] font-bold text-[#121417]/60 uppercase tracking-wider mt-1">
                  {pomodoroMode === 'work' ? 'Deep Work' : 'Rest & Recharge'}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-3 mt-4">
            <button
              onClick={resetPomodoro}
              className="p-3 rounded-full bg-[#F9F8F5] hover:bg-slate-200 text-[#121417] border border-[#121417]/20 transition-colors"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={isPomodoroRunning ? pausePomodoro : startPomodoro}
              className={`px-7 py-3 rounded-full font-extrabold text-xs flex items-center gap-2 border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 ${
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
              className="p-3 rounded-full bg-[#F9F8F5] hover:bg-slate-200 text-[#121417] border border-[#121417]/20 transition-colors"
              title="Skip to Next Session"
            >
              <FastForward className="w-4 h-4" />
            </button>
          </div>

          {/* Custom Settings Form Drawer */}
          {isCustomizing && (
            <div className="mt-5 p-4 bg-[#F9F8F5] rounded-2xl border border-[#121417]/15 space-y-3 animate-fade-in">
              <div className="text-xs font-bold text-[#121417]">Custom Durations (minutes)</div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-[#121417]/60 block mb-1">Work</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={customWork}
                    onChange={(e) => setCustomWork(Number(e.target.value))}
                    className="w-full bg-white border border-[#121417]/20 rounded-xl p-2 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
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
                    className="w-full bg-white border border-[#121417]/20 rounded-xl p-2 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
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
                    className="w-full bg-white border border-[#121417]/20 rounded-xl p-2 text-xs text-center font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#EBF755]"
                  />
                </div>
              </div>
              <button
                onClick={handleSaveCustomSettings}
                className="w-full py-2 rounded-full bg-[#121417] hover:bg-black text-[#EBF755] text-xs font-bold transition-all"
              >
                Apply Custom Times
              </button>
            </div>
          )}

          {/* Daily Stats Section */}
          <div className="mt-5 pt-4 border-t border-[#121417]/10 grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-[#F9F8F5] border border-[#121417]/10">
              <div className="flex items-center justify-center text-[#121417] mb-1">
                <Award className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-sm font-extrabold text-[#121417] block">
                {pomodoroStats.sessionsCompleted}
              </span>
              <span className="text-[10px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                Sessions
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#F9F8F5] border border-[#121417]/10">
              <div className="flex items-center justify-center text-emerald-600 mb-1">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <span className="font-mono text-sm font-extrabold text-[#121417] block">
                {pomodoroStats.todayFocusMinutes}m
              </span>
              <span className="text-[10px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                Focused
              </span>
            </div>

            <div 
              className={`p-2.5 rounded-2xl border transition-all ${
                pomodoroStats.todayFocusMinutes >= 10 
                  ? 'bg-[#EBF755]/40 border-[#121417]/20' 
                  : 'bg-[#F9F8F5] border-[#121417]/10'
              }`}
              title={
                pomodoroStats.todayFocusMinutes >= 10
                  ? `Streak locked in for today! (${pomodoroStats.todayFocusMinutes} mins)`
                  : `${pomodoroStats.todayFocusMinutes}/10 mins today to qualify streak`
              }
            >
              <div className="flex items-center justify-center text-orange-500 mb-1">
                <Flame className={`w-3.5 h-3.5 fill-current ${pomodoroStats.todayFocusMinutes >= 10 ? 'text-orange-500' : 'text-slate-400'}`} />
              </div>
              <span className="font-mono text-sm font-extrabold text-[#121417] block">
                {pomodoroStats.streakDays}d
              </span>
              <span className="text-[10px] text-[#121417]/60 font-bold uppercase tracking-wider block">
                {pomodoroStats.todayFocusMinutes >= 10 ? 'Streak 🔥' : `${pomodoroStats.todayFocusMinutes}/10m`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
