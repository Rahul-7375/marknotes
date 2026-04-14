// src/hooks/useEditor.js — Editor state with debounced autosave
import { useState, useEffect, useRef, useCallback } from 'react';
import { notesApi } from '../services/api';

const AUTOSAVE_DELAY = 1200; // ms after user stops typing

export const useEditor = (initialNote, onSaved) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'unsaved' | 'saving' | 'error'
  const [error, setError] = useState(null);
  const timerRef = useRef(null);
  const noteIdRef = useRef(null);

  // Load note into editor
  useEffect(() => {
    if (initialNote) {
      setTitle(initialNote.title || '');
      setContent(initialNote.content || '');
      noteIdRef.current = initialNote.id;
      setSaveStatus('saved');
    }
  }, [initialNote]);

  const save = useCallback(async (t, c) => {
    if (!noteIdRef.current) return;
    try {
      setSaving(true);
      setSaveStatus('saving');
      const res = await notesApi.update(noteIdRef.current, { title: t, content: c });
      setSaveStatus('saved');
      setError(null);
      onSaved?.(res.data);
    } catch (err) {
      setSaveStatus('error');
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }, [onSaved]);

  // Debounced autosave trigger
  const scheduleAutosave = useCallback(
    (t, c) => {
      setSaveStatus('unsaved');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => save(t, c), AUTOSAVE_DELAY);
    },
    [save]
  );

  const handleTitleChange = (val) => {
    setTitle(val);
    scheduleAutosave(val, content);
  };

  const handleContentChange = (val) => {
    setContent(val);
    scheduleAutosave(title, val);
  };

  const forceSave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    save(title, content);
  };

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return {
    title,
    content,
    saving,
    saveStatus,
    error,
    handleTitleChange,
    handleContentChange,
    forceSave,
  };
};
