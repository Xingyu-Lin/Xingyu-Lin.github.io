# Blog

The public blog is a list of titles and publication dates. Sign in at `/admin` to manage and write posts directly in Blog. Navigation remains Home, Publication, Contact, and Blog for everyone.

## Writing

1. Open `/admin`. On the first local visit, choose your administrator password.
2. After signing in, Blog shows a left sidebar with **Live**, **Drafts**, and **Archived**. Choose **Write** to open a new document in the same workspace.
3. Enter a title and write directly in the document. Headings, emphasis, lists, and code format as you type. Type `/` to search commands, such as `/link`, `/heading`, `/code`, or `/equation`. Use the arrow keys and Enter to choose, or Escape to close.
4. Everything saves automatically as a draft after a short pause, including unfinished titles, empty bodies, and untitled writing. Draft rows show the date first saved; this stays fixed through edits, archiving, and restoring. Older drafts without a recorded start date use their earliest available timestamp. There is no manual Save button.
5. Click **Publish** when ready. Only then choose **Public** or **Private** and confirm. The publication date is set automatically. Published posts become read-only, including private posts.
6. Click a post title to open it. Each row has an **Archive** button; archived rows have **Restore**. Use the sidebar to switch folders or sign out. Drafts save before you switch views.

Public posts appear immediately on the running site. Private posts require your admin login, and never appear in the public blog. Published posts cannot be changed or relabeled, in either the editor or the API. **Archive** removes a post from the active list and the public website, but preserves its Markdown in the private `archive/` folder. Open **Archived** in the sidebar to read or restore it. **Live** includes all your published posts, with no public/private labels in the workspace. Restore returns it with its original visibility; restored published posts stay read-only, and restored drafts remain editable.

There are no categories, descriptions, tags, or date fields to fill out. Technical formatting—including equations, code, tables, and footnotes—is available in every post. Markdown shortcuts include `## ` for a heading, `- ` for a list, `**bold**`, and triple backticks for a code block. Equations use `$...$` or `$$` blocks; click a rendered equation to edit it. Use `/image` to insert an image. Markdown is the storage format; the editor always shows the live, formatted document.

## Run locally

Requires Node.js 22 or later:

```sh
npm --prefix blog ci
npm --prefix blog run build
npm --prefix blog start
```

Open `http://127.0.0.1:8080/` for the website or `http://127.0.0.1:8080/admin` to sign in. The homepage, blog, login, and editor all use this one server. The old separate writing app is no longer used.

## Hosting

**The admin requires server hosting. GitHub Pages cannot run it.** Static blog pages can still be generated, but pushing this repository to GitHub Pages alone will not enable login or publishing. No hosting migration or live deployment has been performed.

To deploy the integrated site, run one Node server behind HTTPS with a persistent disk. Install and build with the commands above; start with `npm --prefix blog start`. Configure:

- `BLOG_ORIGIN`: the site's exact HTTPS origin, such as `https://your-domain.example`.
- `PORT`: the port provided by the host (defaults to 8080).
- `BLOG_LIBRARY_DIR`: an absolute path on the persistent disk, outside the public repository.
- `ADMIN_PASSWORD_HASH`: the password hash provisioned for the owner, or copy the existing local `.admin-password` file into the private data directory through the host's secure administration tools.

Password creation through the browser is available only when bound to localhost. Online hosting never exposes open registration. Login uses a salted scrypt password hash, expiring server sessions, HttpOnly/SameSite cookies, CSRF tokens, and login attempt limiting. HTTPS sessions also use Secure cookies. Sessions end when the server restarts.

The server publishes directly to its private data directory; it does not commit or push writing to GitHub. Back up the entire directory regularly. The default local directory is under `~/.local/share/xingyu-blog/`, with a subdirectory specific to this checkout. `drafts/` contains unpublished Markdown, `posts/` contains published public/private Markdown, `archive/<post-url>/post.md` preserves a deleted post (plus any older edit drafts), and `.admin-password` contains the password hash. Keep this directory out of Git and off the public filesystem.

A single server process is supported. Use a shared database and shared session storage before scaling to multiple instances. Preserve the data disk when redeploying.

## Development

- `scripts/writer.mjs`: same-origin public site, authentication routes, and writing API.
- `scripts/auth.mjs`: password hashing and sessions.
- `scripts/store.mjs`: atomic Markdown storage with revision checks.
- `admin/`: the document editor, powered by Tiptap, and login UI.
- `_content/`: legacy public Markdown, including the existing sample post.
- `scripts/render.mjs` and `templates.mjs`: article rendering and page layouts.
- `blog.css`: public blog styling; `admin/editor.css`: writing and login styling.

`npm --prefix blog test` checks rendering, editor round-trips, authentication, visibility, draft isolation, publication dates, immutable published posts, and archive/restore behavior. `npm --prefix blog run build` regenerates static legacy posts and bundles the editor. Runtime writing is kept outside generated files and is preserved across code rebuilds.
