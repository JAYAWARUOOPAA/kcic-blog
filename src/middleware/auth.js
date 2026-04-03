const db = require('../../config/database');

const requireAuth = async (req, reply) => {
  if (!req.session || !req.session.user) {
    req.session.returnTo = req.url;
    return reply.redirect('/auth/login');
  }
};

const requireAdmin = async (req, reply) => {
  if (!req.session || !req.session.user) {
    return reply.redirect('/auth/login');
  }
  if (req.session.user.role !== 'admin') {
    return reply.status(403).view('public/403.ejs', {
      user: req.session.user,
      title: 'Access Denied'
    });
  }
};

const requireGuest = async (req, reply) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return reply.redirect('/admin/dashboard');
    }
    return reply.redirect('/user/dashboard');
  }
};

const loadUser = async (req, reply) => {
  if (req.session && req.session.user) {
    try {
      const result = await db.query(
        'SELECT id, username, email, role, first_name, last_name, avatar_url FROM users WHERE id = $1 AND is_active = true',
        [req.session.user.id]
      );
      if (result.rows.length > 0) {
        req.session.user = result.rows[0];
      } else {
        delete req.session.user;
      }
    } catch (err) {
      console.error('Load user error:', err);
    }
  }
};

module.exports = { requireAuth, requireAdmin, requireGuest, loadUser };
