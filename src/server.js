require('dotenv').config();

const fastify = require('fastify')({
logger: true,
trustProxy: true
});

const path = require('path');

// Static files
fastify.register(require('@fastify/static'), {
root: path.join(__dirname, '../public'),
prefix: '/public/'
});

// Plugins
fastify.register(require('@fastify/formbody'));

fastify.register(require('@fastify/multipart'), {
limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

fastify.register(require('@fastify/cookie'));

// Session config
fastify.register(require('@fastify/session'), {
secret: process.env.SESSION_SECRET,
cookie: {
secure: process.env.NODE_ENV === 'production',
httpOnly: true,
sameSite: 'none',
maxAge: 86400000 * 7 // 7 days
},
saveUninitialized: false
});

// Template engine (EJS)
fastify.register(require('@fastify/view'), {
engine: { ejs: require('ejs') },
root: path.join(__dirname, '../views'),
layout: false,
options: { rmWhitespace: false }
});

// Auth helpers
fastify.decorateRequest('isAuthenticated', function () {
return !!(this.session && this.session.user);
});

fastify.decorateRequest('isAdmin', function () {
return !!(
this.session &&
this.session.user &&
this.session.user.role === 'admin'
);
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
user: req.session?.user || null,
title: '404 - Page Not Found'
});
});

// Error handler
fastify.setErrorHandler(async (error, req, reply) => {
console.error(error);

const statusCode = error.statusCode || 500;

return reply.status(statusCode).view('public/error.ejs', {
user: req.session?.user || null,
title: 'Error',
error:
process.env.NODE_ENV === 'development'
? error.message
: 'An error occurred'
});
});

// Start server
const start = async () => {
try {
const PORT = process.env.PORT || 3000;

```
await fastify.listen({
  port: PORT,
  host: '0.0.0.0'
});

console.log("KCIC Academic Blog running on port " + PORT);
```

} catch (err) {
fastify.log.error(err);
process.exit(1);
}
};

start();
