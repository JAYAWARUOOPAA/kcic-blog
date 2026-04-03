const db = require('../../config/database');

module.exports = async function apiRoutes(fastify, opts) {

  // Toggle save article
  fastify.post('/articles/:id/save', async (req, reply) => {
    if (!req.session.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.session.user.id;
    const articleId = req.params.id;
    try {
      const existing = await db.query('SELECT id FROM saved_articles WHERE user_id=$1 AND article_id=$2', [userId, articleId]);
      if (existing.rows.length > 0) {
        await db.query('DELETE FROM saved_articles WHERE user_id=$1 AND article_id=$2', [userId, articleId]);
        return reply.send({ saved: false, message: 'Article removed from saved' });
      } else {
        await db.query('INSERT INTO saved_articles (user_id, article_id) VALUES ($1,$2)', [userId, articleId]);
        return reply.send({ saved: true, message: 'Article saved!' });
      }
    } catch (err) {
      return reply.code(500).send({ error: 'Failed' });
    }
  });

  // Toggle like
  fastify.post('/articles/:id/like', async (req, reply) => {
    if (!req.session.user) return reply.code(401).send({ error: 'Unauthorized' });
    const userId = req.session.user.id;
    const articleId = req.params.id;
    try {
      const existing = await db.query('SELECT id FROM article_likes WHERE user_id=$1 AND article_id=$2', [userId, articleId]);
      if (existing.rows.length > 0) {
        await db.query('DELETE FROM article_likes WHERE user_id=$1 AND article_id=$2', [userId, articleId]);
      } else {
        await db.query('INSERT INTO article_likes (user_id, article_id) VALUES ($1,$2)', [userId, articleId]);
      }
      const countRes = await db.query('SELECT COUNT(*) FROM article_likes WHERE article_id=$1', [articleId]);
      return reply.send({ liked: existing.rows.length === 0, count: parseInt(countRes.rows[0].count) });
    } catch (err) {
      return reply.code(500).send({ error: 'Failed' });
    }
  });

  // Mark notification read
  fastify.post('/notifications/:id/read', async (req, reply) => {
    if (!req.session.user) return reply.code(401).send({ error: 'Unauthorized' });
    await db.query('UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2', [req.params.id, req.session.user.id]).catch(() => {});
    return reply.send({ success: true });
  });

  // Get unread notification count
  fastify.get('/notifications/count', async (req, reply) => {
    if (!req.session.user) return reply.send({ count: 0 });
    const res = await db.query('SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false', [req.session.user.id]).catch(() => ({ rows: [{ count: 0 }] }));
    return reply.send({ count: parseInt(res.rows[0].count) });
  });

  // Pending articles count (for admin sidebar badge)
  fastify.get('/articles/pending-count', async (req, reply) => {
    if (!req.session.user || req.session.user.role !== 'admin') return reply.send({ count: 0 });
    const res = await db.query("SELECT COUNT(*) FROM articles WHERE status='pending'").catch(() => ({ rows: [{ count: 0 }] }));
    return reply.send({ count: parseInt(res.rows[0].count) });
  });

  // Search suggestions
  fastify.get('/search/suggestions', async (req, reply) => {
    const q = req.query.q || '';
    if (!q.trim() || q.length < 2) return reply.send([]);
    try {
      const res = await db.query(
        `SELECT title, slug FROM articles WHERE status='published' AND title ILIKE $1 LIMIT 5`, [`%${q}%`]
      );
      return reply.send(res.rows);
    } catch (err) {
      return reply.send([]);
    }
  });
};
