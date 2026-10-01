import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { NotesEditor } from './NotesEditor';
import {
  Play,
  CheckCircle2,
  Circle,
  Search,
  CheckCheck,
  FileText,
  ListVideo
} from 'lucide-react';

interface WorkspaceRightPanelProps {
  embedded?: boolean;
  className?: string;
  isMobileDrawer?: boolean;
}

export const WorkspaceRightPanel: React.FC<WorkspaceRightPanelProps> = ({ 
  embedded = false, 
  className = '',
  isMobileDrawer = false,
}) => {
  const {
    activeCourse,
    activeVideoId,
    setActiveVideoId,
    toggleVideoCompletion,
    markCourseCompleted,
    workspaceRightTab,
    setWorkspaceRightTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'pending' | 'completed'>('all');

  if (!activeCourse) return null;

  const totalVideos = activeCourse.videos.length;
  const completedVideos = activeCourse.videos.filter(v => v.completed).length;

  const filteredVideos = activeCourse.videos.filter(v => {
    const matchesSearch = v.title.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;
    if (filterMode === 'pending') return !v.completed;
    if (filterMode === 'completed') return v.completed;
    return true;
  });

  return (
    <aside id="tour-right-panel" className={`w-full ${embedded ? 'h-[620px] sm:h-[700px]' : 'h-full'} flex flex-col min-h-0 bg-white rounded-2xl 2xl:rounded-3xl border-2 border-[#121417] shadow-solid overflow-hidden ${className}`}>
      {/* 1. YouTube-Style Segmented Tab Switcher: [ Playlist (Queue) ] | [ Notes ] */}
      <div className="px-3 py-2.5 border-b border-[#121417]/10 bg-[#F9F8F5]/80 flex items-center justify-between gap-2 flex-shrink-0">
        <div className="flex items-center gap-1.5 p-1 bg-white rounded-2xl border-2 border-[#121417] shadow-solid-xs flex-1">
          <button
            id={isMobileDrawer ? undefined : "tour-queue-tab"}
            data-tour="tour-queue-tab"
            onClick={() => setWorkspaceRightTab('playlist')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
              workspaceRightTab === 'playlist'
                ? 'bg-[#121417] text-[#EBF755] border border-black shadow-2xs'
                : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
            }`}
          >
            <ListVideo className="w-3.5 h-3.5" />
            <span>Playlist</span>
            <span className={`text-[10px] font-mono font-black px-1.5 py-0.2 rounded-full border ${
              workspaceRightTab === 'playlist' 
                ? 'bg-[#EBF755] text-black border-black shadow-2xs' 
                : 'bg-[#121417]/10 text-[#121417] border-transparent'
            }`}>
              {totalVideos}
            </span>
          </button>

          <button
            id={isMobileDrawer ? undefined : "tour-notes-tab"}
            onClick={() => setWorkspaceRightTab('notes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-black transition-all ${
              workspaceRightTab === 'notes'
                ? 'bg-[#121417] text-[#EBF755] border border-black shadow-2xs'
                : 'text-[#121417]/70 hover:text-[#121417] hover:bg-black/5'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Notes</span>
          </button>
        </div>
      </div>

      {/* 3. Tab Body: Playlist vs Notes */}
      {workspaceRightTab === 'notes' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <NotesEditor isMobileDrawer={isMobileDrawer} />
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Course Progress Header */}
          <div className="p-3 border-b border-[#121417]/10 bg-white flex-shrink-0">
            {/* Course Progress Mini Bar */}
            <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-[#121417]/70">
              <span>{completedVideos} of {totalVideos} completed</span>
              <span>{Math.round((completedVideos / (totalVideos || 1)) * 100)}%</span>
            </div>
            <div className="w-full h-1.5 bg-[#121417]/10 rounded-full overflow-hidden mt-1">
              <div 
                className="h-full bg-[#EBF755] border-r border-[#121417]/30 transition-all duration-300"
                style={{ width: `${Math.round((completedVideos / (totalVideos || 1)) * 100)}%` }}
              />
            </div>
          </div>

          {/* Search and YouTube-Style Filter Pills */}
          <div className="p-3 border-b border-[#121417]/10 bg-white space-y-2 flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search lectures..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#F9F8F5] text-[#121417] placeholder-slate-400 text-xs pl-8 pr-3 py-1.5 rounded-xl border border-[#121417]/15 focus:outline-none focus:ring-2 focus:ring-[#EBF755] transition-colors"
              />
            </div>

            <div className="flex items-center justify-between gap-1 text-[11px]">
              <div className="flex gap-1.5 bg-[#F9F8F5] p-1 rounded-full border border-[#121417]/10 overflow-x-auto">
                <button
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 rounded-full font-black transition-all whitespace-nowrap ${
                    filterMode === 'all' 
                      ? 'bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs' 
                      : 'bg-white text-[#121417]/70 hover:text-[#121417] border border-[#121417]/15'
                  }`}
                >
                  All ({totalVideos})
                </button>
                <button
                  onClick={() => setFilterMode('pending')}
                  className={`px-3 py-1 rounded-full font-black transition-all whitespace-nowrap ${
                    filterMode === 'pending' 
                      ? 'bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs' 
                      : 'bg-white text-[#121417]/70 hover:text-[#121417] border border-[#121417]/15'
                  }`}
                >
                  Remaining ({totalVideos - completedVideos})
                </button>
                <button
                  onClick={() => setFilterMode('completed')}
                  className={`px-3 py-1 rounded-full font-black transition-all whitespace-nowrap ${
                    filterMode === 'completed' 
                      ? 'bg-[#121417] text-[#EBF755] border-2 border-[#121417] shadow-solid-xs' 
                      : 'bg-white text-[#121417]/70 hover:text-[#121417] border border-[#121417]/15'
                  }`}
                >
                  Done ({completedVideos})
                </button>
              </div>

              <button
                onClick={() => markCourseCompleted(activeCourse.id, completedVideos !== totalVideos)}
                className="p-1 text-slate-500 hover:text-black hover:bg-slate-100 rounded-full transition-colors flex-shrink-0"
                title={completedVideos === totalVideos ? "Mark all uncompleted" : "Mark all completed"}
              >
                <CheckCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* YouTube Video Queue Items List */}
          <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
            {filteredVideos.length === 0 ? (
              <div className="text-center py-10 px-4">
                <p className="text-xs text-slate-400 font-medium">No videos match your filter.</p>
              </div>
            ) : (
              filteredVideos.map((video) => {
                const isActive = video.id === activeVideoId;
                const originalIndex = activeCourse.videos.findIndex(v => v.id === video.id);

                return (
                  <div
                    key={video.id}
                    onClick={() => setActiveVideoId(video.id)}
                    className={`group flex items-start gap-3 p-2.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-[#EBF755] border-2 border-[#121417] shadow-solid text-black'
                        : 'hover:bg-[#F9F8F5] border-2 border-transparent hover:border-[#121417]/20'
                    }`}
                  >
                    {/* YouTube 16:9 Thumbnail on Left with Duration Badge */}
                    <div className={`relative w-28 sm:w-32 xl:w-36 aspect-video rounded-xl overflow-hidden bg-slate-900 flex-shrink-0 border-2 ${
                      isActive ? 'border-[#121417] shadow-2xs' : 'border-[#121417]/15'
                    }`}>
                      {video.youtubeId ? (
                        <img 
                          src={`https://i.ytimg.com/vi/${video.youtubeId}/mqdefault.jpg`} 
                          alt={video.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-800 text-white/40">
                          <Play className="w-5 h-5" />
                        </div>
                      )}

                      {/* YouTube-authentic duration pill bottom right */}
                      {video.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/85 text-white font-mono font-bold text-[9px] px-1.5 py-0.2 rounded tracking-tight">
                          {video.duration}
                        </span>
                      )}

                      {/* Active playing overlay */}
                      {isActive && (
                        <div className="absolute inset-0 bg-black/40 backdrop-blur-[0.5px] flex items-center justify-center">
                          <div className="w-6 h-6 rounded-full bg-[#EBF755] border border-black flex items-center justify-center shadow-xs">
                            <Play className="w-3 h-3 fill-black text-black ml-0.2" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Video Info on Right */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between self-stretch py-0.5">
                      <h4 className={`text-xs xl:text-[13px] font-bold leading-snug line-clamp-2 ${
                        video.completed 
                          ? 'text-[#121417]/50 line-through' 
                          : isActive 
                          ? 'text-black font-black' 
                          : 'text-[#121417]'
                      }`}>
                        {video.title}
                      </h4>

                      <div className="flex items-center justify-between gap-1 mt-1 text-[10px]">
                        <span className={`font-semibold truncate ${isActive ? 'text-black/90 font-black' : 'text-[#121417]/60'}`}>
                          Lecture {originalIndex + 1}
                        </span>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleVideoCompletion(activeCourse.id, video.id);
                          }}
                          className={`hover:scale-110 transition-transform p-0.5 ${isActive ? 'text-black hover:text-black' : 'text-slate-400 hover:text-black'}`}
                          title={video.completed ? "Mark as in-progress" : "Mark as completed"}
                        >
                          {video.completed ? (
                            <CheckCircle2 className={`w-3.5 h-3.5 ${isActive ? 'text-black fill-black/20' : 'text-emerald-600 fill-emerald-100'}`} />
                          ) : (
                            <Circle className={`w-3.5 h-3.5 ${isActive ? 'text-black/60 group-hover:text-black' : 'text-slate-400 group-hover:text-slate-600'}`} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
