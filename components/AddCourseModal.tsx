import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { parseYouTubeInput } from '../utils/youtube';
import type { Course, VideoItem } from '../types';
import { CODER_ARMY_JAVA_57_VIDEOS } from '../data/javaCourseData';
import { PYTHON_MASTERCLASS_9_VIDEOS } from '../data/pythonCourseData';
import {
  X, 
  Video, 
  Plus, 
  ListPlus, 
  AlertCircle
} from 'lucide-react';

export const AddCourseModal: React.FC = () => {
  const { isAddModalOpen, setIsAddModalOpen, addCourse } = useApp();

  const [activeTab, setActiveTab] = useState<'url' | 'manual'>('url');
  const [courseTitle, setCourseTitle] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [videoTitleInput, setVideoTitleInput] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isAddModalOpen) return null;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsed = parseYouTubeInput(urlInput);
    if (parsed.type === 'invalid') {
      setError('Please provide a valid YouTube playlist URL, video URL, or YouTube ID.');
      return;
    }

    if (parsed.type === 'playlist') {
      // 1. Instant 0ms pre-population for known courses
      if (parsed.playlistId === 'PLQEaRBV9gAFsR15tNo2QLF9d2qc-c018p') {
        const newCourse: Course = {
          id: `course-${Date.now()}`,
          title: courseTitle.trim() || 'Coder Army | Complete Java Placement Course',
          playlistId: parsed.playlistId,
          description: 'Complete Java course from scratch with DSA foundations and OOP concepts.',
          videos: CODER_ARMY_JAVA_57_VIDEOS,
        };
        addCourse(newCourse);
        setIsAddModalOpen(false);
        resetForm();
        return;
      }

      if (parsed.playlistId === 'PLGjplNEQ1it8-0CmoljS5yeV-GlKSUEt0') {
        const newCourse: Course = {
          id: `course-${Date.now()}`,
          title: courseTitle.trim() || 'Python Complete Masterclass Course',
          playlistId: parsed.playlistId,
          description: 'Complete Python programming course from basics to advanced applications.',
          videos: PYTHON_MASTERCLASS_9_VIDEOS,
        };
        addCourse(newCourse);
        setIsAddModalOpen(false);
        resetForm();
        return;
      }

      // 2. For any other playlist, instantly create the course with a placeholder video;
      // the workspace player (official IFrame API) fills in the real playlist on open.
      const newCourseId = `course-${Date.now()}`;
      const newCourse: Course = {
        id: newCourseId,
        title: courseTitle.trim() || 'Custom YouTube Playlist Course',
        playlistId: parsed.playlistId,
        description: 'Imported YouTube educational content with timestamped notes.',
        videos: [
          {
            id: `vid-${Date.now()}-0`,
            youtubeId: parsed.videoId || '',
            title: '01. Loading course playlist...',
            duration: '--:--',
            completed: false,
          }
        ],
      };

      addCourse(newCourse);
      setIsAddModalOpen(false);
      resetForm();
      return;
    }

    // Single video
    const singleTitle = courseTitle.trim() || 'Custom Video Lecture';
    const singleVideoId = parsed.videoId || urlInput.trim();
    const newCourse: Course = {
      id: `course-${Date.now()}`,
      title: singleTitle,
      description: 'Imported YouTube educational content with timestamped notes.',
      videos: [
        {
          id: `vid-${Date.now()}-0`,
          youtubeId: singleVideoId,
          title: videoTitleInput.trim() || singleTitle,
          duration: '25:00',
          completed: false,
        }
      ],
    };

    addCourse(newCourse);
    setIsAddModalOpen(false);
    resetForm();
  };

  const handleBulkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lines = bulkUrls.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      setError('Please provide at least one YouTube video link.');
      return;
    }

    if (!courseTitle.trim()) {
      setError('Please enter a title for your custom course.');
      return;
    }

    const videos: VideoItem[] = [];
    lines.forEach((line, index) => {
      let title = `Lecture ${index + 1}`;
      let targetUrl = line;

      if (line.includes('|')) {
        const [t, u] = line.split('|');
        title = t.trim();
        targetUrl = u.trim();
      }

      const parsed = parseYouTubeInput(targetUrl);
      const isValidRawId = /^[a-zA-Z0-9_-]{11}$/.test(targetUrl.trim());
      const vidId = parsed.videoId || (parsed.type === 'playlist' || !isValidRawId ? 'xk4_1vDrzzo' : targetUrl.trim());

      videos.push({
        id: `vid-${Date.now()}-${index}`,
        youtubeId: vidId,
        title: title.startsWith(`${index + 1}.`) ? title : `${String(index + 1).padStart(2, '0')}. ${title}`,
        duration: '20:00',
        completed: false,
      });
    });

    const newCourse: Course = {
      id: `course-bulk-${Date.now()}`,
      title: courseTitle.trim(),
      description: 'Custom learning track with curated lectures.',
      videos,
    };

    addCourse(newCourse);
    setIsAddModalOpen(false);
    resetForm();
  };

  const resetForm = () => {
    setCourseTitle('');
    setUrlInput('');
    setVideoTitleInput('');
    setBulkUrls('');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-xl rounded-3xl bg-white border-2 border-[#121417] shadow-solid-lg overflow-hidden text-[#121417]">
        {/* Header */}
        <div className="p-5 border-b border-[#121417]/10 bg-[#F9F8F5] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#EBF755] border-2 border-[#121417] text-[#121417] flex items-center justify-center font-bold">
              <Video className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#121417]">Add Course / YouTube Playlist</h3>
              <p className="text-xs text-[#121417]/60 font-semibold">Track and take notes on any YouTube educational content</p>
            </div>
          </div>
          <button
            onClick={() => setIsAddModalOpen(false)}
            className="p-2 rounded-full text-slate-500 hover:text-black hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#121417]/10 bg-[#F9F8F5] text-xs font-bold px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('url')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'url' ? 'border-[#121417] text-[#121417] font-extrabold' : 'border-transparent text-[#121417]/50 hover:text-[#121417]'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>Playlist / Video URL</span>
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'manual' ? 'border-[#121417] text-[#121417] font-extrabold' : 'border-transparent text-[#121417]/50 hover:text-[#121417]'
            }`}
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Batch Multi-Video</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 rounded-2xl bg-rose-50 border-2 border-rose-300 text-rose-800 text-xs flex items-center gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === 'url' && (
            <form onSubmit={handleUrlSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-[#121417] block mb-1.5">
                  YouTube Playlist or Video URL <span className="text-rose-500">*</span>
                </label>
                <input
                  id="tour-course-url-input"
                  type="text"
                  required
                  placeholder="https://www.youtube.com/playlist?list=... or https://youtu.be/..."
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full bg-[#F9F8F5] border-2 border-[#121417]/20 rounded-xl px-4 py-2.5 text-xs text-[#121417] font-mono placeholder-slate-400 focus:outline-none focus:border-[#121417] focus:ring-2 focus:ring-[#EBF755]"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[11px] text-[#121417]/60 font-medium">
                    Supports full playlist URLs, watch URLs, or 11-character video IDs.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setUrlInput('https://youtube.com/playlist?list=PLGjplNEQ1it8-0CmoljS5yeV-GlKSUEt0&si=EYUdMtZt0nWziZJ8');
                      if (!courseTitle) setCourseTitle('Complete Python Masterclass');
                    }}
                    className="text-[10px] font-black px-2.5 py-1 rounded-md bg-[#EBF755] hover:bg-[#E2EF43] text-black border border-[#121417]/40 shadow-2xs transition-all hover:scale-102 flex items-center gap-1"
                    title="Insert the highly rated recommended Python playlist"
                  >
                    <span>⚡ Paste Recommended Playlist</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#121417] block mb-1.5">
                  Course Name (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Full-Stack Web Development Bootcamp"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full bg-[#F9F8F5] border-2 border-[#121417]/20 rounded-xl px-4 py-2.5 text-xs text-[#121417] placeholder-slate-400 focus:outline-none focus:border-[#121417] focus:ring-2 focus:ring-[#EBF755]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  id="tour-import-submit-btn"
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#EBF755] hover:bg-[#E2EF43] text-black text-xs font-extrabold border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Import Course</span>
                </button>
              </div>
            </form>
          )}

          {activeTab === 'manual' && (
            <form onSubmit={handleBulkSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-extrabold text-[#121417] block mb-1.5">
                  Course Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Machine Learning & Neural Networks"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full bg-[#F9F8F5] border-2 border-[#121417]/20 rounded-xl px-4 py-2.5 text-xs text-[#121417] placeholder-slate-400 focus:outline-none focus:border-[#121417] focus:ring-2 focus:ring-[#EBF755]"
                />
              </div>

              <div>
                <label className="text-xs font-extrabold text-[#121417] block mb-1.5">
                  Paste Video URLs (One per line)
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder={`Lecture 1: Intro | https://www.youtube.com/watch?v=...
Lecture 2: Setup | https://www.youtube.com/watch?v=...
Lecture 3: Coding | https://www.youtube.com/watch?v=...`}
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  className="w-full bg-[#F9F8F5] border-2 border-[#121417]/20 rounded-xl p-3 text-xs text-[#121417] font-mono placeholder-slate-400 focus:outline-none focus:border-[#121417] focus:ring-2 focus:ring-[#EBF755] resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-5 py-2.5 rounded-full text-xs font-bold text-slate-600 hover:text-black"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#EBF755] hover:bg-[#E2EF43] text-black text-xs font-extrabold border-2 border-[#121417] shadow-solid transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Custom Track</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
