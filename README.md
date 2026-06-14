# whirlwin.io

Personal homepage. Hand-rolled HTML/CSS/JS. No build step.

The site itself lives in `public/` — that is the only directory deployed,
so repo files like this README stay private.

## Files

- `public/index.html` — the page
- `public/styles.css` — all the styling
- `public/script.js` — tiny enhancements (typing animation, clock, easter egg)
- `public/game.js` — the easter-egg game

## Local preview

```sh
cd public && python3 -m http.server 8080
# → http://localhost:8080
```

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
