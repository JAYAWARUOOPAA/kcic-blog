const db = require('../../config/database');

module.exports = async function publicRoutes(fastify, opts) {

  // Home page
  fastify.get('/', async (req, reply) => {
    const user = req.session.user || null;
    try {
      const [featuredRes, recentRes, categoriesRes, announcementsRes, statsRes] = await Promise.all([
        db.query(`SELECT a.*, u.first_name, u.last_name, u.username, c.name as category_name, c.slug as category_slug, c.color as category_color,
          (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments_count
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published' AND a.is_featured = true ORDER BY a.published_at DESC LIMIT 3`),
        db.query(`SELECT a.*, u.first_name, u.last_name, u.username, c.name as category_name, c.slug as category_slug, c.color as category_color,
          (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments_count
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published' ORDER BY a.published_at DESC LIMIT 9`),
        db.query(`SELECT c.*, COUNT(a.id) as article_count FROM categories c LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published' GROUP BY c.id ORDER BY article_count DESC`),
        db.query(`SELECT * FROM announcements WHERE is_active = true AND (expires_at IS NULL OR expires_at > NOW()) AND (target_role = 'all' OR target_role = $1) ORDER BY priority DESC, created_at DESC LIMIT 3`, [user ? user.role : 'all']),
        db.query(`SELECT (SELECT COUNT(*) FROM articles WHERE status='published') as total_articles, (SELECT COUNT(*) FROM users WHERE role='user') as total_students, (SELECT COUNT(*) FROM categories) as total_categories`)
      ]);

      return reply.view('public/home.ejs', {
        title: 'Home - KCIC Academic Blog',
        user,
        featured: featuredRes.rows,
        articles: recentRes.rows,
        categories: categoriesRes.rows,
        announcements: announcementsRes.rows,
        stats: statsRes.rows[0],
        currentPage: 'home'
      });
    } catch (err) {
      console.error(err);
      return reply.view('public/home.ejs', { title: 'Home - KCIC Academic Blog', user, featured: [], articles: [], categories: [], announcements: [], stats: {}, currentPage: 'home' });
    }
  });

  // Articles listing
  fastify.get('/articles', async (req, reply) => {
    const user = req.session.user || null;
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const offset = (page - 1) * limit;
    const category = req.query.category || null;
    const sort = req.query.sort || 'latest';

    let orderBy = 'a.published_at DESC';
    if (sort === 'popular') orderBy = 'a.views DESC';
    if (sort === 'liked') orderBy = 'likes_count DESC';

    try {
      let whereClause = "a.status = 'published'";
      let params = [];
      let paramCount = 0;

      if (category) {
        paramCount++;
        whereClause += ` AND c.slug = $${paramCount}`;
        params.push(category);
      }

      const [articlesRes, countRes, categoriesRes] = await Promise.all([
        db.query(`SELECT a.*, u.first_name, u.last_name, u.username, c.name as category_name, c.slug as category_slug, c.color as category_color,
          (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments_count
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE ${whereClause} ORDER BY ${orderBy} LIMIT $${paramCount+1} OFFSET $${paramCount+2}`,
          [...params, limit, offset]),
        db.query(`SELECT COUNT(*) FROM articles a LEFT JOIN categories c ON a.category_id = c.id WHERE ${whereClause}`, params),
        db.query(`SELECT c.*, COUNT(a.id) as article_count FROM categories c LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published' GROUP BY c.id ORDER BY c.name`)
      ]);

      const totalArticles = parseInt(countRes.rows[0].count);
      const totalPages = Math.ceil(totalArticles / limit);

      return reply.view('public/articles.ejs', {
        title: 'Articles - KCIC Academic Blog',
        user,
        articles: articlesRes.rows,
        categories: categoriesRes.rows,
        currentCategory: category,
        currentSort: sort,
        pagination: { page, totalPages, totalArticles, limit },
        currentPage: 'articles'
      });
    } catch (err) {
      console.error(err);
      return reply.view('public/articles.ejs', { title: 'Articles', user, articles: [], categories: [], pagination: { page: 1, totalPages: 0, totalArticles: 0, limit }, currentPage: 'articles' });
    }
  });

  // Single article
  fastify.get('/article/:slug', async (req, reply) => {
    const user = req.session.user || null;
    try {
      const articleRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name, u.username, u.bio as author_bio, u.avatar_url as author_avatar, u.department,
          c.name as category_name, c.slug as category_slug, c.color as category_color,
          (SELECT COUNT(*) FROM article_likes WHERE article_id = a.id) as likes_count,
          (SELECT COUNT(*) FROM comments WHERE article_id = a.id) as comments_count,
          (SELECT COUNT(*) FROM saved_articles WHERE article_id = a.id) as saves_count
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.slug = $1 AND a.status = 'published'`, [req.params.slug]
      );

      if (articleRes.rows.length === 0) {
        return reply.status(404).view('public/404.ejs', { user, title: 'Article Not Found' });
      }

      const article = articleRes.rows[0];

      // Increment views
      await db.query('UPDATE articles SET views = views + 1 WHERE id = $1', [article.id]);

      // Track reading history if logged in
      if (user) {
        await db.query(
          `INSERT INTO reading_history (user_id, article_id) VALUES ($1, $2) ON CONFLICT (user_id, article_id) DO UPDATE SET read_at = CURRENT_TIMESTAMP`,
          [user.id, article.id]
        );
      }

      // Check if saved/liked by current user
      let isSaved = false, isLiked = false;
      if (user) {
        const [savedRes, likedRes] = await Promise.all([
          db.query('SELECT id FROM saved_articles WHERE user_id = $1 AND article_id = $2', [user.id, article.id]),
          db.query('SELECT id FROM article_likes WHERE user_id = $1 AND article_id = $2', [user.id, article.id])
        ]);
        isSaved = savedRes.rows.length > 0;
        isLiked = likedRes.rows.length > 0;
      }

      // Comments
      const commentsRes = await db.query(
        `SELECT c.*, u.first_name, u.last_name, u.username, u.avatar_url FROM comments c
          LEFT JOIN users u ON c.user_id = u.id WHERE c.article_id = $1 AND c.parent_id IS NULL AND c.is_approved = true ORDER BY c.created_at DESC`,
        [article.id]
      );

      // Related articles
      const relatedRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name, c.name as category_name, c.color as category_color
          FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
          WHERE a.status = 'published' AND a.category_id = $1 AND a.id != $2 ORDER BY a.published_at DESC LIMIT 4`,
        [article.category_id, article.id]
      );

      return reply.view('public/article.ejs', {
        title: `${article.title} - KCIC Academic Blog`,
        user, article,
        comments: commentsRes.rows,
        related: relatedRes.rows,
        isSaved, isLiked,
        currentPage: 'articles'
      });
    } catch (err) {
      console.error(err);
      return reply.status(500).view('public/error.ejs', { user, title: 'Error', error: 'Failed to load article' });
    }
  });

  // Categories page
  fastify.get('/categories', async (req, reply) => {
    const user = req.session.user || null;
    try {
      const categoriesRes = await db.query(
        `SELECT c.*, COUNT(a.id) as article_count FROM categories c 
          LEFT JOIN articles a ON c.id = a.category_id AND a.status = 'published' 
          GROUP BY c.id ORDER BY c.name`
      );
      return reply.view('public/categories.ejs', {
        title: 'Categories - KCIC Academic Blog',
        user, categories: categoriesRes.rows, currentPage: 'categories'
      });
    } catch (err) {
      return reply.view('public/categories.ejs', { title: 'Categories', user, categories: [], currentPage: 'categories' });
    }
  });

  // Search
  fastify.get('/search', async (req, reply) => {
    const user = req.session.user || null;
    const query = req.query.q || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
      let articles = [], total = 0;
      if (query.trim()) {
        const [resultsRes, countRes] = await Promise.all([
          db.query(
            `SELECT a.*, u.first_name, u.last_name, u.username, c.name as category_name, c.slug as category_slug, c.color as category_color,
              ts_rank(to_tsvector('english', a.title || ' ' || COALESCE(a.content, '')), plainto_tsquery('english', $1)) as rank
              FROM articles a LEFT JOIN users u ON a.author_id = u.id LEFT JOIN categories c ON a.category_id = c.id
              WHERE a.status = 'published' AND to_tsvector('english', a.title || ' ' || COALESCE(a.content, '')) @@ plainto_tsquery('english', $1)
              ORDER BY rank DESC, a.published_at DESC LIMIT $2 OFFSET $3`,
            [query, limit, offset]
          ),
          db.query(
            `SELECT COUNT(*) FROM articles a WHERE a.status = 'published' AND to_tsvector('english', a.title || ' ' || COALESCE(a.content, '')) @@ plainto_tsquery('english', $1)`,
            [query]
          )
        ]);
        articles = resultsRes.rows;
        total = parseInt(countRes.rows[0].count);
      }

      return reply.view('public/search.ejs', {
        title: `Search: ${query} - KCIC Academic Blog`,
        user, articles, query,
        pagination: { page, totalPages: Math.ceil(total / limit), total, limit },
        currentPage: 'search'
      });
    } catch (err) {
      console.error(err);
      return reply.view('public/search.ejs', { title: 'Search', user, articles: [], query, pagination: { page: 1, totalPages: 0, total: 0, limit }, currentPage: 'search' });
    }
  });

  // About page
  fastify.get('/about', async (req, reply) => {
    const user = req.session.user || null;
    const teamRes = await db.query(`SELECT id, username, first_name, last_name, bio, department, avatar_url, role FROM users WHERE is_active = true AND role = 'admin'`).catch(() => ({ rows: [] }));
    return reply.view('public/about.ejs', {
      title: 'About - KCIC Academic Blog',
      user, team: teamRes.rows, currentPage: 'about'
    });
  });

  // Announcements page
  fastify.get('/announcements', async (req, reply) => {
    const user = req.session.user || null;
    try {
      const announcementsRes = await db.query(
        `SELECT a.*, u.first_name, u.last_name FROM announcements a LEFT JOIN users u ON a.author_id = u.id
          WHERE a.is_active = true AND (a.expires_at IS NULL OR a.expires_at > NOW())
          AND (a.target_role = 'all' OR a.target_role = $1) ORDER BY a.priority DESC, a.created_at DESC`,
        [user ? user.role : 'all']
      );
      return reply.view('public/announcements.ejs', {
        title: 'Announcements - KCIC Academic Blog',
        user, announcements: announcementsRes.rows, currentPage: 'announcements'
      });
    } catch (err) {
      return reply.view('public/announcements.ejs', { title: 'Announcements', user, announcements: [], currentPage: 'announcements' });
    }
  });

  // Post comment
  fastify.post('/article/:slug/comment', async (req, reply) => {
    if (!req.session.user) return reply.redirect('/auth/login');
    const { content } = req.body;
    try {
      const articleRes = await db.query('SELECT id FROM articles WHERE slug = $1 AND status = $2', [req.params.slug, 'published']);
      if (articleRes.rows.length === 0) return reply.redirect('/articles');
      await db.query('INSERT INTO comments (article_id, user_id, content) VALUES ($1, $2, $3)', [articleRes.rows[0].id, req.session.user.id, content]);
    } catch (err) { console.error(err); }
    return reply.redirect(`/article/${req.params.slug}#comments`);
  });
};
