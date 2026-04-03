# KCIC Academic Blog 🎓
### Kings Cornerstone International College — Full Stack Academic Blog Platform

---

## 📁 Project Structure

```
kcic-blog/
├── config/
│   └── database.js           # PostgreSQL connection pool
├── database/
│   └── schema.sql            # Full DB schema — run this first!
├── public/
│   ├── css/style.css         # Main stylesheet
│   └── js/main.js            # Frontend JS
├── src/
│   ├── server.js             # Fastify entry point
│   ├── middleware/auth.js    # requireAuth, requireAdmin, etc.
│   └── routes/
│       ├── public.js         # Home, articles, search, about
│       ├── auth.js           # Login, register, forgot/reset password
│       ├── user.js           # User dashboard, articles, profile
│       ├── admin.js          # Admin panel, manage articles/users
│       └── api.js            # AJAX endpoints (like, save, search)
├── views/
│   ├── partials/             # header.ejs, footer.ejs, admin-sidebar.ejs
│   ├── public/               # home, articles, article, categories, search, about...
│   ├── auth/                 # login, register, forgot-password, reset-password
│   ├── user/                 # dashboard, create-article, my-articles, saved, history, profile
│   └── admin/                # dashboard, articles, review-article, users, analytics, announcements...
├── .env                      # Environment variables
└── package.json
```

---

## 🚀 Setup Instructions

### Step 1 — Prerequisites
- **Node.js** v18+ installed
- **PostgreSQL** installed and running
- **pgAdmin 4** (optional, for GUI database management)

---

### Step 2 — Database Setup (PostgreSQL / pgAdmin)

1. Open **pgAdmin** or the `psql` terminal
2. Run the SQL schema:
   ```sql
   -- Option A: In psql terminal
   psql -U postgres -f database/schema.sql

   -- Option B: In pgAdmin
   -- File > Open > select database/schema.sql > Run (F5)
   ```
3. This creates:
   - Database: `kcic_blog`
   - All tables (users, articles, categories, comments, etc.)
   - Default categories (8 academic categories)
   - Default **admin user**: `admin@kcic.edu` / password: `Admin@123`

---

### Step 3 — Configure Environment

Edit `.env` with your settings:

```env
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=kcic_blog
DB_USER=postgres
DB_PASSWORD=your_postgres_password    ← Change this!
SESSION_SECRET=change_this_secret_key ← Change this!
APP_URL=http://localhost:3000
```

---

### Step 4 — Install Dependencies & Start

```bash
cd kcic-blog
npm install
npm start          # production
# or
npm run dev        # development (auto-restart with nodemon)
```

Open: **http://localhost:3000**

---

## 👤 User Roles & Access

### 🛡️ Admin Login
- **URL**: `http://localhost:3000/auth/login`
- **Email**: `admin@kcic.edu`
- **Password**: `Admin@123`
- Select **"Administrator"** role tile before logging in
- Redirects to `/admin/dashboard`

### 👨‍🎓 Student / User Login
- Register at `/auth/register` — select **"Student / User"** role
- Or log in at `/auth/login` — select **"Student / User"** tile
- Redirects to `/user/dashboard`

---

## 📄 All Pages & Routes

### Public Pages
| Page | URL |
|------|-----|
| Home | `/` |
| Articles Listing | `/articles` |
| Single Article | `/article/:slug` |
| Categories | `/categories` |
| Search Results | `/search?q=...` |
| About | `/about` |
| Announcements | `/announcements` |

### Auth Pages
| Page | URL |
|------|-----|
| Login | `/auth/login` |
| Register | `/auth/register` |
| Forgot Password | `/auth/forgot-password` |
| Reset Password | `/auth/reset-password/:token` |
| Logout | `/auth/logout` |

### Student Dashboard (requires login)
| Page | URL |
|------|-----|
| Dashboard | `/user/dashboard` |
| Create Article | `/user/create-article` |
| My Articles | `/user/my-articles` |
| Edit Article | `/user/edit-article/:id` |
| Saved Articles | `/user/saved` |
| Reading History | `/user/history` |
| Profile | `/user/profile` |

### Admin Panel (requires admin role)
| Page | URL |
|------|-----|
| Admin Dashboard | `/admin/dashboard` |
| Manage Articles | `/admin/articles` |
| Review Article | `/admin/articles/:id/review` |
| Manage Users | `/admin/users` |
| Announcements | `/admin/announcements` |
| Create Announcement | `/admin/announcements/create` |
| Categories | `/admin/categories` |
| Analytics | `/admin/analytics` |

---

## ⚙️ Key Features

### Article Workflow
1. Student writes article at `/user/create-article`
2. Submits → status becomes **`pending`**
3. Admin reviews at `/admin/articles/:id/review`
4. Admin **Approves** → article published, student notified ✅
5. Admin **Rejects** with reason → student notified, can edit & resubmit ❌

### Role-Based Access
- **Admin**: Full panel, can manage all articles/users/categories/announcements
- **User**: Own dashboard, write/edit/delete own articles, save/like articles
- Role is selected at login/register time
- Middleware enforces access at every protected route

### Article Status Flow
```
draft → pending → published
                → rejected → (edit) → pending → published
```

---

## 🗄️ Database Tables

| Table | Purpose |
|-------|---------|
| `users` | All accounts (admin + students) |
| `articles` | Blog posts with status workflow |
| `categories` | Article categories |
| `comments` | Article comments |
| `saved_articles` | User bookmarks |
| `reading_history` | Track what users read |
| `announcements` | Admin announcements |
| `article_likes` | Like tracking |
| `notifications` | In-app notifications |

---

## 🔧 Customization

### Change College Name/Branding
- Edit `views/partials/header.ejs` — update brand name
- Edit `views/partials/footer.ejs` — update contact info
- Edit `public/css/style.css` — change `--primary` color variable

### Add Email for Password Reset
In `.env`:
```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your@gmail.com
EMAIL_PASS=your_app_password
```
Then uncomment the nodemailer code in `src/routes/auth.js`

### Deploy to Production
```bash
NODE_ENV=production
# Use a proper SESSION_SECRET (32+ random chars)
# Use SSL/TLS PostgreSQL connection
# Run behind nginx reverse proxy
```

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| `DB connection error` | Check `.env` DB_PASSWORD is correct |
| `relation does not exist` | Run `database/schema.sql` in pgAdmin |
| `Cannot find module` | Run `npm install` |
| Admin page says "Access Denied" | Select "Administrator" tile at login |
| Port already in use | Change `PORT=3001` in `.env` |

---

*Built with: Fastify · EJS · PostgreSQL · Bootstrap 5 · Node.js*
