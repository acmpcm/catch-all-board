# Catch-all board

Living visual Catch-all for Amber. Hosted on GitHub Pages with Supabase sync.

## Open

https://acmpcm.github.io/catch-all-board/

Work-only view (hides personal/estate):  
https://acmpcm.github.io/catch-all-board/?view=work

## Mark done (syncs everywhere)

1. Open the board.
2. Enter your email → **Sign in to edit**.
3. Click the magic link in email.
4. Check a card to mark done (or uncheck to undo). Changes sync to phone and laptop.

Viewing does not require sign-in. Editing does (so strangers on the public URL cannot clear your board).

## Files

- `index.html` / `styles.css` / `app.js` — UI
- `config.js` — Supabase URL + anon key (public)
- `board.json` — original seed snapshot (live data is in Supabase)

## Update content

HBIC upserts rows in Supabase `board_items` when the Catch-all list changes.
