# whirlwin.io

Personal homepage. Hand-rolled HTML/CSS/JS. No build step.

The site itself lives in `public/` — that is the only directory deployed,
so repo files like this README stay private.

## Files

- `public/index.html` — the page
- `public/writings.html` — the writings index (`/writings`), previews inline
- `public/writings/<slug>.html` — one entry per file (`/writings/<slug>`)
- `public/projects.html` — every project (`/projects`)
- `public/contact.html` — contact and legal identity (`/contact`)
- `public/styles.css` — all the styling
- `public/script.js` — tiny enhancements (typing animation, clock, easter egg)
- `public/game.js` — the easter-egg game
- `public/whirlwin-lockup.png` — the wordmark logo in the status bar, linking home
- `public/profile.jpg` — the portrait in the writings masthead

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
from `/writings` and `/writings/`.

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

## Editing projects

The projects list is an `<ol class="apps">` of `<li class="card">` entries.
It appears twice — in `public/index.html` and in full on `public/projects.html`
— so edit both. The front page shows up to 10; past that, trim it there and
leave `/projects` complete.

Old `/blog` URLs 301 to `/writings` via `public/_redirects`.

## Adding a writing entry

`public/writings.html` (`/writings`) is an index of previews. An entry of your own
lives in its own file at `public/writings/<slug>.html`, served at `/writings/<slug>`
— Pages resolves `/writings` to `writings.html` in preference to the `writings/`
directory, so the two do not collide.

Your own writing is two edits:

1. Copy `public/writings/cloudflare-cost-caps.html` to
   `public/writings/<slug>.html` and edit the `<title>`, the description meta,
   the `h1`, the date and the body.
2. Add an `<article class="post">` at the top of `<div class="posts">` in
   `public/writings.html` with `id="<slug>"`, its title and its `.post__more`
   link both pointing at `/writings/<slug>`, and a sentence or two of preview.

Something published elsewhere is one edit: an
`<article class="post post--external">` in the index, its title pointing at
the external URL, plus a `.post__kind` badge (`article` / `talk`) and a
`.post__source` domain. Date it with the date that site shows, and give it
no read-the-rest link — the title is the link.

Entries are newest first. No build step, no front matter, no generator.

The front page carries the newest three as title-and-date teasers, in the
hero beside the animation, under a heading that links to `/writings`. That list is hand-maintained, so add a new entry
there too and drop the oldest of the three.

