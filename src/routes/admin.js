const db = require('../../config/database');
const slugify = require('slugify');
const { requireAdmin } = require('../middleware/auth');

module.exports = async function adminRoutes(fastify, opts) {

  // Admin Dashboard
  fastify.get('/dashboard', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    try {
      const [statsRes, recentArticlesRes, pendingRes, recentUsersRes, announcementsRes] = await Promise.all([
        db.query(`SELECT 
          (SELECT COUNT(*) FROM articles WHERE status='published') as published_articles,
          (SELECT COUNT(*) FROM articles WHERE status='pending') as pending_articles,
          (SELECT COUNT(*) FROM users WHERE role='user') as total_students,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COUNT(*) FROM categories) as total_categories,
          (SELECT COALESCE(SUM(views),0) FROM articles) as total_views,
          (SELECT COUNT(*) FROM comments) as total_comments,
          (SELECT COUNT(*) FROM announcements WHERE is_active=true) as active_announcements`),
        db.query(`SELECT a.*, u.first_name, u.last_name, c.name as category_name FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id ORDER BY a.created_at DESC LIMIT 8`),
        db.query(`SELECT a.*, u.first_name, u.last_name, u.email FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE a.status='pending' ORDER BY a.created_at ASC LIMIT 5`),
        db.query(`SELECT id, username, email, role, first_name, last_name, created_at FROM users ORDER BY created_at DESC LIMIT 5`),
        db.query(`SELECT * FROM announcements ORDER BY created_at DESC LIMIT 3`)
      ]);

      const viewsRes = await db.query(`SELECT DATE(published_at) as date, SUM(views) as views FROM articles WHERE status='published' AND published_at > NOW() - INTERVAL '30 days' GROUP BY DATE(published_at) ORDER BY date`);

      return reply.view('admin/dashboard.ejs', {
        title: 'Admin Dashboard - KCIC Academic Blog',
        user, stats: statsRes.rows[0],
        recentArticles: recentArticlesRes.rows,
        pendingArticles: pendingRes.rows,
        recentUsers: recentUsersRes.rows,
        announcements: announcementsRes.rows,
        viewsData: viewsRes.rows,
        currentPage: 'dashboard'
      });
    } catch (err) {
      console.error(err);
      return reply.view('admin/dashboard.ejs', { title: 'Admin Dashboard', user, stats: {}, recentArticles: [], pendingArticles: [], recentUsers: [], announcements: [], viewsData: [], currentPage: 'dashboard' });
    }
  });

  // Manage Articles
  fastify.get('/articles', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const offset = (page - 1) * limit;
    const status = req.query.status || 'all';
    const search = req.query.search || '';

    try {
      let where = '1=1';
      let params = [];
      let pc = 0;
      if (status !== 'all') { pc++; where += ` AND a.status = $${pc}`; params.push(status); }
      if (search) { pc++; where += ` AND (a.title ILIKE $${pc} OR u.username ILIKE $${pc})`; params.push(`%${search}%`); }

      const [articlesRes, countRes] = await Promise.all([
        db.query(`SELECT a.*, u.first_name, u.last_name, u.email, u.username, c.name as category_name FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id WHERE ${where} ORDER BY a.created_at DESC LIMIT $${pc+1} OFFSET $${pc+2}`, [...params, limit, offset]),
        db.query(`SELECT COUNT(*) FROM articles a LEFT JOIN users u ON a.author_id = u.id WHERE ${where}`, params)
      ]);

      return reply.view('admin/articles.ejs', {
        title: 'Manage Articles', user,
        articles: articlesRes.rows, currentStatus: status, search,
        pagination: { page, totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit), total: parseInt(countRes.rows[0].count) },
        currentPage: 'articles',
        success: req.query.success || null
      });
    } catch (err) {
      console.error(err);
      return reply.view('admin/articles.ejs', { title: 'Manage Articles', user, articles: [], currentStatus: status, search, pagination: { page: 1, totalPages: 0, total: 0 }, currentPage: 'articles', success: null });
    }
  });

  // Review Article (approve/reject)
  fastify.get('/articles/:id/review', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    try {
      const articleRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name, u.email, u.username, u.department, c.name as category_name FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id WHERE a.id = $1`, [req.params.id]
      );
      if (articleRes.rows.length === 0) return reply.redirect('/admin/articles');
      return reply.view('admin/review-article.ejs', {
        title: 'Review Article', user, article: articleRes.rows[0], currentPage: 'articles'
      });
    } catch (err) {
      return reply.redirect('/admin/articles');
    }
  });

  // Approve article
  fastify.post('/articles/:id/approve', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    try {
      await db.query(
        `UPDATE articles SET status='published', reviewed_by=$1, reviewed_at=NOW(), published_at=NOW(), rejection_reason=NULL WHERE id=$2`,
        [user.id, req.params.id]
      );
      // Notify author
      const articleRes = await db.query('SELECT author_id, title FROM articles WHERE id=$1', [req.params.id]);
      if (articleRes.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'article_approved', 'Article Approved!', $2, $3)`,
          [articleRes.rows[0].author_id, `Your article "${articleRes.rows[0].title}" has been approved and published.`, `/user/my-articles`]
        );
      }
      return reply.redirect('/admin/articles?success=Article+approved+and+published');
    } catch (err) {
      return reply.redirect('/admin/articles');
    }
  });

  // Reject article
  fastify.post('/articles/:id/reject', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    const { rejection_reason } = req.body;
    try {
      await db.query(
        `UPDATE articles SET status='rejected', reviewed_by=$1, reviewed_at=NOW(), rejection_reason=$2 WHERE id=$3`,
        [user.id, rejection_reason || 'Does not meet publishing standards', req.params.id]
      );
      const articleRes = await db.query('SELECT author_id, title FROM articles WHERE id=$1', [req.params.id]);
      if (articleRes.rows.length > 0) {
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'article_rejected', 'Article Rejected', $2, $3)`,
          [articleRes.rows[0].author_id, `Your article "${articleRes.rows[0].title}" was not approved. Reason: ${rejection_reason}`, `/user/my-articles`]
        );
      }
      return reply.redirect('/admin/articles?success=Article+rejected');
    } catch (err) {
      return reply.redirect('/admin/articles');
    }
  });

  // Delete article (admin)
  fastify.post('/articles/:id/delete', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('DELETE FROM articles WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/articles?success=Article+deleted');
  });

  // Manage Users
  fastify.get('/users', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    const search = req.query.search || '';
    const role = req.query.role || 'all';
    const page = parseInt(req.query.page) || 1;
    const limit = 15;
    const offset = (page - 1) * limit;

    try {
      let where = '1=1';
      let params = [];
      let pc = 0;
      if (role !== 'all') { pc++; where += ` AND role = $${pc}`; params.push(role); }
      if (search) { pc++; where += ` AND (username ILIKE $${pc} OR email ILIKE $${pc} OR first_name ILIKE $${pc})`; params.push(`%${search}%`); }

      const [usersRes, countRes] = await Promise.all([
        db.query(`SELECT u.*, (SELECT COUNT(*) FROM articles WHERE author_id = u.id) as article_count FROM users u WHERE ${where} ORDER BY u.created_at DESC LIMIT $${pc+1} OFFSET $${pc+2}`, [...params, limit, offset]),
        db.query(`SELECT COUNT(*) FROM users WHERE ${where}`, params)
      ]);

      return reply.view('admin/users.ejs', {
        title: 'Manage Users', user, users: usersRes.rows, search, currentRole: role,
        pagination: { page, totalPages: Math.ceil(parseInt(countRes.rows[0].count) / limit), total: parseInt(countRes.rows[0].count) },
        currentPage: 'users', success: req.query.success || null
      });
    } catch (err) {
      return reply.view('admin/users.ejs', { title: 'Manage Users', user, users: [], search, currentRole: role, pagination: { page: 1, totalPages: 0, total: 0 }, currentPage: 'users', success: null });
    }
  });

  // Toggle user status
  fastify.post('/users/:id/toggle', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('UPDATE users SET is_active = NOT is_active WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/users?success=User+status+updated');
  });

  // Change user role
  fastify.post('/users/:id/role', { preHandler: requireAdmin }, async (req, reply) => {
    const { role } = req.body;
    await db.query('UPDATE users SET role = $1 WHERE id = $2', [role, req.params.id]).catch(console.error);
    return reply.redirect('/admin/users?success=User+role+updated');
  });

  // Announcements
  fastify.get('/announcements', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    try {
      const announcementsRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name FROM announcements a LEFT JOIN users u ON a.author_id = u.id ORDER BY a.created_at DESC`
      );
      return reply.view('admin/announcements.ejs', {
        title: 'Manage Announcements', user, announcements: announcementsRes.rows,
        currentPage: 'announcements', success: req.query.success || null
      });
    } catch (err) {
      return reply.view('admin/announcements.ejs', { title: 'Announcements', user, announcements: [], currentPage: 'announcements', success: null });
    }
  });

  // Create Announcement
  fastify.get('/announcements/create', { preHandler: requireAdmin }, async (req, reply) => {
    return reply.view('admin/create-announcement.ejs', {
      title: 'Create Announcement', user: req.session.user, error: null, currentPage: 'announcements'
    });
  });

  fastify.post('/announcements/create', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    const { title, content, priority, target_role, expires_at } = req.body;
    try {
      await db.query(
        `INSERT INTO announcements (title, content, author_id, priority, target_role, expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
        [title, content, user.id, priority || 'normal', target_role || 'all', expires_at || null]
      );
      return reply.redirect('/admin/announcements?success=Announcement+created');
    } catch (err) {
      return reply.view('admin/create-announcement.ejs', { title: 'Create Announcement', user, error: 'Failed to create announcement', currentPage: 'announcements' });
    }
  });

  // Toggle announcement
  fastify.post('/announcements/:id/toggle', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('UPDATE announcements SET is_active = NOT is_active WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/announcements?success=Announcement+updated');
  });

  // Delete announcement
  fastify.post('/announcements/:id/delete', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('DELETE FROM announcements WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/announcements?success=Announcement+deleted');
  });

  // Categories
  fastify.get('/categories', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    const categoriesRes = await db.query(`SELECT c.*, COUNT(a.id) as article_count FROM categories c LEFT JOIN articles a ON c.id = a.category_id GROUP BY c.id ORDER BY c.name`).catch(() => ({ rows: [] }));
    return reply.view('admin/categories.ejs', {
      title: 'Manage Categories', user, categories: categoriesRes.rows,
      currentPage: 'categories', success: req.query.success || null, error: null
    });
  });

  fastify.post('/categories/create', { preHandler: requireAdmin }, async (req, reply) => {
    const { name, description, color, icon } = req.body;
    const slug = slugify(name, { lower: true, strict: true });
    try {
      await db.query('INSERT INTO categories (name, slug, description, color, icon) VALUES ($1,$2,$3,$4,$5)', [name, slug, description, color || '#1a3c5e', icon || 'fas fa-folder']);
      return reply.redirect('/admin/categories?success=Category+created');
    } catch (err) {
      const categoriesRes = await db.query(`SELECT c.*, COUNT(a.id) as article_count FROM categories c LEFT JOIN articles a ON c.id = a.category_id GROUP BY c.id ORDER BY c.name`);
      return reply.view('admin/categories.ejs', { title: 'Manage Categories', user: req.session.user, categories: categoriesRes.rows, currentPage: 'categories', success: null, error: 'Category name already exists' });
    }
  });

  fastify.post('/categories/:id/delete', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('DELETE FROM categories WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/categories?success=Category+deleted');
  });

  // Analytics
  fastify.get('/analytics', { preHandler: requireAdmin }, async (req, reply) => {
    const user = req.session.user;
    try {
      const [statsRes, topArticlesRes, categoryStatsRes, userGrowthRes, dailyViewsRes] = await Promise.all([
        db.query(`SELECT 
          (SELECT COUNT(*) FROM articles WHERE status='published') as total_published,
          (SELECT COUNT(*) FROM articles WHERE status='pending') as total_pending,
          (SELECT COUNT(*) FROM users) as total_users,
          (SELECT COALESCE(SUM(views),0) FROM articles) as total_views,
          (SELECT COUNT(*) FROM comments) as total_comments,
          (SELECT COUNT(*) FROM article_likes) as total_likes`),
        db.query(`SELECT a.title, a.slug, a.views, a.published_at, u.first_name, u.last_name, c.name as category_name,
          (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes,
          (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status='published' ORDER BY a.views DESC LIMIT 10`),
        db.query(`SELECT c.name, c.color, COUNT(a.id) as article_count, COALESCE(SUM(a.views),0) as total_views FROM categories c LEFT JOIN articles a ON c.id = a.category_id AND a.status='published' GROUP BY c.id ORDER BY article_count DESC`),
        db.query(`SELECT DATE_TRUNC('month', created_at) as month, COUNT(*) as count FROM users GROUP BY month ORDER BY month DESC LIMIT 12`),
        db.query(`SELECT DATE(published_at) as date, SUM(views) as views, COUNT(*) as articles FROM articles WHERE status='published' AND published_at > NOW() - INTERVAL '30 days' GROUP BY DATE(published_at) ORDER BY date`)
      ]);

      return reply.view('admin/analytics.ejs', {
        title: 'Analytics Dashboard', user,
        stats: statsRes.rows[0],
        topArticles: topArticlesRes.rows,
        categoryStats: categoryStatsRes.rows,
        userGrowth: userGrowthRes.rows,
        dailyViews: dailyViewsRes.rows,
        currentPage: 'analytics'
      });
    } catch (err) {
      console.error(err);
      return reply.view('admin/analytics.ejs', { title: 'Analytics', user, stats: {}, topArticles: [], categoryStats: [], userGrowth: [], dailyViews: [], currentPage: 'analytics' });
    }
  });

  // Feature/unfeature article
  fastify.post('/articles/:id/feature', { preHandler: requireAdmin }, async (req, reply) => {
    await db.query('UPDATE articles SET is_featured = NOT is_featured WHERE id = $1', [req.params.id]).catch(console.error);
    return reply.redirect('/admin/articles?success=Article+updated');
  });
};
