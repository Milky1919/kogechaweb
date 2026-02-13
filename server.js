const express = require('express');
const fs = require('fs');
const path = require('path');
const marked = require('marked');
const fm = require('front-matter');

const app = express();
const PORT = process.env.PORT || 80;

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
    res.render('index', { posts });
});

// Post Page: Render specific markdown
app.get('/post/:slug', (req, res) => {
    const filePath = path.join(CONTENT_DIR, req.params.slug + '.md');

    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Post not found');
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const { attributes, body } = fm(content);
    const html = marked.parse(body);

    res.render('post', {
        title: attributes.title,
        date: formatDate(attributes.date),
        html
    });
});

// 404 handler (Redirect to root)
app.use((req, res, next) => {
    res.redirect('/');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
