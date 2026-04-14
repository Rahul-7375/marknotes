const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db'); // Pool connection
require('dotenv').config();

const app = express();

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

// ── Helpers ───────────────────────────────────────────────────
const ok  = (res, data, status = 200) => res.status(status).json({ success: true, data });
const err = (res, msg, status = 400)  => res.status(status).json({ success: false, message: msg });

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
};

const parseNote = (n) => {
  if (!n) return null;
  return {
    ...n,
    tags: typeof n.tags === 'string' ? JSON.parse(n.tags) : (n.tags || []),
  };
};

// ── API Routes (Prefix /api) ──────────────────────────────────
const api = express.Router();

api.get('/health', (_, res) => res.json({ status: 'ok', database: 'mysql' }));

// GET /api/notes
api.get('/notes',
  [query('search').optional().isString().trim(),
   query('tag').optional().isString().trim(),
   query('page').optional().isInt({ min: 1 }).toInt(),
   query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const { search = '', tag = '', page = 1, limit = 51 } = req.query; // limit 51 for simple 'next' check
      const offset = (page - 1) * limit;
      let sql = 'SELECT * FROM notes WHERE 1=1';
      const params = [];
      if (search) { 
        sql += ' AND (title LIKE ? OR content LIKE ?)'; 
        params.push(`%${search}%`, `%${search}%`); 
      }
      if (tag) { 
        sql += ' AND JSON_CONTAINS(tags, CAST(? AS JSON))'; 
        params.push(JSON.stringify(tag));
      }
      
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const [[{ total }]] = await db.query(countSql, params);
      
      sql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);
      
      const [rows] = await db.query(sql, params);
      const notes = rows.map(parseNote);
      
      res.json({ 
        success: true, 
        data: notes, 
        meta: { total, page, limit, pages: Math.ceil(total / limit) } 
      });
    } catch (e) {
      console.error(e);
      err(res, 'Database error', 500);
    }
  }
);

// GET /api/notes/:id
api.get('/notes/:id', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const [[note]] = await db.query('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    if (!note) return err(res, 'Note not found', 404);
    ok(res, parseNote(note));
  } catch (e) {
    err(res, 'Database error', 500);
  }
});

// POST /api/notes
api.post('/notes',
  [body('title').optional().isString().trim().isLength({ max: 255 }),
   body('content').optional().isString(),
   body('tags').optional().isArray()],
  validate,
  async (req, res) => {
    try {
      const { title = 'Untitled Note', content = '', tags = [] } = req.body;
      const [result] = await db.query(
        'INSERT INTO notes (title, content, tags) VALUES (?, ?, ?)',
        [title, content, JSON.stringify(tags)]
      );
      const [[note]] = await db.query('SELECT * FROM notes WHERE id = ?', [result.insertId]);
      ok(res, parseNote(note), 201);
    } catch (e) {
      err(res, 'Database error', 500);
    }
  }
);

// PUT /api/notes/:id
api.put('/notes/:id',
  [param('id').isInt({ min: 1 }).toInt(),
   body('title').optional().isString().trim().isLength({ max: 255 }),
   body('content').optional().isString(),
   body('tags').optional().isArray(),
   body('saveVersion').optional().isBoolean()],
  validate,
  async (req, res) => {
    try {
      const { id } = req.params;
      const [[existing]] = await db.query('SELECT * FROM notes WHERE id = ?', [id]);
      if (!existing) return err(res, 'Note not found', 404);

      const title   = req.body.title   !== undefined ? req.body.title   : existing.title;
      const content = req.body.content !== undefined ? req.body.content : existing.content;
      const tags    = req.body.tags    !== undefined ? JSON.stringify(req.body.tags) : JSON.stringify(existing.tags);

      if (req.body.saveVersion !== false) {
        await db.query(
          'INSERT INTO note_versions (note_id, title, content) VALUES (?, ?, ?)',
          [id, existing.title, existing.content]
        );
      }

      await db.query(
        'UPDATE notes SET title=?, content=?, tags=?, updated_at=NOW() WHERE id=?',
        [title, content, tags, id]
      );

      const [[note]] = await db.query('SELECT * FROM notes WHERE id = ?', [id]);
      ok(res, parseNote(note));
    } catch (e) {
      err(res, 'Database error', 500);
    }
  }
);

// DELETE /api/notes/:id
api.delete('/notes/:id', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const [[existing]] = await db.query('SELECT id FROM notes WHERE id = ?', [req.params.id]);
    if (!existing) return err(res, 'Note not found', 404);
    await db.query('DELETE FROM notes WHERE id = ?', [req.params.id]);
    ok(res, { message: 'Note deleted' });
  } catch (e) {
    err(res, 'Database error', 500);
  }
});

// GET /api/notes/:id/versions
api.get('/notes/:id/versions', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, note_id, title, SUBSTRING(content, 1, 200) as preview, saved_at FROM note_versions WHERE note_id = ? ORDER BY saved_at DESC LIMIT 20',
      [req.params.id]
    );
    ok(res, rows);
  } catch (e) {
    err(res, 'Database error', 500);
  }
});

// POST /api/notes/:id/restore/:versionId
api.post('/notes/:id/restore/:versionId',
  [param('id').isInt({ min: 1 }).toInt(), param('versionId').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const [[v]] = await db.query(
        'SELECT * FROM note_versions WHERE id = ? AND note_id = ?',
        [req.params.versionId, req.params.id]
      );
      if (!v) return err(res, 'Version not found', 404);
      
      const [[existing]] = await db.query('SELECT * FROM notes WHERE id = ?', [req.params.id]);
      
      await db.query(
        'INSERT INTO note_versions (note_id, title, content) VALUES (?, ?, ?)',
        [req.params.id, existing.title, existing.content]
      );
      
      await db.query(
        'UPDATE notes SET title=?, content=?, updated_at=NOW() WHERE id=?',
        [v.title, v.content, req.params.id]
      );
      
      const [[note]] = await db.query('SELECT * FROM notes WHERE id = ?', [req.params.id]);
      ok(res, parseNote(note));
    } catch (e) {
      err(res, 'Database error', 500);
    }
  }
);

// GET /api/tags
api.get('/tags', async (_, res) => {
  try {
    const [rows] = await db.query('SELECT tags FROM notes');
    const set = new Set();
    rows.forEach(({ tags }) => {
      const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
      parsedTags.forEach(t => set.add(t));
    });
    ok(res, [...set].sort());
  } catch (e) {
    err(res, 'Database error', 500);
  }
});

app.use('/api', api);

module.exports = app;
