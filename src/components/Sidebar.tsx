import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { 
  CheckCircle2, 
  Circle, 
  Play, 
  Search, 
  CheckCheck, 
  Trash2, 
  BookOpen, 
  FolderPlus, 
  Layers, 
  ChevronDown, 
  Clock,
  PanelLeftClose,
  LayoutGrid,
  Tv,
  FileText
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const {
    courses,
    activeCourse,
    activeVideoId,
    setActiveCourseId,
    setActiveVideoId,
    toggleVideoCompletion,
    markCourseCompleted,
    deleteCourse,
    setIsAddModalOpen,
    isSidebarOpen,
    setIsSidebarOpen,
    currentView,
    setCurrentView,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');
  const [isCourseDropdownOpen, setIsCourseDropdownOpen] = useState(false);

  if (!isSidebarOpen) return null;

  if (!activeCourse || courses.length === 0) {
    return (
      <aside className="w-80 sm:w-88 flex-shrink-0 h-[calc(100vh-4rem)] flex flex-col border-r border-[#121417]/10 bg-white">
        {/* View Switcher: All Playlists vs Learning Workspace (Directly Below Logo) */}
        <div className="p-3 border-b border-[#121417]/10 bg-[#F9F8F5]/80 flex items-center justify-between gap-2">
          <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-2xl border border-[#121417]/15 shadow-xs flex-1">
            <button
              onClick={() => setCurrentView('playlists')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                currentView === 'playlists'
                  ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                  : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Playlists</span>
            </button>

            <button
              onClick={() => setCurrentView('workspace')}
              disabled={!activeCourse}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                currentView === 'workspace'
                  ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                  : activeCourse 
                  ? 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
                  : 'opacity-40 cursor-not-allowed text-[#121417]/40'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>Workspace</span>
            </button>

            <button
              onClick={() => setCurrentView('notes')}
              className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
                currentView === 'notes'
                  ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                  : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
              }`}
            >
              <FileText className="w-3 h-3" />
              <span>Notes</span>
            </button>
          </div>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-lg text-[#121417]/50 hover:text-[#121417] hover:bg-black/5 transition-colors"
            title="Hide Playlist Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 flex flex-col p-6 items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#EBF755] border-2 border-[#121417] text-[#121417] flex items-center justify-center mb-4 shadow-solid">
          <FolderPlus className="w-7 h-7" />
        </div>
        <h3 className="text-base font-extrabold text-[#121417] mb-1.5">No Playlists Yet</h3>
        <p className="text-xs text-[#121417]/70 mb-5 max-w-[220px] leading-relaxed font-medium">
          Add any YouTube playlist or video to populate your lecture tracker and start taking notes.
        </p>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-5 py-2.5 rounded-full text-xs font-bold bg-[#D4E4FC] hover:bg-[#C2DBFB] text-[#121417] border border-[#121417]/20 shadow-sm transition-all hover:scale-105 flex items-center gap-1.5"
        >
          <FolderPlus className="w-4 h-4" />
          <span>+ Add Course / Playlist</span>
        </button>
        </div>
      </aside>
    );
  }

  const filteredVideos = activeCourse.videos.filter(video => {
    const matchesSearch = video.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === 'pending') return !video.completed;
    if (filterMode === 'completed') return video.completed;
    return true;
  });

  const totalVideos = activeCourse.videos.length;
  const completedVideos = activeCourse.videos.filter(v => v.completed).length;
  const progressPercent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

  return (
    <aside className="w-full sm:w-[260px] md:w-[260px] lg:w-[260px] xl:w-[280px] 2xl:w-[320px] flex-shrink-0 h-[calc(100vh-4rem)] flex flex-col border-r border-[#121417]/10 bg-white">
      {/* View Switcher on Mobile (Hidden on desktop since Header contains view hub) */}
      <div className="sm:hidden p-3 border-b border-[#121417]/10 bg-[#F9F8F5]/80">
        <div className="grid grid-cols-3 gap-1 p-1 bg-white rounded-2xl border border-[#121417]/15 shadow-xs">
          <button
            onClick={() => setCurrentView('playlists')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
              currentView === 'playlists'
                ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
            }`}
          >
            <LayoutGrid className="w-3 h-3" />
            <span>Playlists</span>
          </button>

          <button
            onClick={() => setCurrentView('workspace')}
            disabled={!activeCourse}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
              currentView === 'workspace'
                ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                : activeCourse 
                ? 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
                : 'opacity-40 cursor-not-allowed text-[#121417]/40'
            }`}
          >
            <Tv className="w-3 h-3" />
            <span>Workspace</span>
          </button>

          <button
            onClick={() => setCurrentView('notes')}
            className={`flex items-center justify-center gap-1 py-1.5 px-2 rounded-xl text-xs font-black transition-all ${
              currentView === 'notes'
                ? 'bg-[#121417] text-[#EBF755] shadow-xs'
                : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
            }`}
          >
            <FileText className="w-3 h-3" />
            <span>Notes</span>
          </button>
        </div>
      </div>

      {/* Course Selector Dropdown */}
      <div className="p-4 border-b border-[#121417]/10 bg-[#F9F8F5]/50">
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-[11px] font-bold uppercase tracking-wider text-[#121417]/60 block">
            Current Playlist
          </label>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1 rounded-lg text-[#121417]/50 hover:text-[#121417] hover:bg-black/5 transition-colors"
            title="Hide Playlist Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
        <div className="relative">
          <button
            onClick={() => setIsCourseDropdownOpen(!isCourseDropdownOpen)}
            className="w-full flex items-center justify-between p-3 rounded-2xl bg-white hover:bg-slate-50 border-2 border-[#121417] shadow-sm transition-all text-left group"
          >
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-xl bg-[#EBF755] border border-[#121417] flex items-center justify-center text-[#121417] flex-shrink-0">
                <BookOpen className="w-4 h-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-extrabold text-[#121417] truncate">
                  {activeCourse.title}
                </p>
                <p className="text-[10px] text-[#121417]/60 font-bold">
                  {completedVideos}/{totalVideos} completed ({progressPercent}%)
                </p>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-[#121417]/70 transition-transform flex-shrink-0 ml-1.5 ${isCourseDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropdown menu */}
          {isCourseDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-white border-2 border-[#121417] rounded-2xl shadow-solid-lg z-50 animate-fade-in max-h-72 overflow-y-auto">
              <div className="px-3 py-1.5 text-[10px] font-bold text-[#121417]/50 uppercase tracking-wider">
                Switch Playlist
              </div>
              {courses.map(course => {
                const isCurrent = course.id === activeCourse.id;
                const doneCount = course.videos.filter(v => v.completed).length;
                return (
                  <div
                    key={course.id}
                    className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                      isCurrent
                        ? 'bg-[#EBF755] text-black font-bold'
                        : 'text-[#121417] hover:bg-slate-100'
                    }`}
                    onClick={() => {
                      setActiveCourseId(course.id);
                      setIsCourseDropdownOpen(false);
                    }}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate font-extrabold">{course.title}</div>
                      <div className="text-[10px] text-[#121417]/60">
                        {doneCount}/{course.videos.length} completed
                      </div>
                    </div>
                    {courses.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Remove "${course.title}"?`)) {
                            deleteCourse(course.id);
                          }
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete course"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}

              <div className="border-t border-slate-200 my-1"></div>
              <button
                onClick={() => {
                  setIsCourseDropdownOpen(false);
                  setIsAddModalOpen(true);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-[#121417] hover:bg-[#EBF755] transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                <span>+ Add / Import New Playlist</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tracklist Controls & Search */}
      <div className="p-3.5 space-y-2.5 border-b border-[#121417]/10">
        {/* Search input */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search lectures..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#F9F8F5] text-[#121417] placeholder-slate-400 text-xs pl-8 pr-3 py-2 rounded-xl border border-[#121417]/15 focus:outline-none focus:ring-2 focus:ring-[#EBF755] transition-colors"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center justify-between gap-1 text-[11px]">
          <div className="flex gap-1 bg-[#F9F8F5] p-1 rounded-full border border-[#121417]/10">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                filterMode === 'all' ? 'bg-[#121417] text-[#EBF755] shadow-sm' : 'text-[#121417]/60 hover:text-[#121417]'
              }`}
            >
              All ({activeCourse.videos.length})
            </button>
            <button
              onClick={() => setFilterMode('pending')}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                filterMode === 'pending' ? 'bg-[#121417] text-[#EBF755] shadow-sm' : 'text-[#121417]/60 hover:text-[#121417]'
              }`}
            >
              Remaining ({totalVideos - completedVideos})
            </button>
            <button
              onClick={() => setFilterMode('completed')}
              className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                filterMode === 'completed' ? 'bg-[#121417] text-[#EBF755] shadow-sm' : 'text-[#121417]/60 hover:text-[#121417]'
              }`}
            >
              Done ({completedVideos})
            </button>
          </div>

          <button
            onClick={() => markCourseCompleted(activeCourse.id, completedVideos !== totalVideos)}
            className="p-1.5 text-slate-500 hover:text-black hover:bg-slate-100 rounded-full transition-colors"
            title={completedVideos === totalVideos ? "Mark all uncompleted" : "Mark all completed"}
          >
            <CheckCheck className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Videos List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {filteredVideos.length === 0 ? (
          <div className="text-center py-10 px-4">
            <p className="text-xs text-slate-400 font-medium">No videos match your filter.</p>
          </div>
        ) : (
          filteredVideos.map((video) => {
            const isActive = video.id === activeVideoId;
            return (
              <div
                key={video.id}
                onClick={() => setActiveVideoId(video.id)}
                className={`group flex items-start gap-2.5 p-3 rounded-2xl cursor-pointer transition-all duration-150 ${
                  isActive
                    ? 'bg-[#EBF755] border-2 border-[#121417] shadow-solid text-black'
                    : 'text-[#121417] hover:bg-slate-50 border border-transparent'
                }`}
              >
                {/* Completion Checkbox */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVideoCompletion(activeCourse.id, video.id);
                  }}
                  className="mt-0.5 text-slate-400 hover:text-black transition-colors flex-shrink-0"
                  title={video.completed ? "Mark as in-progress" : "Mark as completed"}
                >
                  {video.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 fill-emerald-100" />
                  ) : (
                    <Circle className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
                  )}
                </button>

                {/* Video Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {isActive && (
                      <span className="flex-shrink-0 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-black text-[#EBF755]">
                        <Play className="w-2 h-2 fill-current ml-0.2" />
                      </span>
                    )}
                    <h4
                      className={`text-xs font-bold leading-snug line-clamp-2 ${
                        video.completed ? 'text-[#121417]/50 line-through' : ''
                      } ${isActive ? 'text-black' : 'text-[#121417]'}`}
                    >
                      {video.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-[#121417]/60 font-semibold">
                    {video.duration && (
                      <span className="flex items-center gap-1 bg-white/70 px-2 py-0.5 rounded-full border border-[#121417]/10 font-mono">
                        <Clock className="w-2.5 h-2.5" />
                        {video.duration}
                      </span>
                    )}
                    {video.completed && (
                      <span className="text-emerald-700 font-bold">Completed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer Track Summary */}
      <div className="p-3.5 border-t border-[#121417]/10 bg-[#F9F8F5] text-xs flex items-center justify-between text-[#121417]/70 font-bold">
        <span className="flex items-center gap-1.5 text-[11px]">
          <Layers className="w-3.5 h-3.5 text-[#121417]" />
          <span>{totalVideos} Lectures Total</span>
        </span>
        <span className="text-[11px] font-mono text-[#121417] px-2 py-0.5 rounded-full bg-[#EBF755] border border-[#121417]/20">
          {progressPercent}% Done
        </span>
      </div>
    </aside>
  );
};
