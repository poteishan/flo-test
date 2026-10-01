import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { NotesEditor } from './NotesEditor';
import { 
  Folder, Pin, Search, Plus, Trash2, 
  Copy, BookOpen, Layers, FileText, 
  Check, Edit2, X, Sparkles, FolderPlus, ArrowLeft
} from 'lucide-react';
import type { VideoNote, NoteFolder } from '../types';

export const NotesView: React.FC = () => {
  const {
    folders,
    activeFolderId,
    setActiveFolderId,
    createFolder,
    renameFolder,
    deleteFolder,
    notes,
    activeNoteKey,
    setActiveNoteKey,
    createNoteInFolder,
    saveNote,
    deleteNote,
  } = useApp();

  // Navigation selection: 'all' | 'pinned' | folderId
  const [selectedFolderId, setSelectedFolderId] = useState<string>(() => {
    return activeFolderId || 'general';
  });

  // Selected note key to display in right pane editor
  const [selectedNoteKey, setSelectedNoteKey] = useState<string>(() => {
    return activeNoteKey || '';
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editFolderName, setEditFolderName] = useState('');
  const [mobilePane, setMobilePane] = useState<'folders' | 'notes' | 'editor'>('notes');

  // Sync with AppContext active pointers
  useEffect(() => {
    if (activeFolderId && selectedFolderId !== 'all' && selectedFolderId !== 'pinned') {
      setSelectedFolderId(activeFolderId);
    }
  }, [activeFolderId]);

  // Compute all user notes list
  const allNotesList = useMemo(() => {
    return Object.entries(notes)
      .map(([key, note]) => ({ key, note }))
      .sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
  }, [notes]);

  // Notes filtered by folder / navigation tab
  const notesInView = useMemo(() => {
    let list = allNotesList;

    if (selectedFolderId === 'pinned') {
      list = list.filter(item => item.note.isPinned);
    } else if (selectedFolderId !== 'all') {
      list = list.filter(item => {
        const folder = item.note.folderId || item.note.courseId || 'general';
        if (folder === selectedFolderId) return true;
        // If viewing general folder, safely include notes whose folder was removed or not found
        if (selectedFolderId === 'general') {
          const folderExists = folders.some(f => f.id === folder);
          if (!folderExists) return true;
        }
        return false;
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(item => {
        const titleMatch = (item.note.title || '').toLowerCase().includes(q);
        const textContent = (item.note.content || '').replace(/<[^>]+>/g, ' ').toLowerCase();
        return titleMatch || textContent.includes(q);
      });
    }

    return list;
  }, [allNotesList, selectedFolderId, searchQuery, folders]);

  // Auto-select first note if none selected or if selected note doesn't exist
  useEffect(() => {
    if (notesInView.length > 0) {
      const currentExists = notesInView.some(n => n.key === selectedNoteKey);
      if (!currentExists) {
        setSelectedNoteKey(notesInView[0].key);
        setActiveNoteKey(notesInView[0].key);
      }
    } else if (selectedNoteKey && !notes[selectedNoteKey]) {
      setSelectedNoteKey('');
    }
  }, [notesInView, selectedNoteKey, setActiveNoteKey, notes]);

  // Count pinned notes
  const totalPinnedCount = useMemo(() => {
    return allNotesList.filter(item => item.note.isPinned).length;
  }, [allNotesList]);

  // Folder helper to get note count
  const getFolderNoteCount = (folderId: string) => {
    return allNotesList.filter(item => {
      const folder = item.note.folderId || item.note.courseId || 'general';
      if (folder === folderId) return true;
      if (folderId === 'general') {
        const folderExists = folders.some(f => f.id === folder);
        if (!folderExists) return true;
      }
      return false;
    }).length;
  };

  const handleSelectFolder = (folderId: string) => {
    setSelectedFolderId(folderId);
    if (folderId !== 'all' && folderId !== 'pinned') {
      setActiveFolderId(folderId);
    }
    setMobilePane('notes');
  };

  const handleCreateNote = () => {
    const targetFolder = (selectedFolderId === 'all' || selectedFolderId === 'pinned') ? 'general' : selectedFolderId;
    const newKey = createNoteInFolder(targetFolder, 'Untitled Note');
    setSelectedNoteKey(newKey);
    setActiveNoteKey(newKey);
    setMobilePane('editor');
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newId = createFolder(newFolderName.trim());
    setSelectedFolderId(newId);
    setNewFolderName('');
    setIsCreatingFolder(false);
    // Create initial note in the new folder
    const initialNoteKey = createNoteInFolder(newId, 'Untitled Note');
    setSelectedNoteKey(initialNoteKey);
  };

  const handleRenameFolderSubmit = (e: React.FormEvent, folderId: string) => {
    e.preventDefault();
    if (!editFolderName.trim()) return;
    renameFolder(folderId, editFolderName.trim());
    setEditingFolderId(null);
  };

  const handleDeleteFolderClick = (e: React.MouseEvent, folder: NoteFolder) => {
    e.stopPropagation();
    if (folder.id === 'general') {
      alert('The General Notes folder cannot be deleted.');
      return;
    }
    if (window.confirm(`Delete folder "${folder.name}" and all notes inside it?`)) {
      deleteFolder(folder.id);
      setSelectedFolderId('general');
    }
  };

  const handleCopyNote = async (e: React.MouseEvent, key: string, note: VideoNote) => {
    e.stopPropagation();
    try {
      const textOnly = (note.content || '').replace(/<[^>]+>/g, ' ');
      const fullText = `${note.title || 'Untitled'}\n\n${textOnly}`;
      await navigator.clipboard.writeText(fullText);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {}
  };

  const handleDeleteNoteClick = (e: React.MouseEvent, key: string, title: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete note "${title || 'Untitled'}"?`)) {
      deleteNote(key);
      if (selectedNoteKey === key) {
        const remaining = notesInView.filter(n => n.key !== key);
        if (remaining.length > 0) {
          setSelectedNoteKey(remaining[0].key);
          setActiveNoteKey(remaining[0].key);
        } else {
          setSelectedNoteKey('');
        }
      }
    }
  };

  const handleTogglePinClick = (e: React.MouseEvent, key: string, note: VideoNote) => {
    e.stopPropagation();
    saveNote(key, { isPinned: !note.isPinned });
  };

  // Helper to format date
  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Recently';
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  // Plain text preview
  const getExcerpt = (html?: string) => {
    if (!html) return 'Empty note...';
    const stripped = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return stripped.slice(0, 100) || 'Empty note...';
  };

  // Current folder name label for header
  const getFolderTitle = () => {
    if (selectedFolderId === 'all') return 'All Notes';
    if (selectedFolderId === 'pinned') return 'Pinned Notes';
    const f = folders.find(item => item.id === selectedFolderId);
    return f?.name || 'My Notes';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-[#F9F8F5] overflow-hidden p-2 sm:p-4 md:p-6">
      <div className="flex-1 flex min-h-0 bg-white rounded-2xl md:rounded-3xl border-2 border-[#121417] shadow-solid overflow-hidden">
        
        {/* =========================================================================
            PANE 1: LEFT SIDEBAR (Folders & Navigation)
           ========================================================================= */}
        <aside 
          className={`w-full md:w-64 lg:w-72 border-r-2 border-[#121417]/10 flex flex-col min-h-0 bg-[#FCFBF9] ${
            mobilePane === 'folders' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#121417]/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EBF755] border-2 border-[#121417] shadow-solid-xs flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-black" />
              </div>
              <div>
                <h2 className="text-sm font-black text-[#121417] tracking-tight">Notebook</h2>
                <span className="text-[10px] font-mono text-[#121417]/60 font-bold">
                  {allNotesList.length} {allNotesList.length === 1 ? 'note' : 'notes'}
                </span>
              </div>
            </div>

            <button
              onClick={() => setIsCreatingFolder(true)}
              className="p-1.5 rounded-xl bg-white hover:bg-[#EBF755] border-2 border-[#121417] shadow-solid-2xs text-black transition-all hover:scale-105 active:scale-95"
              title="Create new folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Filters */}
          <div className="p-2 border-b border-black/5 flex flex-col gap-1">
            <button
              onClick={() => handleSelectFolder('all')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedFolderId === 'all'
                  ? 'bg-[#121417] text-[#EBF755] shadow-2xs'
                  : 'text-[#121417] hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-3.5 h-3.5" />
                <span>All Notes</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                selectedFolderId === 'all' ? 'bg-[#EBF755] text-black' : 'bg-black/5 text-[#121417]'
              }`}>
                {allNotesList.length}
              </span>
            </button>

            <button
              onClick={() => handleSelectFolder('pinned')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                selectedFolderId === 'pinned'
                  ? 'bg-[#121417] text-[#EBF755] shadow-2xs'
                  : 'text-[#121417] hover:bg-black/5'
              }`}
            >
              <div className="flex items-center gap-2">
                <Pin className="w-3.5 h-3.5" />
                <span>Pinned</span>
              </div>
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                selectedFolderId === 'pinned' ? 'bg-[#EBF755] text-black' : 'bg-black/5 text-[#121417]'
              }`}>
                {totalPinnedCount}
              </span>
            </button>
          </div>

          {/* Folders List Header */}
          <div className="px-4 pt-3 pb-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#121417]/50">
            <span>Folders</span>
            <span>{folders.length}</span>
          </div>

          {/* Inline Create Folder Form */}
          {isCreatingFolder && (
            <div className="px-3 py-2 bg-[#EBF755]/20 border-y border-[#121417]/10 animate-fade-in">
              <form onSubmit={handleCreateFolderSubmit} className="flex flex-col gap-1.5">
                <input
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="Folder name..."
                  autoFocus
                  className="w-full px-2.5 py-1 text-xs bg-white rounded-lg border-2 border-[#121417] outline-none font-bold"
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setIsCreatingFolder(false)}
                    className="px-2 py-0.5 text-xs text-slate-500 hover:text-black font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-2.5 py-0.5 text-xs bg-[#EBF755] border border-[#121417] rounded-lg font-black text-black shadow-2xs hover:bg-[#E2EF43]"
                  >
                    Create
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Folders List */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
            {folders.map(folder => {
              const isSelected = selectedFolderId === folder.id;
              const count = getFolderNoteCount(folder.id);
              const isEditing = editingFolderId === folder.id;

              return (
                <div
                  key={folder.id}
                  onClick={() => !isEditing && handleSelectFolder(folder.id)}
                  className={`group relative flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#EBF755] text-black shadow-solid-xs border-2 border-[#121417]'
                      : 'text-[#121417] hover:bg-black/5'
                  }`}
                >
                  {isEditing ? (
                    <form 
                      onSubmit={(e) => handleRenameFolderSubmit(e, folder.id)} 
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 flex items-center gap-1"
                    >
                      <input
                        type="text"
                        value={editFolderName}
                        onChange={(e) => setEditFolderName(e.target.value)}
                        autoFocus
                        className="flex-1 px-1.5 py-0.5 text-xs bg-white rounded border border-[#121417] outline-none font-bold"
                      />
                      <button type="submit" className="p-1 hover:text-black">
                        <Check className="w-3 h-3 text-emerald-600" />
                      </button>
                      <button 
                        type="button" 
                        onClick={() => setEditingFolderId(null)} 
                        className="p-1 hover:text-black text-slate-400"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </form>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 truncate">
                        <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-black fill-black/20' : 'text-[#121417]/70'}`} />
                        <span className="truncate">{folder.name}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Note Count Badge */}
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                          isSelected ? 'bg-black text-[#EBF755]' : 'bg-black/5 text-[#121417]'
                        }`}>
                          {count}
                        </span>

                        {/* Folder Actions (Rename & Delete) */}
                        <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFolderId(folder.id);
                              setEditFolderName(folder.name);
                            }}
                            className="p-1 hover:bg-black/10 rounded text-[#121417]/70 hover:text-black"
                            title="Rename folder"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>

                          {folder.id !== 'general' && (
                            <button
                              type="button"
                              onClick={(e) => handleDeleteFolderClick(e, folder)}
                              className="p-1 hover:bg-red-100 rounded text-slate-400 hover:text-red-600"
                              title="Delete folder"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom Action */}
          <div className="p-3 border-t border-[#121417]/10 bg-white">
            <button
              onClick={() => setIsCreatingFolder(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-2xs transition-all active:scale-95"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ New Folder</span>
            </button>
          </div>
        </aside>

        {/* =========================================================================
            PANE 2: MIDDLE LIST (Notes in selected folder)
           ========================================================================= */}
        <section 
          className={`w-full md:w-72 lg:w-80 xl:w-96 border-r-2 border-[#121417]/10 flex flex-col min-h-0 bg-white ${
            mobilePane === 'notes' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-[#121417]/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <button
                  onClick={() => setMobilePane('folders')}
                  className="md:hidden p-1.5 rounded-lg hover:bg-black/5 text-[#121417]"
                  title="Back to folders"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="truncate">
                  <h3 className="text-sm font-black text-[#121417] truncate">{getFolderTitle()}</h3>
                  <span className="text-[10px] font-mono font-bold text-[#121417]/50">
                    {notesInView.length} {notesInView.length === 1 ? 'note' : 'notes'}
                  </span>
                </div>
              </div>

              {/* "+ New Note" Button */}
              <button
                onClick={handleCreateNote}
                className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-2xs transition-all active:scale-95 flex-shrink-0"
                title="Create a new note"
              >
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>New Note</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#121417]/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#F9F8F5] border-2 border-[#121417]/20 rounded-xl outline-none focus:border-[#121417] font-medium transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#121417]/40 hover:text-black"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Notes Cards List */}
          <div className="flex-1 overflow-y-auto p-2 sm:p-3 flex flex-col gap-2 bg-[#FAF9F6]/50">
            {notesInView.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#EBF755]/50 border-2 border-[#121417] flex items-center justify-center mb-3 shadow-solid-xs">
                  <FileText className="w-6 h-6 text-[#121417]" />
                </div>
                <h4 className="text-xs font-black text-[#121417] mb-1">No Notes Here</h4>
                <p className="text-[11px] text-[#121417]/60 max-w-[180px] leading-relaxed mb-3">
                  {searchQuery ? 'No notes match your search query.' : 'Create your first note in this folder to get started.'}
                </p>
                <button
                  onClick={handleCreateNote}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-2xs transition-all"
                >
                  <Plus className="w-3 h-3 stroke-[2.5]" />
                  <span>+ Create Note</span>
                </button>
              </div>
            ) : (
              notesInView.map(({ key, note }) => {
                const isSelected = selectedNoteKey === key;
                return (
                  <div
                    key={key}
                    onClick={() => {
                      setSelectedNoteKey(key);
                      setActiveNoteKey(key);
                      setMobilePane('editor');
                    }}
                    className={`group relative p-3 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[#121417] bg-white shadow-solid-xs ring-2 ring-[#EBF755]'
                        : 'border-[#121417]/10 bg-white hover:border-[#121417]/40 hover:shadow-2xs'
                    }`}
                    style={{ borderLeftColor: note.color !== '#ffffff' ? note.color : undefined, borderLeftWidth: note.color !== '#ffffff' ? '6px' : undefined }}
                  >
                    {/* Title & Pin */}
                    <div className="flex items-start justify-between gap-1.5 mb-1">
                      <h4 className={`text-xs font-black line-clamp-1 truncate ${isSelected ? 'text-[#121417]' : 'text-[#121417]/90'}`}>
                        {note.title || 'Untitled Note'}
                      </h4>
                      <button
                        type="button"
                        onClick={(e) => handleTogglePinClick(e, key, note)}
                        className={`p-0.5 rounded transition-transform ${
                          note.isPinned ? 'text-[#121417] scale-110' : 'text-slate-300 hover:text-black opacity-0 group-hover:opacity-100'
                        }`}
                        title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
                      >
                        <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-current' : ''}`} />
                      </button>
                    </div>

                    {/* Excerpt */}
                    <p className="text-[11px] text-[#121417]/60 line-clamp-2 leading-relaxed mb-2 font-normal">
                      {getExcerpt(note.content)}
                    </p>

                    {/* Card Footer */}
                    <div className="flex items-center justify-between text-[10px] text-[#121417]/40 font-mono pt-1 border-t border-black/5">
                      <span>{formatDate(note.updatedAt)}</span>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => handleCopyNote(e, key, note)}
                          className="p-1 hover:text-black text-slate-400"
                          title="Copy note"
                        >
                          {copiedKey === key ? (
                            <Check className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteNoteClick(e, key, note.title)}
                          className="p-1 hover:text-red-600 text-slate-400"
                          title="Delete note"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* =========================================================================
            PANE 3: RIGHT NOTE EDITOR
           ========================================================================= */}
        <main 
          className={`flex-1 flex flex-col min-h-0 bg-white ${
            mobilePane === 'editor' ? 'flex' : 'hidden md:flex'
          }`}
        >
          {selectedNoteKey && notes[selectedNoteKey] ? (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Mobile Back to Notes button */}
              <div className="md:hidden p-2 border-b border-black/5 bg-[#F9F8F5] flex items-center gap-2">
                <button
                  onClick={() => setMobilePane('notes')}
                  className="flex items-center gap-1 text-xs font-bold text-[#121417] px-2 py-1 rounded-lg hover:bg-black/5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Notes</span>
                </button>
              </div>

              <NotesEditor 
                noteKey={selectedNoteKey} 
                fullWidth={true} 
                showFolderSelector={false} 
              />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#FCFBF9]">
              <div className="w-16 h-16 rounded-3xl bg-[#EBF755] border-2 border-[#121417] flex items-center justify-center mb-4 shadow-solid">
                <Sparkles className="w-8 h-8 text-black" />
              </div>
              <h3 className="text-base font-black text-[#121417] mb-1">Your Personal Notebook</h3>
              <p className="text-xs text-[#121417]/60 max-w-sm leading-relaxed mb-4">
                Select an existing note from the list, or create a brand new note to document your learnings, thoughts, and codes.
              </p>
              <button
                onClick={handleCreateNote}
                className="flex items-center gap-1.5 py-2 px-4 rounded-xl text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-xs transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>Create New Note</span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
