import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  FolderPlus, 
  Play, 
  Trash2, 
  CheckCircle2, 
  Sparkles, 
  BookOpen, 
  Flame,
  ChevronRight
} from 'lucide-react';
import { AdBanner } from './AdBanner';

export const PlaylistsView: React.FC = () => {
  const {
    courses,
    setActiveCourseId,
    setActiveVideoId,
    deleteCourse,
    setIsAddModalOpen,
    setCurrentView,
    pomodoroStats,
  } = useApp();

  const handleResumeCourse = (courseId: string) => {
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    setActiveCourseId(course.id);
    // Resume at next uncompleted video or first video
    const uncompleted = course.videos.find(v => !v.completed);
    if (uncompleted) {
      setActiveVideoId(uncompleted.id);
    } else if (course.videos[0]) {
      setActiveVideoId(course.videos[0].id);
    }
    setCurrentView('workspace');
  };

  const handleDeleteCourse = (courseId: string, courseTitle: string) => {
    if (window.confirm(`Are you sure you want to delete "${courseTitle}" from your library?`)) {
      deleteCourse(courseId);
    }
  };

  // Aggregated Stats
  const totalCourses = courses.length;
  const totalVideos = courses.reduce((acc, c) => acc + c.videos.length, 0);
  const totalCompletedVideos = courses.reduce(
    (acc, c) => acc + c.videos.filter(v => v.completed).length, 
    0
  );
  const overallProgress = totalVideos > 0 ? Math.round((totalCompletedVideos / totalVideos) * 100) : 0;

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-[#F9F8F5] overflow-y-auto">
      <div className="max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Top Header & Metrics Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-6 border-b-2 border-[#121417]/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-[#EBF755] text-black border border-[#121417]/20 shadow-xs">
                My Learning Library
              </span>
              <span className="text-xs font-bold text-[#121417]/60">
                {totalCourses} {totalCourses === 1 ? 'Playlist' : 'Playlists'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#121417] tracking-tight">
              All Courses & Playlists
            </h1>
            <p className="text-xs sm:text-sm text-[#121417]/70 font-medium mt-1">
              Select a course to resume learning with timestamped notes and focus streaks.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            {/* Quick Metrics Badges */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl border-2 border-[#121417] shadow-solid text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>{totalCompletedVideos} / {totalVideos} Lessons ({overallProgress}%)</span>
            </div>

            <div 
              className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border-2 border-[#121417] shadow-solid text-xs font-bold transition-all ${
                pomodoroStats.todayFocusMinutes >= 10 ? 'bg-[#EBF755]' : 'bg-white'
              }`}
              title={
                pomodoroStats.todayFocusMinutes >= 10
                  ? `🔥 Streak Active! ${pomodoroStats.streakDays}d streak (${pomodoroStats.todayFocusMinutes} mins logged today)`
                  : `⚡ ${pomodoroStats.todayFocusMinutes}/10 mins today to unlock your daily streak.`
              }
            >
              <Flame className={`w-4 h-4 fill-current ${pomodoroStats.todayFocusMinutes >= 10 ? 'text-orange-500' : 'text-slate-400'}`} />
              <span>{pomodoroStats.streakDays}d Streak</span>
              {pomodoroStats.todayFocusMinutes < 10 && (
                <span className="text-[10px] text-[#121417]/60 font-extrabold">({pomodoroStats.todayFocusMinutes}/10m)</span>
              )}
            </div>

            {/* Add New Playlist Button */}
            <button
              id="tour-add-playlist-btn"
              onClick={() => setIsAddModalOpen(true)}
              className="px-5 py-2.5 rounded-full text-xs font-extrabold text-[#121417] bg-[#D4E4FC] hover:bg-[#C2DBFB] border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ Add New Playlist</span>
            </button>
          </div>
        </div>

        {/* Top Google AdSense Banner Slot */}
        <AdBanner slotId="playlists-top-banner" format="horizontal" />

        {/* Playlists Grid or Empty State */}
        {courses.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="max-w-md p-8 sm:p-10 rounded-3xl bg-white border-2 border-[#121417] shadow-solid-lg flex flex-col items-center">
              <div className="w-16 h-16 rounded-2xl bg-[#EBF755] border-2 border-[#121417] text-[#121417] flex items-center justify-center mb-5 shadow-solid">
                <BookOpen className="w-8 h-8" />
              </div>

              <h2 className="text-xl font-extrabold text-[#121417] mb-2 tracking-tight">
                No Playlists in Library Yet
              </h2>

              <p className="text-xs text-[#121417]/70 mb-6 leading-relaxed font-medium">
                Add any YouTube playlist or video link to track your progress, take timestamped notes, and build your study streak.
              </p>

              <button
                id="tour-add-playlist-btn-empty"
                onClick={() => setIsAddModalOpen(true)}
                className="px-6 py-3 rounded-full text-xs font-extrabold text-[#121417] bg-[#D4E4FC] hover:bg-[#C2DBFB] border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ Import Your First YouTube Playlist</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
            {courses.map((course, index) => {
              const total = course.videos.length;
              const completed = course.videos.filter(v => v.completed).length;
              const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
              const isFinished = total > 0 && completed === total;

              return (
                <div
                  key={course.id}
                  className="rounded-3xl bg-white border-2 border-[#121417] p-5 sm:p-6 shadow-solid hover:shadow-solid-lg transition-all flex flex-col justify-between group"
                >
                  <div>
                    {/* Badge & Playlist Indicator */}
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="px-3 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-extrabold bg-[#F9F8F5] border border-[#121417]/20 text-[#121417]">
                        {course.playlistId ? 'YouTube Playlist' : 'Single Video'}
                      </span>

                      {isFinished ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                          <Sparkles className="w-3 h-3" /> 100% Done
                        </span>
                      ) : (
                        <span className="text-xs font-mono font-bold text-[#121417]/70">
                          {percent}% Completed
                        </span>
                      )}
                    </div>

                    {/* Course Title */}
                    <h2 className="text-base sm:text-lg font-black text-[#121417] tracking-tight leading-snug line-clamp-2 mb-2 group-hover:text-black">
                      {course.title}
                    </h2>

                    {course.description && (
                      <p className="text-xs text-[#121417]/60 line-clamp-2 font-medium mb-4">
                        {course.description}
                      </p>
                    )}

                    {/* Progress Bar */}
                    <div className="mt-3 mb-5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-[#121417]/70 mb-1.5">
                        <span>Course Progress</span>
                        <span>{completed} of {total} lessons</span>
                      </div>
                      <div className="h-2.5 w-full bg-[#121417]/10 rounded-full overflow-hidden p-0.5 border border-[#121417]/20">
                        <div 
                          className="h-full bg-[#EBF755] rounded-full transition-all duration-500 border border-[#121417]/30"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-[#121417]/10 flex items-center justify-between gap-3">
                    {/* Delete Course Button */}
                    <button
                      onClick={() => handleDeleteCourse(course.id, course.title)}
                      className="p-2.5 rounded-full text-[#121417]/40 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                      title="Delete Course from Library"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    {/* Resume / Continue Button */}
                    <button
                      id={index === 0 ? "tour-start-learning-btn" : undefined}
                      onClick={() => handleResumeCourse(course.id)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full text-xs font-bold text-[#121417] bg-[#EBF755] hover:bg-[#E2EF43] border-2 border-[#121417] shadow-solid transition-all hover:scale-102 active:scale-98"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{completed > 0 ? 'Resume Course' : 'Start Learning'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
