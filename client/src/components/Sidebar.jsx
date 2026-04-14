// src/components/Sidebar.jsx
import React from 'react';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const stripMarkdown = (text) =>
  text
    .replace(/#{1,6}\s/g, '')
    .replace(/[*_`~]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();

export default function Sidebar({
  notes, loading, activeNote,
  search, setSearch,
  activeTag, setActiveTag, allTags,
  onSelectNote, onCreateNote, onDeleteNote,
  collapsed, theme, toggleTheme, toggleSidebar,
}) {
  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      {/* Header */}
      <div className="sidebar-header">
        <div className="app-logo">
          <div className="app-logo-icon">M</div>
          <span className="app-logo-text">MarkNotes</span>
        </div>
        <div className="sidebar-controls">
          <button
            className="icon-btn"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? '☀' : '◑'}
          </button>
          <button className="icon-btn" title="Collapse sidebar" onClick={toggleSidebar}>
            ←
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="search-box">
        <div className="search-input-wrap">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
            <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            placeholder="Search notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              style={{ background: 'none', color: 'var(--text-muted)', fontSize: 12, padding: 0 }}
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tags filter */}
      {allTags.length > 0 && (
        <div className="tags-filter">
          <button
            className={`tag-chip ${activeTag === '' ? 'active' : ''}`}
            onClick={() => setActiveTag('')}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              className={`tag-chip ${activeTag === tag ? 'active' : ''}`}
              onClick={() => setActiveTag(activeTag === tag ? '' : tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Notes list */}
      <div className="notes-list">
        {loading ? (
          <div className="notes-list-empty">
            <div className="spinner" />
          </div>
        ) : notes.length === 0 ? (
          <div className="notes-list-empty">
            <div style={{ fontSize: 28, opacity: 0.3 }}>📄</div>
            <div>{search ? 'No results found' : 'No notes yet'}</div>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={`note-item ${activeNote?.id === note.id ? 'active' : ''}`}
              onClick={() => onSelectNote(note)}
            >
              <div className="note-item-title">{note.title || 'Untitled Note'}</div>
              {note.content && (
                <div className="note-item-preview">
                  {stripMarkdown(note.content).slice(0, 80)}
                </div>
              )}
              <div className="note-item-meta">
                <span className="note-item-date">{formatDate(note.updated_at)}</span>
                <button
                  className="note-delete-btn"
                  title="Delete note"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this note?')) onDeleteNote(note.id);
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New note button */}
      <button className="new-note-btn" onClick={onCreateNote}>
        + New Note
      </button>
    </aside>
  );
}
