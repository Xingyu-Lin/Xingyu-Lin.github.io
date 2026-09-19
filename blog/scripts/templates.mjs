import { escape, formatDate } from './render.mjs';

export function navigation(root = '/', blog = '/blog/') {
  return `<nav class="navbar navbar-expand-lg navbar-light fixed-top" id="mainNav" aria-label="Main navigation"><div class="container">
    <a class="navbar-brand" href="${root}#page-top">Xingyu Lin</a>
    <button class="navbar-toggler navbar-toggler-right" type="button" data-toggle="collapse" data-target="#navbarResponsive" aria-controls="navbarResponsive" aria-expanded="false" aria-label="Toggle navigation">Menu <i class="fa fa-bars" aria-hidden="true"></i></button>
    <div class="collapse navbar-collapse" id="navbarResponsive"><ul class="navbar-nav ml-auto">
      <li class="nav-item"><a class="nav-link" href="${root}#page-top">Home</a></li>
      <li class="nav-item"><a class="nav-link" href="${root}#pub">Publication</a></li>
      <li class="nav-item"><a class="nav-link" href="${root}#contact">Contact</a></li>
      <li class="nav-item"><a class="nav-link" href="${blog}" aria-current="page">Blog</a></li>
    </ul></div>
  </div></nav>`;
}

export function layout({ title, content, preview = false, math = false, embedded = false, admin = false, script = '' }) {
  const root = embedded || admin ? '/' : preview ? '../../' : '../';
  const assets = embedded || admin ? '/blog/' : preview ? '../' : '';
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
${preview || admin ? '<meta name="robots" content="noindex, nofollow">' : ''}
<title>${escape(title)} — Xingyu Lin</title>
<link href="${root}vendor/bootstrap/css/bootstrap.min.css" rel="stylesheet">
<link href="${root}css/font-1.css" rel="stylesheet">
<link href="${root}vendor/font-awesome/css/font-awesome.min.css" rel="stylesheet">
<link href="https://fonts.googleapis.com/css?family=Cabin:700" rel="stylesheet">
<link href="${root}css/grayscale.css?v=2" rel="stylesheet">
${math ? `<link href="${assets}assets/katex/katex.min.css" rel="stylesheet">` : ''}
<link href="${assets}blog.css?v=4" rel="stylesheet">
${admin ? '<link href="/admin-assets/editor.css?v=4" rel="stylesheet">' : ''}
<script src="${assets}blog.js?v=4" defer></script>
${script ? `<script src="${script}" defer></script>` : ''}
</head><body id="page-top" class="blog-page${admin ? ' admin-page' : ''}">
<a class="skip-link" href="#main">Skip to content</a>
${navigation(root, embedded || admin ? '/blog/' : './')}
${content}
<script src="${root}vendor/jquery/jquery.min.js"></script>
<script src="${root}vendor/bootstrap/js/bootstrap.bundle.min.js"></script>
</body></html>\n`;
}

export function indexPage(posts, preview = false) {
  return layout({ title: 'Blog', preview, content: `<main id="main" class="blog-index">
  <h1>Blog</h1>
  <ul class="post-list">${posts.map(post => `<li class="post-entry"><a href="${post.slug}.html" title="${escape(post.title)}">${escape(post.title)}</a>${post.date ? `<time datetime="${post.date}">${formatDate(post.date)}</time>` : '<span>Draft</span>'}</li>`).join('\n') || '<li class="empty-posts">No posts yet.</li>'}</ul>
</main>` });
}

export function articlePage(post, rendered, preview = false, embedded = false) {
  return layout({ title: post.title, preview, embedded, math: rendered.html.includes('class="katex"'), content: `<main id="main" class="post-page"><article>
  <header class="article-header"><h1>${escape(post.title)}</h1>${post.date ? `<time datetime="${post.date}">${formatDate(post.date)}</time>` : ''}</header>
  <div class="article-body">${rendered.html}</div>
</article><p class="sr-only" id="copy-status" role="status" aria-live="polite"></p></main>` });
}
