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

// Helper to get all posts
function getPosts() {
    const files = fs.readdirSync(CONTENT_DIR);
    return files
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const content = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8');
            const { attributes } = fm(content);
            return {
                slug: file.replace('.md', ''),
                title: attributes.title || 'No Title',
                date: attributes.date || '1970-01-01',
                ...attributes
            };
        })
        .sort((a, b) => new Date(b.date) - new Date(a.date));
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
        date: attributes.date,
        html 
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
