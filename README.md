# whirlwin.io

Personal homepage. Hand-rolled HTML/CSS/JS. No build step.

## Files

- `index.html` — the page
- `styles.css` — all the styling
- `script.js` — tiny enhancements (typing animation, clock, easter egg)

## Local preview

```sh
python3 -m http.server 8080
# → http://localhost:8080
```

## Deploy (Codeberg Pages)

Codeberg serves static sites from a branch named `pages` in the repo
`<user>/pages`, or from the default branch of a repo named `pages`.

For a custom domain (whirlwin.io), add a `.domains` file at the repo root
with the domain on its own line, then point a `CNAME` record at
`<user>.codeberg.page`.

See: https://docs.codeberg.org/codeberg-pages/

## Editing apps

The "apps" section is a simple `<ol class="apps">` in `index.html`. Each
`<li class="card">` is one entry — duplicate, edit, push.
