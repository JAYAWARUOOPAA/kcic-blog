-- KCIC Academic Blog Database Schema
-- Run this in pgAdmin or psql to set up the database

CREATE DATABASE kcic_blog;

\c kcic_blog;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user', 'moderator')),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    department VARCHAR(100),
    student_id VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Categories table
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    slug VARCHAR(120) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7) DEFAULT '#1a3c5e',
    icon VARCHAR(50) DEFAULT 'fas fa-folder',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Articles table
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    uuid UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(600) UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT,
    cover_image VARCHAR(500),
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'archived')),
    rejection_reason TEXT,
    reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    views INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    tags TEXT[], -- array of tags
    reading_time INTEGER DEFAULT 1, -- minutes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP
);

-- Comments table
CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_approved BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Saved articles
CREATE TABLE saved_articles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
);

-- Reading history
CREATE TABLE reading_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_duration INTEGER DEFAULT 0, -- seconds
    UNIQUE(user_id, article_id)
);

-- Announcements
CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    content TEXT NOT NULL,
    author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    is_active BOOLEAN DEFAULT true,
    target_role VARCHAR(20) DEFAULT 'all' CHECK (target_role IN ('all', 'user', 'admin')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Article likes
CREATE TABLE article_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, article_id)
);

-- Notifications
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    link VARCHAR(500),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_author ON articles(author_id);
CREATE INDEX idx_articles_category ON articles(category_id);
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_search ON articles USING gin(to_tsvector('english', title || ' ' || COALESCE(content, '')));
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_reading_history_user ON reading_history(user_id);
CREATE INDEX idx_saved_articles_user ON saved_articles(user_id);

-- Insert default categories
INSERT INTO categories (name, slug, description, color, icon) VALUES
('Academic Research', 'academic-research', 'Peer-reviewed academic research papers and studies', '#1a3c5e', 'fas fa-microscope'),
('Science & Technology', 'science-technology', 'Articles on science and technological advancements', '#0d6efd', 'fas fa-flask'),
('Arts & Humanities', 'arts-humanities', 'Literature, history, philosophy and cultural studies', '#6f42c1', 'fas fa-palette'),
('Business & Economics', 'business-economics', 'Business studies, economics and management', '#198754', 'fas fa-chart-line'),
('Health & Medicine', 'health-medicine', 'Medical research and health sciences', '#dc3545', 'fas fa-heartbeat'),
('Law & Governance', 'law-governance', 'Legal studies and governance research', '#fd7e14', 'fas fa-balance-scale'),
('Social Sciences', 'social-sciences', 'Sociology, psychology and social studies', '#20c997', 'fas fa-users'),
('Campus Life', 'campus-life', 'Student life, events and college news', '#ffc107', 'fas fa-graduation-cap');

-- Insert default admin user (password: Admin@123)
INSERT INTO users (username, email, password_hash, role, first_name, last_name, is_active, is_verified) VALUES
('admin', 'admin@kcic.edu', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.s5uBDi', 'admin', 'System', 'Administrator', true, true);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- View for article statistics
CREATE VIEW article_stats AS
SELECT 
    a.id,
    a.title,
    a.status,
    a.views,
    COUNT(DISTINCT al.id) as likes_count,
    COUNT(DISTINCT c.id) as comments_count,
    COUNT(DISTINCT sa.id) as saves_count,
    u.first_name || ' ' || u.last_name as author_name,
    cat.name as category_name
FROM articles a
LEFT JOIN article_likes al ON a.id = al.article_id
LEFT JOIN comments c ON a.id = c.article_id
LEFT JOIN saved_articles sa ON a.id = sa.article_id
LEFT JOIN users u ON a.author_id = u.id
LEFT JOIN categories cat ON a.category_id = cat.id
GROUP BY a.id, a.title, a.status, a.views, u.first_name, u.last_name, cat.name;
