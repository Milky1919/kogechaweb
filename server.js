const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const fm = require('front-matter');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 80;

// Enable proxy trust for correct protocol/host detection behind CapRover Nginx
app.enable('trust proxy');

// Middleware: Redirect all non-kogecha.org traffic to root (Handles aliases & subdomains)
app.use((req, res, next) => {
    const host = req.hostname;
    // Skip redirect for localhost (dev) or if already on correct domain
    if (host === 'localhost' || host === 'kogecha.org') {
        return next();
    }
    res.redirect(301, `https://kogecha.org${req.originalUrl}`);
});

// Configure Session Middleware
app.use(session({
    secret: 'kogecha-secret-key-change-in-production', // Needs a secure key in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.NODE_ENV === 'production' } // Note: requires HTTPS in production
}));

app.use(express.urlencoded({ extended: true })); // Middleware to parse form data

app.set('view engine', 'ejs');
app.use(express.static('public'));

const CONTENT_DIR = path.join(__dirname, 'content');

// Helper to format date as JST YYYY/MM/DD
function formatDate(date) {
    if (!date) return '1970/01/01';
    const d = new Date(date);
    return d.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'Asia/Tokyo'
    });
}

// Helper to get all posts
function getPosts() {
    const files = fs.readdirSync(CONTENT_DIR);
    return files
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
            const { attributes } = fm(content);
            return {
                ...attributes, // Spread first to copy raw properties
                slug: file.replace('.md', ''),
                title: attributes.title || 'No Title',
                date: formatDate(attributes.date), // Format date (overwrites raw date)
            };
        })
        .sort((a, b) => (a.date < b.date ? 1 : -1)); // Simple string sort works for YYYY/MM/DD
}

// Homepage: List all posts
app.get('/', (req, res) => {
    const posts = getPosts();
    // Initialize unlockedPosts session object if it doesn't exist
    if (!req.session.unlockedPosts) {
        req.session.unlockedPosts = {};
    }
    res.render('index', { posts, unlockedPosts: req.session.unlockedPosts });
});

// Post Page: Render specific markdown or password prompt
app.get('/post/:slug', (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(CONTENT_DIR, slug + '.md');

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Post not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { attributes, body } = fm(content);

    // Check if the post has a password
    if (attributes.password) {
        // Initialize unlockedPosts in session if not present
        if (!req.session.unlockedPosts) {
            req.session.unlockedPosts = {};
        }

        const queryPass = req.query.pass;

        // Check query parameter direct access
        if (queryPass) {
            if (queryPass === attributes.password) {
                // Success: unlock in session and render
                req.session.unlockedPosts[slug] = true;
                const html = marked.parse(body);
                return res.render('post', {
                    title: attributes.title,
                    date: formatDate(attributes.date),
                    html
                });
            } else {
                // Failure: redirect to index
                return res.redirect('/');
            }
        }

        // Check if already unlocked in session
        if (!req.session.unlockedPosts[slug]) {
            // Not unlocked: render password prompt
            return res.render('password', {
                title: attributes.title,
                slug: slug
            });
        }
    }

    // No password OR already unlocked: Render normal post
    const html = marked.parse(body);

    res.render('post', {
        title: attributes.title,
        date: formatDate(attributes.date),
        html
    });
});

// Password verification endpoint
app.post('/post/:slug/verify', (req, res) => {
    const slug = req.params.slug;
    const filePath = path.join(CONTENT_DIR, slug + '.md');

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Post not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { attributes } = fm(content);

    const submittedPassword = req.body.password;

    if (attributes.password && submittedPassword === attributes.password) {
        // Success
        if (!req.session.unlockedPosts) {
            req.session.unlockedPosts = {};
        }
        req.session.unlockedPosts[slug] = true;
        res.redirect(`/post/${slug}`);
    } else {
        // Failure: redirect to index as requested
        res.redirect('/');
    }
});

// 404 handler (Redirect to root)
app.use((req, res, next) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
