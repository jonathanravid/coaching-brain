# Coaching brain

Private training notes and the desk.

- `brain/` is the wiki. Do not delete a note. Update it.
- `data.json` is the intervals history the notes were built from.
- The API key is not in this repo. GitHub Actions reads `INTERVALS_API_KEY` and `INTERVALS_ATHLETE_ID` from repository secrets.
- `scripts/refresh-desk.mjs` pulls the last 16 days and writes `public/desk-live.json` and `site/desk-live.json`.
- The Refresh desk workflow does that every hour. The Publish dashboard workflow puts `site/` on GitHub Pages.
