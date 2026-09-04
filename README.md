# whirlwin.io

Personal homepage. Hand-rolled HTML/CSS/JS. No build step.

The site itself lives in `public/` — that is the only directory deployed,
so repo files like this README stay private.

## Files

- `public/index.html` — the page
- `public/blog.html` — the blog (`/blog`), entries inline
- `public/contact.html` — contact and legal identity (`/contact`)
- `public/styles.css` — all the styling
- `public/script.js` — tiny enhancements (typing animation, clock, easter egg)
- `public/game.js` — the easter-egg game
- `public/whirlwin-lockup.png` — the wordmark logo in the status bar, linking home
- `public/profile.jpg` — the portrait in the blog masthead

## Local preview

```sh
cd public && python3 -m http.server 8080
# → http://localhost:8080
```

## Cache busting

Pages serves HTML with `max-age=0` but CSS, JS and images with
`max-age=14400`, so a returning visitor can get new HTML against a
four-hour-old stylesheet. The `<link>` and `<script>` tags therefore carry a
hand-bumped version query (`/styles.css?v=2`, `/game.js?v=11`) — **bump it
when you change that file**, or the change will not reach returning visitors
for four hours. Assets are referenced root-absolute so they resolve the same
from `/blog` and `/blog/`.

## Deploy (Cloudflare Pages)

Hosted on Cloudflare Pages (project `whirlwin-io`) via wrangler direct upload.
The `whirlwin.io` DNS zone is on Cloudflare; both `whirlwin.io` and
`www.whirlwin.io` are proxied `CNAME`s to `whirlwin-io.pages.dev` attached as
the project's custom domains.

```sh
npx wrangler pages deploy public --project-name whirlwin-io
```

Only `public/` is uploaded, which is how the deploy avoids serving repo files
(README, todo list, dotfiles). One-time login first: `npx wrangler login`.

## Editing apps

The "apps" section is a simple `<ol class="apps">` in `public/index.html`. Each
`<li class="card">` is one entry — duplicate, edit, push.

## Adding a blog entry

All entries live inline in `public/blog.html` inside `<div class="posts">`,
newest first. Copy an existing `<article class="post">` block, paste it at the
top, and edit:

- `id="..."` — the slug, which is also the `#permalink`
- `<time datetime="YYYY-MM-DD">` — the machine-readable date, and the visible
  date next to it
- `.post__author` — the author name
- the title and the body paragraphs

An entry that lives on someone else's site (an article or a talk published
elsewhere) takes `class="post post--external"`, points its title at the
external URL instead of a `#permalink`, and adds a `.post__kind` badge
(`article` / `talk`) plus a `.post__source` domain to the meta line. Date it
with the date that site shows. The site's writing all lives here — the nav's
`writing` link points at `/blog`.

No build step, no front matter, no generator. The block head on the page has no
item count, so adding an entry is a single edit.
