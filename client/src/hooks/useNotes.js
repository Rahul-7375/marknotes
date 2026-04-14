// src/hooks/useNotes.js — Notes state management hook
import { useState, useEffect, useCallback } from 'react';
import { notesApi } from '../services/api';

export const useNotes = () => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('');

  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await notesApi.getAll({ search, tag: activeTag });
      setNotes(res.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [search, activeTag]);

  useEffect(() => {
    const t = setTimeout(fetchNotes, 300);
    return () => clearTimeout(t);
  }, [fetchNotes]);

  const createNote = async () => {
    try {
      const res = await notesApi.create({ title: 'Untitled Note', content: '' });
      setNotes((prev) => [res.data, ...prev]);
      return res.data;
    } catch (err) {
      setError(err.message);
      return null;
    }
  };

  const deleteNote = async (id) => {
    try {
      await notesApi.delete(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  const updateNoteInList = (updated) => {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  };

  return {
    notes,
    loading,
    error,
    search,
    setSearch,
    activeTag,
    setActiveTag,
    createNote,
    deleteNote,
    updateNoteInList,
    refetch: fetchNotes,
  };
};
