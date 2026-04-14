// src/components/VersionPanel.jsx
import React, { useState, useEffect } from 'react';
import { notesApi } from '../services/api';

const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

export default function VersionPanel({ noteId, onRestore, onClose }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(null);

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await notesApi.getVersions(noteId);
        setVersions(res.data);
      } catch {}
      finally { setLoading(false); }
    };
    fetchVersions();
  }, [noteId]);

  const handleRestore = async (versionId) => {
    if (!window.confirm('Restore this version? Current state will be saved as a version.')) return;
    try {
      setRestoring(versionId);
      const res = await notesApi.restoreVersion(noteId, versionId);
      onRestore?.(res.data);
    } catch {
      alert('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <div className="version-panel">
      <div className="version-panel-header">
        <h3>⏱ Version History</h3>
        <button className="icon-btn" onClick={onClose}>✕</button>
      </div>
      <div className="version-list">
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
            <div className="spinner" />
          </div>
        ) : versions.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', padding: 24 }}>
            No saved versions yet.
            <br /><br />
            Versions are saved automatically each time you update a note.
          </div>
        ) : (
          versions.map((v) => (
            <div key={v.id} className="version-item">
              <div className="version-item-title">{v.title || 'Untitled Note'}</div>
              <div className="version-item-meta">{formatDate(v.saved_at)}</div>
              {v.preview && (
                <div className="version-item-preview">{v.preview}</div>
              )}
              <button
                className="restore-btn"
                onClick={() => handleRestore(v.id)}
                disabled={restoring === v.id}
              >
                {restoring === v.id ? 'Restoring…' : 'Restore this version'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
