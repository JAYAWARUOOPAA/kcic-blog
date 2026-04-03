require('dotenv').config();
const fastify = require('fastify')({ 
  logger: process.env.NODE_ENV === 'development',
  trustProxy: true
});
const path = require('path');

// Register plugins
fastify.register(require('@fastify/static'), {
  root: path.join(__dirname, '../public'),
  prefix: '/public/'
});

fastify.register(require('@fastify/formbody'));
fastify.register(require('@fastify/multipart'), {
  limits: {fileSize: 5 * 1024 * 1024 } // 5MB
});

fastify.register(require('@fastify/cookie'));
fastify.register(require('@fastify/session'), {
  secret: 'supersecretkey1234567890abcdef123456',
  cookie: {
    secure: false, // important for localhost
    httpOnly: true,
    maxAge: 86400000 * 7
  },
  saveUninitialized: false
});

// EJS Template Engine
fastify.register(require('@fastify/view'), {
  engine: { ejs: require('ejs') },
  root: path.join(__dirname, '../views'),
  layout: false,
  options: { rmWhitespace: false }
});

// Decorators for auth helpers
fastify.decorateRequest('isAuthenticated', function() {
  return !!(this.session && this.session.user);
});

fastify.decorateRequest('isAdmin', function() {
  return !!(this.session && this.session.user && this.session.user.role === 'admin');
});

// Routes
fastify.register(require('./routes/public'), { prefix: '/' });
fastify.register(require('./routes/auth'), { prefix: '/auth' });
fastify.register(require('./routes/user'), { prefix: '/user' });
fastify.register(require('./routes/admin'), { prefix: '/admin' });
fastify.register(require('./routes/api'), { prefix: '/api' });

// 404 handler
fastify.setNotFoundHandler(async (req, reply) => {
  return reply.view('public/404.ejs', {
    user: req.session.user || null,
    title: '404 - Page Not Found'
  });
});

// Error handler
fastify.setErrorHandler(async (error, req, reply) => {
  console.error(error);
  const statusCode = error.statusCode || 500;
  return reply.status(statusCode).view('public/error.ejs', {
    user: req.session.user || null,
    title: 'Error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred'
  });
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: process.env.PORT || 3000, host: '0.0.0.0' });
    console.log(`🚀 KCIC Academic Blog running on http://localhost:${process.env.PORT || 3000}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
