# Catch-all board

A calm dark kanban for Amber’s catch-all list. Static files only — no server required for the standalone build.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Multi-file app entry |
| `styles.css` | Dark UI styles |
| `app.js` | Loads `board.json`, All/Work toggle |
| `board.json` | Seed / live board data (do not invent items) |
| `board-standalone.html` | One-file version (CSS + JS + JSON inlined) |
| `preview.png` | Headless Chrome screenshot |

## How to open

**Standalone (easiest)** — double-click or open in browser:

```
file:///…/catchall-app/board-standalone.html
```

Works via `file://` and after a Drive download. Privacy toggle and `?view=work` still work.

**Multi-file** — needs HTTP (browsers block `fetch` of `board.json` on `file://`):

```bash
cd catchall-app
python3 -m http.server 8765
# then open http://localhost:8765/
```

Or open `index.html` from any static host / local server.

## Work view

- UI: tap **Work** in the header (hides `privacy: "personal"` items).
- URL: add `?view=work` — e.g. `board-standalone.html?view=work` or `http://localhost:8765/?view=work`.

## Updating

Edit `board.json`, then regenerate standalone if needed (re-inline CSS/JS/JSON into `board-standalone.html`). Keep the seed structure; don’t invent cards.

Updated: 2026-09-20
