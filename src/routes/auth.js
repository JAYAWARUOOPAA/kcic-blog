const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const db = require('../../config/database');
const { requireGuest } = require('../middleware/auth');

module.exports = async function authRoutes(fastify, opts) {

// Login page
fastify.get('/login', { preHandler: requireGuest }, async (req, reply) => {
return reply.view('auth/login.ejs', {
title: 'Login - KCIC Academic Blog',
user: null,
error: null,
success: req.query.registered ? 'Account created! Please login.' : null
});
});

// Login POST
fastify.post('/login', async (req, reply) => {
const { email, password, role } = req.body;

```
try {
  const result = await db.query(
    'SELECT * FROM users WHERE email = $1 AND is_active = true',
    [email]
  );

  if (result.rows.length === 0) {
    return reply.view('auth/login.ejs', {
      title: 'Login',
      user: null,
      error: 'Invalid email or password',
      success: null
    });
  }

  const user = result.rows[0];
  const validPassword = await bcrypt.compare(password, user.password_hash);

  if (!validPassword) {
    return reply.view('auth/login.ejs', {
      title: 'Login',
      user: null,
      error: 'Invalid email or password',
      success: null
    });
  }

  if (role === 'admin' && user.role !== 'admin') {
    return reply.view('auth/login.ejs', {
      title: 'Login',
      user: null,
      error: 'You do not have admin privileges',
      success: null
    });
  }

  await db.query(
    'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
    [user.id]
  );

  req.session.user = {
    id: user.id,
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    avatar_url: user.avatar_url
  };

  const returnTo = req.session.returnTo || null;
  delete req.session.returnTo;

  if (returnTo) return reply.redirect(returnTo);
  if (user.role === 'admin') return reply.redirect('/admin/dashboard');

  return reply.redirect('/user/dashboard');

} catch (err) {
  console.error(err);
  return reply.view('auth/login.ejs', {
    title: 'Login',
    user: null,
    error: 'An error occurred. Please try again.',
    success: null
  });
}
```

});

// Register page
fastify.get('/register', { preHandler: requireGuest }, async (req, reply) => {
return reply.view('auth/register.ejs', {
title: 'Register - KCIC Academic Blog',
user: null,
error: null
});
});

// Register POST
fastify.post('/register', async (req, reply) => {
const {
username,
email,
password,
confirm_password,
first_name,
last_name,
department,
student_id,
role
} = req.body;

```
if (password !== confirm_password) {
  return reply.view('auth/register.ejs', {
    title: 'Register',
    user: null,
    error: 'Passwords do not match'
  });
}

if (password.length < 8) {
  return reply.view('auth/register.ejs', {
    title: 'Register',
    user: null,
    error: 'Password must be at least 8 characters'
  });
}

try {
  const existing = await db.query(
    'SELECT id FROM users WHERE email = $1 OR username = $2',
    [email, username]
  );

  if (existing.rows.length > 0) {
    return reply.view('auth/register.ejs', {
      title: 'Register',
      user: null,
      error: 'Email or username already exists'
    });
  }

  const userRole = role === 'admin' ? 'admin' : 'user';
  const hash = await bcrypt.hash(password, 12);

  await db.query(
    `INSERT INTO users 
    (username, email, password_hash, role, first_name, last_name, department, student_id, is_verified) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
    [username, email, hash, userRole, first_name, last_name, department || null, student_id || null]
  );

  return reply.redirect('/auth/login?registered=true');

} catch (err) {
  console.error(err);
  return reply.view('auth/register.ejs', {
    title: 'Register',
    user: null,
    error: 'Registration failed. Please try again.'
  });
}
```

});

// Logout
fastify.get('/logout', async (req, reply) => {
req.session.destroy();
return reply.redirect('/');
});

};
