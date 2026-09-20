# Blog

The public blog is a list of titles and publication dates, hosted on GitHub Pages. Write on your Mac; publishing sends the public pages to GitHub automatically. Navigation remains Home, Publication, Contact, and Blog for everyone.

## Open Write Blog

Double-click **Write Blog** on the Desktop or in `~/Applications`. You can drag the app from Applications to your Dock. It starts the local server in the background if needed, reuses it if it is already running, and opens the writing workspace in your default browser without a password. This also works after restarting your Mac. No Terminal window needs to stay open.

The repository also includes **Write Blog.command** as a fallback. Neither launcher needs an internet connection for writing. Publishing public posts requires a connection to GitHub.

## Writing

1. Open **Write Blog**. Your writing workspace opens immediately—no account or password needed.
2. Blog shows a left sidebar with **Live**, **Drafts**, and **Archived**. Choose **Write** to open a new document in the same workspace.
3. Enter a title and write directly in the document. Headings, emphasis, lists, and code format as you type. Type `/` to search commands, such as `/link`, `/heading`, `/code`, or `/equation`. Use the arrow keys and Enter to choose, or Escape to close.
4. Everything saves automatically as a draft after a short pause, including unfinished titles, empty bodies, and untitled writing. Draft rows show the date first saved; this stays fixed through edits, archiving, and restoring. Older drafts without a recorded start date use their earliest available timestamp. There is no manual Save button.
5. Click **Publish** when ready. Only then choose **Public** or **Private** and confirm. The publication date is set automatically. Published posts become read-only, including private posts.
6. Click a post title to open it. Each row has an **Archive** button; archived rows have **Restore**. Use the sidebar to switch folders. Drafts save before you switch views.

Public posts appear immediately on the local site. **Publish → Public** also builds the public pages and pushes them to GitHub Pages; the live site updates after GitHub finishes its deployment, usually within a few minutes. If that step fails, the post stays safely on this Mac and a **Retry** button appears. Pending publication survives a server restart. Private posts remain on this Mac and are accessible from the local workspace. Published posts cannot be changed or relabeled, in either the editor or the API.

**Archive** removes a post from the active list but preserves its Markdown in the private `archive/` folder. Archiving or restoring a public post also updates GitHub Pages. Open **Archived** in the sidebar to read or restore it. **Live** includes all your published posts, with no public/private labels in the workspace. Restore returns it with its original visibility; restored published posts stay read-only, and restored drafts remain editable.

There are no categories, descriptions, tags, or date fields to fill out. Technical formatting—including equations, code, tables, and footnotes—is available in every post. Markdown shortcuts include `## ` for a heading, `- ` for a list, `**bold**`, and triple backticks for a code block. Equations use `$...$` or `$$` blocks; click a rendered equation to edit it. Use `/image` to insert an image. Markdown is the storage format; the editor always shows the live, formatted document.

## Run locally

Requires Node.js 22 or later:

```sh
npm --prefix blog ci
npm --prefix blog run build
npm --prefix blog run install-launcher
```

Then open **Write Blog**. Alternatively, run `npm --prefix blog run open`, or keep `npm --prefix blog start` running in a Terminal window. Open `http://127.0.0.1:8080/` for the website or `http://127.0.0.1:8080/blog/` to write. Existing `/admin` and `/write` links also open the workspace directly. The homepage, blog, and editor use one server bound to this computer. The server continues running after the browser closes and stops when the Mac shuts down. Posts are preserved when the server restarts.

## GitHub Pages publishing

No additional server hosting is needed for this local writing workflow. The public website stays at `https://xingyu-lin.github.io/`; `/admin` is available only on your local server.

Publishing uses this repository's `origin` remote and `master` branch. GitHub authentication is through your existing Git credential helper. On a new Mac, sign in using `gh auth login` and run `gh auth setup-git`. The app does not store a GitHub token in its files.

The publisher uses a temporary Git checkout based on the latest remote branch. It exports only public Markdown and generated public pages. It leaves unrelated local commits, staged changes, and other files alone. Public archives are removed from the current website; their earlier public versions remain in Git history. If you also edit website code in this repository, pull the latest remote branch before pushing code changes, because publication advances `origin/master` independently.

Set `BLOG_PUBLISH_GIT=0` for development servers that must never push to GitHub. Set `BLOG_GIT` to a Git executable if it is unavailable on the default path. `BLOG_WRITER_PORT` changes the local port (8080 by default). The launcher records server output in `server.log` inside the private library and reports an error if another app occupies that port.

## Local storage

Back up the private library regularly. Its default location is under `~/.local/share/xingyu-blog/`, with a subdirectory specific to this repository path. `drafts/` contains unpublished Markdown, `posts/` contains published public/private Markdown, `archive/<post-url>/post.md` preserves an archived post (plus any older edit drafts), and an old `.admin-password` file, if present, is left untouched and no longer used. Keep this directory out of Git. Only public posts are exported to the website repository. Use `BLOG_LIBRARY_DIR` to choose another location; keep that setting consistent when opening the app. Reinstall the launcher if you move the repository, and preserve or explicitly select the original library.

The writer listens only on `127.0.0.1` and refuses non-local origins, including HTTPS hosting configurations. Host, Origin, and browser request checks block access from other websites; changes also require a random writing token issued by the local server. No password or login cookie is used. Only one writer server should use a given library at a time.

## Development

- `scripts/writer.mjs`: local website, request protections, and writing API.
- `scripts/store.mjs`: atomic Markdown storage with revision checks.
- `scripts/launch.mjs` and `install-launcher.mjs`: server startup and the Mac app.
- `scripts/publisher.mjs`: isolated public export, Git push, and persistent retry status.
- `admin/`: the document editor, powered by Tiptap.
- `_content/`: legacy public Markdown, including the existing sample post.
- `scripts/render.mjs` and `templates.mjs`: article rendering and page layouts.
- `blog.css`: public blog styling; `admin/editor.css`: workspace styling.

`npm --prefix blog test` checks rendering, editor round-trips, direct workspace access, cross-site request protection, local-only binding, visibility, draft isolation, dates, immutable posts, archive/restore, launcher reuse, and publishing against an isolated local Git remote. It never publishes test posts to the real website. `npm --prefix blog run build` regenerates pages from public `_content/` and bundles the editor. The browser's Publish button handles exporting local public writing before building and pushing it.
