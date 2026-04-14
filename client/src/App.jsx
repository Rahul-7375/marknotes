// src/App.jsx — Root application component
import React, { useState, useEffect } from 'react';
import './index.css';
import './App.css';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import { useNotes } from './hooks/useNotes';
import { tagsApi } from './services/api';

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeNote, setActiveNote] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [allTags, setAllTags] = useState([]);
  const [toasts, setToasts] = useState([]);

  const {
    notes, loading, search, setSearch,
    activeTag, setActiveTag,
    createNote, deleteNote, updateNoteInList,
  } = useNotes();

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Fetch all tags
  const fetchTags = async () => {
    try {
      const res = await tagsApi.getAll();
      setAllTags(res.data);
    } catch {}
  };

  useEffect(() => { fetchTags(); }, [notes]);

  // Toast helper
  const addToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  };

  const handleCreateNote = async () => {
    const note = await createNote();
    if (note) {
      setActiveNote(note);
      addToast('New note created', 'success');
    }
  };

  const handleDeleteNote = async (id) => {
    const ok = await deleteNote(id);
    if (ok) {
      if (activeNote?.id === id) setActiveNote(null);
      addToast('Note deleted', 'info');
    }
  };

  const handleNoteSaved = (updated) => {
    updateNoteInList(updated);
    if (activeNote?.id === updated.id) {
      // Keep activeNote in sync (without re-loading editor)
      setActiveNote((prev) => ({ ...prev, ...updated }));
    }
  };

  return (
    <div className="app">
      {/* Sidebar */}
      <Sidebar
        notes={notes}
        loading={loading}
        activeNote={activeNote}
        search={search}
        setSearch={setSearch}
        activeTag={activeTag}
        setActiveTag={setActiveTag}
        allTags={allTags}
        onSelectNote={setActiveNote}
        onCreateNote={handleCreateNote}
        onDeleteNote={handleDeleteNote}
        collapsed={!sidebarOpen}
        theme={theme}
        toggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        toggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      {/* Main area */}
      <div className="main">
        {activeNote ? (
          <Editor
            key={activeNote.id}
            note={activeNote}
            onSaved={handleNoteSaved}
            onTagsChange={fetchTags}
            onToggleSidebar={() => setSidebarOpen((v) => !v)}
            sidebarOpen={sidebarOpen}
            addToast={addToast}
          />
        ) : (
          <EmptyState onCreateNote={handleCreateNote} />
        )}
      </div>

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>
            {t.type === 'success' && '✓ '}
            {t.type === 'error'   && '✕ '}
            {t.type === 'info'    && 'ℹ '}
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onCreateNote }) {
  return (
    <div className="empty-state">
      <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="8" width="44" height="48" rx="6" fill="currentColor" opacity="0.08"/>
        <rect x="18" y="20" width="28" height="2" rx="1" fill="currentColor" opacity="0.3"/>
        <rect x="18" y="28" width="22" height="2" rx="1" fill="currentColor" opacity="0.3"/>
        <rect x="18" y="36" width="26" height="2" rx="1" fill="currentColor" opacity="0.3"/>
      </svg>
      <h3>No note selected</h3>
      <p>Select a note from the sidebar or create a new one</p>
      <button className="new-note-btn" style={{ width: 'auto', marginTop: 8 }} onClick={onCreateNote}>
        + New Note
      </button>
    </div>
  );
}

export default App;
