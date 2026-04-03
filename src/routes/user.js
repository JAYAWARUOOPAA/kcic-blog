const db = require('../../config/database');
const slugify = require('slugify');
const { requireAuth } = require('../middleware/auth');

module.exports = async function userRoutes(fastify, opts) {

  // User Dashboard
  fastify.get('/dashboard', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    try {
      const [articlesRes, savedRes, historyRes, notifRes] = await Promise.all([
        db.query(`SELECT a.*, c.name as category_name FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.author_id = $1 ORDER BY a.created_at DESC LIMIT 5`, [user.id]),
        db.query(`SELECT COUNT(*) FROM saved_articles WHERE user_id = $1`, [user.id]),
        db.query(`SELECT COUNT(*) FROM reading_history WHERE user_id = $1`, [user.id]),
        db.query(`SELECT * FROM notifications WHERE user_id = $1 AND is_read = false ORDER BY created_at DESC LIMIT 5`, [user.id])
      ]);
      const statsRes = await db.query(
        `SELECT COUNT(*) FILTER (WHERE status='published') as published, COUNT(*) FILTER (WHERE status='pending') as pending, COUNT(*) FILTER (WHERE status='draft') as draft, COUNT(*) FILTER (WHERE status='rejected') as rejected FROM articles WHERE author_id = $1`, [user.id]
      );
      return reply.view('user/dashboard.ejs', {
        title: 'My Dashboard - KCIC Academic Blog',
        user, articles: articlesRes.rows,
        saved_count: parseInt(savedRes.rows[0].count),
        history_count: parseInt(historyRes.rows[0].count),
        notifications: notifRes.rows,
        stats: statsRes.rows[0],
        currentPage: 'dashboard'
      });
    } catch (err) {
      console.error(err);
      return reply.view('user/dashboard.ejs', { title: 'Dashboard', user, articles: [], saved_count: 0, history_count: 0, notifications: [], stats: {}, currentPage: 'dashboard' });
    }
  });

  // Saved Articles
  fastify.get('/saved', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    try {
      const savedRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name, c.name as category_name, c.color as category_color, sa.saved_at
          FROM saved_articles sa JOIN articles a ON sa.article_id = a.id
          LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE sa.user_id = $1 ORDER BY sa.saved_at DESC`, [user.id]
      );
      return reply.view('user/saved.ejs', { title: 'Saved Articles', user, articles: savedRes.rows, currentPage: 'saved' });
    } catch (err) {
      return reply.view('user/saved.ejs', { title: 'Saved Articles', user, articles: [], currentPage: 'saved' });
    }
  });

  // Reading History
  fastify.get('/history', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    try {
      const historyRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name, c.name as category_name, c.color as category_color, rh.read_at
          FROM reading_history rh JOIN articles a ON rh.article_id = a.id
          LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE rh.user_id = $1 AND a.status = 'published' ORDER BY rh.read_at DESC`, [user.id]
      );
      return reply.view('user/history.ejs', { title: 'Reading History', user, articles: historyRes.rows, currentPage: 'history' });
    } catch (err) {
      return reply.view('user/history.ejs', { title: 'Reading History', user, articles: [], currentPage: 'history' });
    }
  });

  // Create Article
  fastify.get('/create-article', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    const categoriesRes = await db.query('SELECT * FROM categories ORDER BY name');
    return reply.view('user/create-article.ejs', {
      title: 'Create Article', user, categories: categoriesRes.rows, error: null, currentPage: 'create'
    });
  });

  fastify.post('/create-article', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    const { title, content, excerpt, category_id, tags, status } = req.body;
    try {
      let slug = slugify(title, { lower: true, strict: true });
      const existing = await db.query('SELECT id FROM articles WHERE slug = $1', [slug]);
      if (existing.rows.length > 0) slug = `${slug}-${Date.now()}`;

      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const wordCount = content.split(' ').length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));
      const articleStatus = status === 'draft' ? 'draft' : 'pending';
      const excerpt_final = excerpt || content.replace(/<[^>]+>/g, '').substring(0, 200) + '...';

      await db.query(
        `INSERT INTO articles (title, slug, content, excerpt, author_id, category_id, tags, reading_time, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [title, slug, content, excerpt_final, user.id, category_id || null, tagsArray, readingTime, articleStatus]
      );
      return reply.redirect('/user/my-articles?created=true');
    } catch (err) {
      console.error(err);
      const categoriesRes = await db.query('SELECT * FROM categories ORDER BY name');
      return reply.view('user/create-article.ejs', { title: 'Create Article', user, categories: categoriesRes.rows, error: 'Failed to create article', currentPage: 'create' });
    }
  });

  // My Articles
  fastify.get('/my-articles', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    try {
      const articlesRes = await db.query(
        `SELECT a.*, c.name as category_name FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE a.author_id = $1 ORDER BY a.created_at DESC`, [user.id]
      );
      return reply.view('user/my-articles.ejs', {
        title: 'My Articles', user, articles: articlesRes.rows,
        success: req.query.created ? 'Article submitted successfully!' : null,
        currentPage: 'my-articles'
      });
    } catch (err) {
      return reply.view('user/my-articles.ejs', { title: 'My Articles', user, articles: [], success: null, currentPage: 'my-articles' });
    }
  });

  // Edit Article
  fastify.get('/edit-article/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    try {
      const articleRes = await db.query('SELECT * FROM articles WHERE id = $1 AND author_id = $2', [req.params.id, user.id]);
      if (articleRes.rows.length === 0) return reply.redirect('/user/my-articles');
      const categoriesRes = await db.query('SELECT * FROM categories ORDER BY name');
      return reply.view('user/edit-article.ejs', {
        title: 'Edit Article', user, article: articleRes.rows[0], categories: categoriesRes.rows, error: null, currentPage: 'my-articles'
      });
    } catch (err) {
      return reply.redirect('/user/my-articles');
    }
  });

  fastify.post('/edit-article/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    const { title, content, excerpt, category_id, tags, status } = req.body;
    try {
      const articleRes = await db.query('SELECT * FROM articles WHERE id = $1 AND author_id = $2', [req.params.id, user.id]);
      if (articleRes.rows.length === 0) return reply.redirect('/user/my-articles');

      const tagsArray = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
      const wordCount = content.split(' ').length;
      const readingTime = Math.max(1, Math.ceil(wordCount / 200));
      const articleStatus = status === 'draft' ? 'draft' : 'pending';

      await db.query(
        `UPDATE articles SET title=$1, content=$2, excerpt=$3, category_id=$4, tags=$5, reading_time=$6, status=$7 WHERE id=$8 AND author_id=$9`,
        [title, content, excerpt, category_id || null, tagsArray, readingTime, articleStatus, req.params.id, user.id]
      );
      return reply.redirect('/user/my-articles');
    } catch (err) {
      return reply.redirect('/user/my-articles');
    }
  });

  // Delete article
  fastify.post('/delete-article/:id', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    await db.query('DELETE FROM articles WHERE id = $1 AND author_id = $2', [req.params.id, user.id]).catch(console.error);
    return reply.redirect('/user/my-articles');
  });

  // Profile
  fastify.get('/profile', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
    return reply.view('user/profile.ejs', {
      title: 'My Profile', user, profile: userRes.rows[0], error: null, success: null, currentPage: 'profile'
    });
  });

  fastify.post('/profile', { preHandler: requireAuth }, async (req, reply) => {
    const user = req.session.user;
    const { first_name, last_name, bio, department, student_id } = req.body;
    try {
      await db.query(
        'UPDATE users SET first_name=$1, last_name=$2, bio=$3, department=$4, student_id=$5 WHERE id=$6',
        [first_name, last_name, bio, department, student_id, user.id]
      );
      req.session.user = { ...req.session.user, first_name, last_name };
      const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
      return reply.view('user/profile.ejs', {
        title: 'My Profile', user: req.session.user, profile: userRes.rows[0], error: null, success: 'Profile updated!', currentPage: 'profile'
      });
    } catch (err) {
      const userRes = await db.query('SELECT * FROM users WHERE id = $1', [user.id]);
      return reply.view('user/profile.ejs', {
        title: 'My Profile', user, profile: userRes.rows[0], error: 'Failed to update profile', success: null, currentPage: 'profile'
      });
    }
  });
};
