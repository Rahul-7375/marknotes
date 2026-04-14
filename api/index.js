const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { body, param, query, validationResult } = require('express-validator');
const db = require('../db'); // Postgres Pool
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
    tags: Array.isArray(n.tags) ? n.tags : (typeof n.tags === 'string' ? JSON.parse(n.tags) : []),
  };
};

// ── API Routes (Prefix /api) ──────────────────────────────────
const api = express.Router();

api.get('/health', (_, res) => res.json({ status: 'ok', database: 'supabase' }));

// GET /api/notes
api.get('/notes',
  [query('search').optional().isString().trim(),
   query('tag').optional().isString().trim(),
   query('page').optional().isInt({ min: 1 }).toInt(),
   query('limit').optional().isInt({ min: 1, max: 100 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const { search = '', tag = '', page = 1, limit = 51 } = req.query;
      const offset = (page - 1) * limit;
      let sql = 'SELECT * FROM notes WHERE 1=1';
      const params = [];
      let paramCount = 1;

      if (search) { 
        sql += ` AND (title ILIKE $${paramCount} OR content ILIKE $${paramCount})`; 
        params.push(`%${search}%`);
        paramCount++;
      }
      if (tag) { 
        // Postgres JSONB containment operator
        sql += ` AND tags @> $${paramCount}::jsonb`; 
        params.push(JSON.stringify([tag]));
        paramCount++;
      }
      
      const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countRes = await db.query(countSql, params);
      const total = parseInt(countRes.rows[0].total);
      
      sql += ` ORDER BY updated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
      
      const result = await db.query(sql, params);
      const notes = result.rows.map(parseNote);
      
      res.json({ 
        success: true, 
        data: notes, 
        meta: { total, page, limit, pages: Math.ceil(total / limit) } 
      });
    } catch (e) {
      console.error('List Notes Error:', e);
      err(res, `Database error: ${e.message}`, 500);
    }
  }
);

// GET /api/notes/:id
api.get('/notes/:id', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return err(res, 'Note not found', 404);
    ok(res, parseNote(result.rows[0]));
  } catch (e) {
    err(res, `Database error: ${e.message}`, 500);
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
      const result = await db.query(
        'INSERT INTO notes (title, content, tags) VALUES ($1, $2, $3) RETURNING *',
        [title, content, JSON.stringify(tags)]
      );
      ok(res, parseNote(result.rows[0]), 201);
    } catch (e) {
      console.error('Create Note Error:', e);
      err(res, `Database error during creation: ${e.message}`, 500);
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
      const existingRes = await db.query('SELECT * FROM notes WHERE id = $1', [id]);
      if (existingRes.rows.length === 0) return err(res, 'Note not found', 404);
      const existing = existingRes.rows[0];

      const title   = req.body.title   !== undefined ? req.body.title   : existing.title;
      const content = req.body.content !== undefined ? req.body.content : existing.content;
      const tags    = req.body.tags    !== undefined ? JSON.stringify(req.body.tags) : JSON.stringify(existing.tags);

      if (req.body.saveVersion !== false) {
        await db.query(
          'INSERT INTO note_versions (note_id, title, content) VALUES ($1, $2, $3)',
          [id, existing.title, existing.content]
        );
      }

      const updateRes = await db.query(
        'UPDATE notes SET title=$1, content=$2, tags=$3 WHERE id=$4 RETURNING *',
        [title, content, tags, id]
      );

      ok(res, parseNote(updateRes.rows[0]));
    } catch (e) {
      console.error('Update Note Error:', e);
      err(res, `Database error during update: ${e.message}`, 500);
    }
  }
);

// DELETE /api/notes/:id
api.delete('/notes/:id', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const result = await db.query('DELETE FROM notes WHERE id = $1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) return err(res, 'Note not found', 404);
    ok(res, { message: 'Note deleted' });
  } catch (e) {
    err(res, `Database error: ${e.message}`, 500);
  }
});

// GET /api/notes/:id/versions
api.get('/notes/:id/versions', [param('id').isInt({ min: 1 }).toInt()], validate, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, note_id, title, LEFT(content, 200) as preview, saved_at FROM note_versions WHERE note_id = $1 ORDER BY saved_at DESC LIMIT 20',
      [req.params.id]
    );
    ok(res, result.rows);
  } catch (e) {
    err(res, `Database error: ${e.message}`, 500);
  }
});

// POST /api/notes/:id/restore/:versionId
api.post('/notes/:id/restore/:versionId',
  [param('id').isInt({ min: 1 }).toInt(), param('versionId').isInt({ min: 1 }).toInt()],
  validate,
  async (req, res) => {
    try {
      const vRes = await db.query(
        'SELECT * FROM note_versions WHERE id = $1 AND note_id = $2',
        [req.params.versionId, req.params.id]
      );
      if (vRes.rows.length === 0) return err(res, 'Version not found', 404);
      const v = vRes.rows[0];
      
      const existingRes = await db.query('SELECT * FROM notes WHERE id = $1', [req.params.id]);
      const existing = existingRes.rows[0];
      
      await db.query(
        'INSERT INTO note_versions (note_id, title, content) VALUES ($1, $2, $3)',
        [req.params.id, existing.title, existing.content]
      );
      
      const updateRes = await db.query(
        'UPDATE notes SET title=$1, content=$2 WHERE id=$3 RETURNING *',
        [v.title, v.content, req.params.id]
      );
      
      ok(res, parseNote(updateRes.rows[0]));
    } catch (e) {
      err(res, `Database error: ${e.message}`, 500);
    }
  }
);

// GET /api/tags
api.get('/tags', async (_, res) => {
  try {
    const result = await db.query('SELECT tags FROM notes');
    const set = new Set();
    result.rows.forEach(({ tags }) => {
      const parsedTags = Array.isArray(tags) ? tags : (typeof tags === 'string' ? JSON.parse(tags) : []);
      parsedTags.forEach(t => set.add(t));
    });
    ok(res, [...set].sort());
  } catch (e) {
    err(res, `Database error: ${e.message}`, 500);
  }
});

app.use('/api', api);

module.exports = app;
