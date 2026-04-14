// src/components/Editor.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { useEditor } from '../hooks/useEditor';
import { notesApi } from '../services/api';
import VersionPanel from './VersionPanel';

const TOOLBAR_ACTIONS = [
  { label: 'H1',  wrap: '# ',       block: true, title: 'Heading 1' },
  { label: 'H2',  wrap: '## ',      block: true, title: 'Heading 2' },
  { label: 'H3',  wrap: '### ',     block: true, title: 'Heading 3' },
  null,
  { label: 'B',   wrap: '**',       title: 'Bold', style: { fontWeight: 700 } },
  { label: 'I',   wrap: '_',        title: 'Italic', style: { fontStyle: 'italic' } },
  { label: 'U',   special: 'underline', title: 'Underline', style: { textDecoration: 'underline' } },
  { label: '~~',  wrap: '~~',       title: 'Strikethrough' },
  null,
  { label: 'FontSize', special: 'size' },
  { label: 'FontFamily', special: 'font' },
  { label: 'Color', special: 'color' },
  { label: 'High', special: 'bg' },
  null,
  { label: 'Left',  special: 'align', param: 'left',   title: 'Align Left' },
  { label: 'Cent',  special: 'align', param: 'center', title: 'Align Center' },
  { label: 'Right', special: 'align', param: 'right',  title: 'Align Right' },
  null,
  { label: '{ }', wrap: '`',        title: 'Inline Code' },
  { label: '```', wrap: '```\n',    close: '\n```', block: true, title: 'Code Block' },
  null,
  { label: '—',   wrap: '> ',       block: true, title: 'Quote' },
  { label: '• ',  wrap: '- ',       block: true, title: 'Bullet List' },
  { label: '1. ', wrap: '1. ',      block: true, title: 'Numbered List' },
  { label: '―',   wrap: '\n---\n',  block: true, title: 'Horizontal Rule' },
  null,
  { label: '🔗',  special: 'link',   title: 'Insert Link' },
];

export default function Editor({ note, onSaved, onTagsChange, onToggleSidebar, sidebarOpen, addToast }) {
  const textareaRef = useRef(null);
  const [previewMode, setPreviewMode] = useState('split'); // 'edit' | 'split' | 'preview'
  const [showVersions, setShowVersions] = useState(false);
  const [tagInput, setTagInput] = useState('');

  const {
    title, content, saving, saveStatus,
    handleTitleChange, handleContentChange, forceSave,
  } = useEditor(note, onSaved);

  // Tag management (local to this note)
  const [tags, setTags] = useState(note.tags || []);

  useEffect(() => { setTags(note.tags || []); }, [note]);

  const saveTags = async (newTags) => {
    try {
      await notesApi.update(note.id, { tags: newTags, saveVersion: false });
      onTagsChange?.();
    } catch {}
  };

  const addTag = (e) => {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,/g, '');
      if (!tags.includes(tag)) {
        const next = [...tags, tag];
        setTags(next);
        saveTags(next);
      }
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    const next = tags.filter((t) => t !== tag);
    setTags(next);
    saveTags(next);
  };

  // ── Toolbar insert ──────────────────────────────────────────────
  const insertMarkdown = useCallback((action, param) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const sel = content.slice(start, end);

    let newContent = content;
    let newCursor = start;

    if (action.special === 'link') {
      const url = prompt('Enter URL:') || 'https://example.com';
      const text = sel || 'Link text';
      const ins = `[${text}](${url})`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'size') {
      const size = param || 'inherit';
      const ins = `<span style="font-size: ${size}">${sel || 'text'}</span>`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'font') {
      const font = param || 'inherit';
      const ins = `<span style="font-family: ${font}">${sel || 'text'}</span>`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'color') {
      const color = param || '#ff0000';
      const ins = `<span style="color: ${color}">${sel || 'text'}</span>`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'bg') {
      const color = param || '#ffff00';
      const ins = `<span style="background-color: ${color}">${sel || 'text'}</span>`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'align') {
      const align = param || 'left';
      const ins = `\n<div style="text-align: ${align}">\n\n${sel || 'aligned text'}\n\n</div>\n`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.special === 'underline') {
      const ins = `<u>${sel || 'text'}</u>`;
      newContent = content.slice(0, start) + ins + content.slice(end);
      newCursor = start + ins.length;
    } else if (action.block) {
      const lineStart = content.lastIndexOf('\n', start - 1) + 1;
      const before = content.slice(0, lineStart);
      const after = content.slice(lineStart);
      const close = action.close || '';
      newContent = before + action.wrap + (sel || '') + close + after;
      newCursor = lineStart + action.wrap.length + sel.length;
    } else {
      const close = action.close || action.wrap;
      newContent = content.slice(0, start) + action.wrap + sel + close + content.slice(end);
      newCursor = start + action.wrap.length + sel.length;
    }

    handleContentChange(newContent);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(newCursor, newCursor);
    }, 10);
  }, [content, handleContentChange]);

  // ── Tab key inside textarea ──────────────────────────────────
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const el = textareaRef.current;
      const start = el.selectionStart;
      const next = content.slice(0, start) + '  ' + content.slice(el.selectionEnd);
      handleContentChange(next);
      setTimeout(() => el.setSelectionRange(start + 2, start + 2), 10);
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      forceSave();
    }
  };

  const saveStatusLabel = {
    saved:   'Saved',
    unsaved: 'Unsaved changes',
    saving:  'Saving…',
    error:   'Save failed',
  }[saveStatus];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div className="editor-toolbar">
        {/* Sidebar toggle */}
        {!sidebarOpen && (
          <button className="toolbar-btn" title="Open sidebar" onClick={onToggleSidebar}>
            ☰
          </button>
        )}

        {/* Markdown insert buttons */}
        {TOOLBAR_ACTIONS.map((action, i) => {
          if (action === null) return <div className="toolbar-group" key={`sep-${i}`} />;
          
          if (action.special === 'size') {
            return (
              <select 
                key="fontSize" 
                className="toolbar-select"
                onChange={(e) => insertMarkdown(action, e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Size</option>
                <option value="12px">12px</option>
                <option value="14px">14px</option>
                <option value="16px">16px</option>
                <option value="20px">20px</option>
                <option value="24px">24px</option>
                <option value="32px">32px</option>
              </select>
            );
          }
          
          if (action.special === 'font') {
            return (
              <select 
                key="fontFamily" 
                className="toolbar-select"
                onChange={(e) => insertMarkdown(action, e.target.value)}
                defaultValue=""
              >
                <option value="" disabled>Font</option>
                <option value="inherit">Default</option>
                <option value="serif">Serif</option>
                <option value="'Courier New', Courier, monospace">Mono</option>
                <option value="'Comic Sans MS', cursive">Comic</option>
                <option value="'Georgia', serif">Georgia</option>
                <option value="'Impact', sans-serif">Impact</option>
              </select>
            );
          }

          if (action.special === 'color' || action.special === 'bg') {
            return (
              <div className="toolbar-picker-wrap" key={action.special}>
                <span className="picker-label">{action.label}</span>
                <input 
                  type="color" 
                  className="toolbar-color-picker"
                  onChange={(e) => insertMarkdown(action, e.target.value)}
                  title={action.title}
                />
              </div>
            );
          }

          if (action.special === 'align') {
            return (
              <button
                key={action.param}
                className="toolbar-btn"
                title={action.title}
                onClick={() => insertMarkdown(action, action.param)}
              >
                {action.param === 'left' ? '←' : action.param === 'center' ? '↔' : '→'}
              </button>
            );
          }

          return (
            <button
              key={action.label}
              className="toolbar-btn"
              title={action.title || action.label}
              style={action.style}
              onClick={() => insertMarkdown(action)}
            >
              {action.label}
            </button>
          );
        })}

        {/* View mode */}
        <div className="toolbar-group" style={{ marginLeft: 'auto' }}>
          {['edit', 'split', 'preview'].map((mode) => (
            <button
              key={mode}
              className={`toolbar-btn ${previewMode === mode ? 'active' : ''}`}
              onClick={() => setPreviewMode(mode)}
              title={mode.charAt(0).toUpperCase() + mode.slice(1)}
            >
              {mode === 'edit' ? '✎' : mode === 'split' ? '⊟' : '👁'}
            </button>
          ))}
        </div>

        {/* Version history */}
        <button
          className={`toolbar-btn ${showVersions ? 'active' : ''}`}
          title="Version history"
          onClick={() => setShowVersions((v) => !v)}
        >
          ⏱
        </button>

        {/* Save status */}
        <div className="save-status">
          <div className={`save-dot ${saveStatus}`} />
          <span className="save-text">{saveStatusLabel}</span>
          <button className="save-btn" onClick={forceSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        className="note-title-input"
        placeholder="Untitled Note…"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
      />

      {/* Tags */}
      <div className="tags-editor">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
          <path d="M2 2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 0 1.414l-4.586 4.586a1 1 0 0 1-1.414 0L2.293 8.293A1 1 0 0 1 2 7.586V2z" stroke="currentColor" strokeWidth="1.5"/>
          <circle cx="5" cy="5" r="1" fill="currentColor"/>
        </svg>
        {tags.map((tag) => (
          <span key={tag} className="tag-badge">
            {tag}
            <button onClick={() => removeTag(tag)}>✕</button>
          </span>
        ))}
        <input
          className="tag-add-input"
          placeholder="Add tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={addTag}
        />
      </div>

      {/* Split editor */}
      <div className="editor-split">
        {/* Editor pane */}
        {(previewMode === 'edit' || previewMode === 'split') && (
          <div className="editor-pane">
            <div className="pane-header">
              <span className="pane-label">Markdown</span>
              <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>
                {content.length} chars · Ctrl+S to save
              </span>
            </div>
            <textarea
              ref={textareaRef}
              className="markdown-textarea"
              placeholder={'# Start writing...\n\nSupports **bold**, _italic_, `code`, and more.'}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview pane */}
        {(previewMode === 'preview' || previewMode === 'split') && (
          <div className="preview-pane">
            <div className="pane-header">
              <span className="pane-label">Preview</span>
            </div>
            <div className="preview-scroll">
              <div className="markdown-preview">
                {content ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                  >
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 13 }}>
                    Nothing to preview yet…
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Version history panel */}
      {showVersions && (
        <VersionPanel
          noteId={note.id}
          onRestore={(updated) => {
            onSaved?.(updated);
            setShowVersions(false);
            addToast('Version restored', 'success');
          }}
          onClose={() => setShowVersions(false)}
        />
      )}
    </div>
  );
}
