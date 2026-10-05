import React, { useCallback, useEffect, useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { formatTime } from '../utils/youtube';
import type { VideoNote } from '../types';
import { 
  Bold, Italic, Strikethrough, List, ListTodo, 
  Pin, Palette, Clock, Check, Copy, ChevronDown,
  Type, X, Plus, Folder, FileText, Trash2, FolderPlus
} from 'lucide-react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Node, mergeAttributes } from '@tiptap/core';

// Custom Extension for Interactive Timestamps
const TimestampNode = Node.create({
  name: 'timestamp',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,
  addAttributes() {
    return {
      'data-sec': { default: null },
      text: { default: '' },
    };
  },
  parseHTML() {
    return [{ tag: 'button.timestamp-pill' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      'button',
      mergeAttributes(HTMLAttributes, {
        class: 'timestamp-pill inline-flex items-center gap-1 font-mono font-black text-[11px] px-2 py-0.5 rounded-full bg-[#EBF755] text-black border border-[#121417]/30 shadow-xs cursor-pointer hover:bg-[#E2EF43] mx-1 transition-transform active:scale-95 select-none',
        contenteditable: 'false',
        type: 'button',
      }),
      HTMLAttributes.text,
    ];
  },
});

export const PRESET_NOTE_COLORS = [
  { name: 'Default', hex: '#ffffff' },
  { name: 'Coral', hex: '#f28b82' },
  { name: 'Peach', hex: '#fbbc04' },
  { name: 'Sand', hex: '#fff475' },
  { name: 'Mint', hex: '#ccff90' },
  { name: 'Teal', hex: '#a7ffeb' },
  { name: 'Sky', hex: '#cbf0f8' },
  { name: 'Periwinkle', hex: '#aecbfa' },
  { name: 'Lavender', hex: '#d7aefb' },
  { name: 'Blush', hex: '#fdcfe8' },
];

export interface NotesEditorProps {
  noteKey?: string;
  onClose?: () => void;
  fullWidth?: boolean;
  showFolderSelector?: boolean;
  isMobileDrawer?: boolean;
}

export const NotesEditor: React.FC<NotesEditorProps> = ({ 
  noteKey, 
  onClose,
  fullWidth = false,
  showFolderSelector = true,
  isMobileDrawer = false,
}) => {
  const {
    folders,
    activeFolderId,
    setActiveFolderId,
    createFolder,
    activeNoteKey,
    setActiveNoteKey,
    createNoteInFolder,
    notes,
    saveNote,
    deleteNote,
    isNoteSaving,
    lastSavedTime,
    getCurrentPlayerTime,
    seekTo,
    isNotesOpen,
  } = useApp();

  const [copied, setCopied] = useState(false);
  const [isSizeDropdownOpen, setIsSizeDropdownOpen] = useState(false);
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);
  const [isFolderDropdownOpen, setIsFolderDropdownOpen] = useState(false);
  const [isNoteDropdownOpen, setIsNoteDropdownOpen] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Determine mode and target note
  const isDirectKeyMode = Boolean(noteKey);
  const targetKey = isDirectKeyMode ? noteKey! : activeNoteKey;

  // Active folder object
  const currentFolder = useMemo(() => {
    return folders.find(f => f.id === activeFolderId) || folders[0] || { id: 'general', name: 'General Notes', createdAt: 0 };
  }, [folders, activeFolderId]);

  // Notes in the active folder
  const notesInCurrentFolder = useMemo(() => {
    return Object.entries(notes)
      .filter(([_, n]) => (n.folderId === activeFolderId || n.courseId === activeFolderId || (!n.folderId && !n.courseId && activeFolderId === 'general')))
      .map(([key, note]) => ({ key, note }))
      .sort((a, b) => (b.note.updatedAt || 0) - (a.note.updatedAt || 0));
  }, [notes, activeFolderId]);

  // Current note data
  const note: VideoNote = useMemo(() => {
    return notes[targetKey] ?? {
      videoId: 'default',
      courseId: activeFolderId || 'general',
      folderId: activeFolderId || 'general',
      title: 'Quick Note',
      content: '',
      color: '#ffffff',
      isPinned: false,
      updatedAt: Date.now(),
    };
  }, [notes, targetKey, activeFolderId]);

  const handleUpdate = useCallback((updates: Partial<VideoNote>) => {
    saveNote(targetKey, {
      ...updates,
      folderId: note.folderId || activeFolderId || 'general',
      courseId: note.courseId || activeFolderId || 'general',
    });
  }, [targetKey, note.folderId, note.courseId, activeFolderId, saveNote]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      TimestampNode,
    ],
    content: note.content || '',
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[160px] text-xs sm:text-sm text-[#121417] leading-relaxed',
      },
      handleClick(_view, _pos, event) {
        const target = event.target as HTMLElement;
        const pill = target.closest('.timestamp-pill');
        if (pill) {
          event.preventDefault();
          const sec = parseInt(pill.getAttribute('data-sec') || '0', 10);
          if (!isNaN(sec)) {
            seekTo(sec);
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      handleUpdate({ content: editor.getHTML() });
    },
  });

  // Re-sync editor content when switching active note or if updated externally
  useEffect(() => {
    if (editor && editor.getHTML() !== note.content) {
      const currentPos = editor.state.selection.$anchor.pos;
      editor.commands.setContent(note.content || '', { emitUpdate: false });
      if (currentPos <= editor.state.doc.content.size) {
        editor.commands.setTextSelection(currentPos);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, note.content]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleUpdate({ title: e.target.value });
  };

  const togglePin = () => {
    handleUpdate({ isPinned: !note.isPinned });
  };

  const changeColor = (color: string) => {
    handleUpdate({ color });
    setIsPaletteOpen(false);
  };

  const handleInsertTimestamp = useCallback(() => {
    if (!editor) return;
    const sec = getCurrentPlayerTime();
    const formatted = formatTime(sec);
    editor.chain().focus().insertContent({
      type: 'timestamp',
      attrs: { 'data-sec': sec, text: `▶ [${formatted}]` }
    }).insertContent(' ').run();
  }, [editor, getCurrentPlayerTime]);

  // Keyboard shortcut: Alt + T to insert timestamp anywhere while typing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        handleInsertTimestamp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleInsertTimestamp]);

  const copyNotes = async () => {
    if (!editor) return;
    try {
      await navigator.clipboard.writeText(editor.getText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const newId = createFolder(newFolderName.trim());
    createNoteInFolder(newId, 'New Note');
    setNewFolderName('');
    setIsCreatingFolder(false);
    setIsFolderDropdownOpen(false);
  };

  const handleDeleteCurrentNote = () => {
    if (window.confirm(`Delete note "${note.title || 'Untitled'}"?`)) {
      deleteNote(targetKey);
      // Auto switch to another note in folder if available
      const remaining = notesInCurrentFolder.filter(n => n.key !== targetKey);
      if (remaining.length > 0) {
        setActiveNoteKey(remaining[0].key);
      } else {
        createNoteInFolder(activeFolderId, 'Quick Note');
      }
    }
  };

  // If in workspace drawer mode and notes are toggled off
  if (!isDirectKeyMode && !isNotesOpen) return null;

  // Active text size label
  const getCurrentTextSizeLabel = () => {
    if (!editor) return 'Normal Text';
    if (editor.isActive('heading', { level: 1 })) return 'Large (H1)';
    if (editor.isActive('heading', { level: 2 })) return 'Medium (H2)';
    if (editor.isActive('heading', { level: 3 })) return 'Small (H3)';
    return 'Normal Text';
  };

  return (
    <div 
      className={`note-editor ${
        (note.color || '#ffffff').toLowerCase() === '#ffffff' ? 'note-editor--default' : 'note-editor--tinted'
      } flex-1 flex flex-col min-h-0 transition-colors duration-200 ${
        fullWidth ? 'w-full' : 'border-l border-[#121417]/10'
      }`}
      style={{ backgroundColor: note.color || '#ffffff' }}
    >
      {/* 1. Workspace Folder & Note Pickers Header (When rendered in workspace or standalone) */}
      {!isDirectKeyMode && showFolderSelector && (
        <div className="px-3 py-2 bg-[#F9F8F5] border-b-2 border-[#121417]/10 flex flex-col gap-2">
          {/* Row 1: Folder Selector + "+ New Note" Button */}
          <div className="flex items-center justify-between gap-2">
            {/* Folder Dropdown */}
            <div className="relative flex-1">
              <button
                type="button"
                onClick={() => {
                  setIsFolderDropdownOpen(!isFolderDropdownOpen);
                  setIsNoteDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-white rounded-xl border-2 border-[#121417] shadow-solid-2xs text-xs font-black text-[#121417] hover:bg-[#EBF755]/20 transition-all text-left"
                title="Select folder"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Folder className="w-3.5 h-3.5 text-[#121417] flex-shrink-0" />
                  <span className="truncate">{currentFolder.name}</span>
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-[#121417]/60 transition-transform ${isFolderDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Folder Selector Dropdown Menu */}
              {isFolderDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-56 bg-white border-2 border-[#121417] rounded-xl shadow-solid-lg z-40 py-1 max-h-56 overflow-y-auto animate-fade-in">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#121417]/50 border-b border-black/5">
                    SELECT FOLDER
                  </div>
                  {folders.map(f => {
                    const count = Object.values(notes).filter(n => n.folderId === f.id || n.courseId === f.id).length;
                    const isSelected = f.id === activeFolderId;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => {
                          setActiveFolderId(f.id);
                          setIsFolderDropdownOpen(false);
                        }}
                        className={`w-full px-2.5 py-1.5 text-left text-xs font-bold transition-colors flex items-center justify-between ${
                          isSelected ? 'bg-[#EBF755] text-black font-black' : 'hover:bg-black/5 text-[#121417]'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <Folder className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </div>
                        <span className="text-[10px] opacity-60 font-mono">({count})</span>
                      </button>
                    );
                  })}

                  {/* Create New Folder Inline or Trigger */}
                  <div className="p-1.5 border-t border-black/10 mt-1">
                    {isCreatingFolder ? (
                      <form onSubmit={handleCreateFolderSubmit} className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder name..."
                          autoFocus
                          className="flex-1 px-2 py-1 text-xs border border-[#121417] rounded-lg outline-none font-bold"
                        />
                        <button
                          type="submit"
                          className="p-1 rounded-lg bg-[#EBF755] border border-[#121417] text-black font-black text-xs"
                          title="Save Folder"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsCreatingFolder(false)}
                          className="p-1 rounded-lg hover:bg-black/5 text-slate-500"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setIsCreatingFolder(true)}
                        className="w-full flex items-center justify-center gap-1 py-1 px-2 rounded-lg text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border border-[#121417]/30 transition-colors"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>+ New Folder</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* "+ New Note" Action Button */}
            <button
              type="button"
              onClick={() => {
                createNoteInFolder(activeFolderId, 'New Note');
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border-2 border-[#121417] shadow-solid-2xs transition-all active:scale-95 flex-shrink-0"
              title="Create a new note in current folder"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Note</span>
            </button>
          </div>

          {/* Row 2: Note File Selector (Dropdown if multiple notes in folder) */}
          {notesInCurrentFolder.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsNoteDropdownOpen(!isNoteDropdownOpen);
                  setIsFolderDropdownOpen(false);
                }}
                className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1 bg-white/80 rounded-lg border border-black/10 hover:bg-white text-xs text-[#121417] transition-all text-left"
              >
                <div className="flex items-center gap-1.5 truncate">
                  <FileText className="w-3 h-3 text-[#121417]/60 flex-shrink-0" />
                  <span className="font-bold truncate text-[#121417]">
                    {note.title || 'Untitled Note'}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[10px] text-[#121417]/50 font-mono">
                    {notesInCurrentFolder.length} {notesInCurrentFolder.length === 1 ? 'file' : 'files'}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-[#121417]/50 transition-transform ${isNoteDropdownOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Notes in folder dropdown */}
              {isNoteDropdownOpen && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121417] rounded-xl shadow-solid-lg z-30 py-1 max-h-48 overflow-y-auto animate-fade-in">
                  <div className="px-2.5 py-1 text-[10px] font-black uppercase text-[#121417]/40 border-b border-black/5">
                    Notes in {currentFolder.name}
                  </div>
                  {notesInCurrentFolder.map(item => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        setActiveNoteKey(item.key);
                        setIsNoteDropdownOpen(false);
                      }}
                      className={`w-full px-2.5 py-1.5 text-left text-xs transition-colors flex items-center justify-between ${
                        item.key === targetKey
                          ? 'bg-[#EBF755] font-black text-black'
                          : 'hover:bg-black/5 text-[#121417]'
                      }`}
                    >
                      <span className="truncate">{item.note.title || 'Untitled Note'}</span>
                      {item.note.isPinned && <Pin className="w-2.5 h-2.5 fill-current ml-1 flex-shrink-0" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. Top Bar: Note Title, Pin, Delete, Close */}
      <div className="p-3 sm:p-4 pb-2 flex flex-col gap-1 border-b border-black/5">
        <div className="flex items-center justify-between gap-3">
          <input 
            type="text" 
            value={note.title} 
            onChange={handleTitleChange} 
            placeholder="Note Title..."
            className="flex-1 font-black text-sm sm:text-base bg-transparent border-none outline-none placeholder-[#121417]/40 text-[#121417]"
          />
          <div className="flex items-center gap-1.5">
            {/* Pin note button */}
            <button 
              onClick={togglePin}
              className={`p-1.5 rounded-full transition-all ${
                note.isPinned 
                  ? 'bg-[#121417] text-[#EBF755] shadow-xs scale-105' 
                  : 'text-[#121417]/50 hover:bg-black/5 hover:text-[#121417]'
              }`}
              title={note.isPinned ? 'Unpin Note' : 'Pin Note'}
            >
              <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
            </button>

            {/* Delete note button */}
            {!isDirectKeyMode && (
              <button
                onClick={handleDeleteCurrentNote}
                className="p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Delete note"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-full text-[#121417]/50 hover:bg-black/10 hover:text-[#121417] transition-colors"
                title="Close Note"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Formatting Toolbar */}
      <div className="px-3 sm:px-4 py-1.5 flex items-center justify-between gap-1.5 flex-wrap border-b border-black/5 bg-black/[0.02]">
        <div className="flex items-center gap-1 flex-wrap">
          {/* Interactive Video Timestamp Button */}
          <button
            id={isMobileDrawer ? undefined : "tour-note-timestamp-btn"}
            data-tour="tour-note-timestamp-btn"
            onClick={handleInsertTimestamp}
            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-[#EBF755] hover:bg-[#E2EF43] text-black border border-[#121417]/20 shadow-xs transition-transform active:scale-95"
            title="Insert current video timestamp (Alt + T)"
          >
            <Clock className="w-3 h-3" />
            <span>Time</span>
          </button>
          
          <div className="w-[1px] h-3.5 bg-[#121417]/15 mx-0.5" />

          {editor && (
            <>
              {/* Text Size Selector Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSizeDropdownOpen(!isSizeDropdownOpen)}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-[#121417]/80 hover:bg-black/10 transition-colors border border-black/10 bg-white/70 shadow-2xs"
                  title="Text Size"
                >
                  <Type className="w-3 h-3 text-[#121417]/70" />
                  <span>{getCurrentTextSizeLabel()}</span>
                  <ChevronDown className="w-3 h-3 text-[#121417]/50" />
                </button>

                {isSizeDropdownOpen && (
                  <div className="absolute left-0 top-full mt-1 bg-white border-2 border-[#121417] rounded-xl shadow-solid py-1 z-30 min-w-[130px] animate-fade-in">
                    <button
                      onClick={() => {
                        editor.chain().focus().setParagraph().run();
                        setIsSizeDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-[#EBF755] transition-colors ${
                        !editor.isActive('heading') ? 'font-black bg-[#EBF755]/50 text-black' : 'text-[#121417]'
                      }`}
                    >
                      Normal Text
                    </button>
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                        setIsSizeDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-sm font-black hover:bg-[#EBF755] transition-colors ${
                        editor.isActive('heading', { level: 1 }) ? 'bg-[#EBF755]/50 text-black' : 'text-[#121417]'
                      }`}
                    >
                      Large (H1)
                    </button>
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 2 }).run();
                        setIsSizeDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs font-bold hover:bg-[#EBF755] transition-colors ${
                        editor.isActive('heading', { level: 2 }) ? 'bg-[#EBF755]/50 text-black' : 'text-[#121417]'
                      }`}
                    >
                      Medium (H2)
                    </button>
                    <button
                      onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 3 }).run();
                        setIsSizeDropdownOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[11px] font-bold hover:bg-[#EBF755] transition-colors ${
                        editor.isActive('heading', { level: 3 }) ? 'bg-[#EBF755]/50 text-black' : 'text-[#121417]'
                      }`}
                    >
                      Small (H3)
                    </button>
                  </div>
                )}
              </div>

              {/* Bold */}
              <button
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={`p-1.5 rounded-lg text-[#121417]/80 hover:bg-black/10 transition-colors ${
                  editor.isActive('bold') ? 'bg-[#121417] text-[#EBF755] shadow-2xs font-bold' : ''
                }`}
                title="Bold (Ctrl+B)"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>

              {/* Italic */}
              <button
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={`p-1.5 rounded-lg text-[#121417]/80 hover:bg-black/10 transition-colors ${
                  editor.isActive('italic') ? 'bg-[#121417] text-[#EBF755] shadow-2xs font-bold' : ''
                }`}
                title="Italic (Ctrl+I)"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>

              {/* Strikethrough */}
              <button
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={`p-1.5 rounded-lg text-[#121417]/80 hover:bg-black/10 transition-colors ${
                  editor.isActive('strike') ? 'bg-[#121417] text-[#EBF755] shadow-2xs font-bold' : ''
                }`}
                title="Strikethrough"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-3.5 bg-[#121417]/15 mx-0.5" />

              {/* Bullet Points */}
              <button
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={`p-1.5 rounded-lg text-[#121417]/80 hover:bg-black/10 transition-colors ${
                  editor.isActive('bulletList') ? 'bg-[#121417] text-[#EBF755] shadow-2xs font-bold' : ''
                }`}
                title="Bullet Points"
              >
                <List className="w-3.5 h-3.5" />
              </button>

              {/* Interactive Checkboxes / Task List */}
              <button
                onClick={() => editor.chain().focus().toggleTaskList().run()}
                className={`p-1.5 rounded-lg text-[#121417]/80 hover:bg-black/10 transition-colors ${
                  editor.isActive('taskList') ? 'bg-[#121417] text-[#EBF755] shadow-2xs font-bold' : ''
                }`}
                title="Checklist / Tasks"
              >
                <ListTodo className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
        
        {/* Background Color Palette Picker */}
        <div className="relative">
          <button 
            type="button"
            onClick={() => setIsPaletteOpen(!isPaletteOpen)}
            className="p-1.5 rounded-lg text-[#121417]/60 hover:bg-black/10 hover:text-[#121417] transition-colors"
            title="Note Background Color"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {isPaletteOpen && (
            <div className="absolute right-0 top-full mt-1 flex flex-wrap gap-1.5 bg-white p-2 rounded-2xl shadow-solid-lg border-2 border-[#121417] z-40 w-44 animate-fade-in">
              {PRESET_NOTE_COLORS.map(c => (
                <button
                  key={c.hex}
                  onClick={() => changeColor(c.hex)}
                  className={`w-6 h-6 rounded-full border-2 border-black/20 hover:scale-110 transition-transform ${
                    (note.color || '#ffffff') === c.hex ? 'ring-2 ring-[#121417] scale-105' : ''
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.name}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 4. Editor Content Area */}
      <div 
        className="flex-1 overflow-y-auto px-4 py-3 cursor-text" 
        onClick={() => editor?.commands.focus()}
      >
        <EditorContent editor={editor} />
      </div>

      {/* 5. Footer Info & Actions */}
      <div className="p-3 border-t border-black/5 flex items-center justify-between text-[10px] text-[#121417]/60 font-medium bg-black/[0.01]">
        <div className="flex items-center gap-1.5">
          {isNoteSaving ? (
            <>
              <Clock className="w-3 h-3 animate-pulse text-amber-500" />
              <span className="text-amber-600 font-bold">Saving changes...</span>
            </>
          ) : (
            <>
              <Check className="w-3 h-3 text-emerald-500" />
              <span className="font-bold">{lastSavedTime ? `Saved ${lastSavedTime}` : 'All changes saved'}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={copyNotes} 
            className="hover:text-black font-bold transition-colors flex items-center gap-1"
            title="Copy note text to clipboard"
          >
            {copied ? (
              <>
                <Check className="w-3 h-3 text-emerald-600" />
                <span className="text-emerald-700">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
