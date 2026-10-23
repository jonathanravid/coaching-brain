# GitHub

The brain and the desk source are in the private repo [jonathanravid/coaching-brain](https://github.com/jonathanravid/coaching-brain). The intervals API key is not in the repo.

`scripts/refresh-desk.mjs` writes `public/desk-live.json` and `site/desk-live.json`. The Refresh desk workflow is set to run every hour. It cannot run until two Actions secrets exist: `INTERVALS_API_KEY` and `INTERVALS_ATHLETE_ID`. This GitHub connection cannot create secrets (403).

The Publish dashboard workflow deploys `site/` to GitHub Pages. Pages is not on yet. The same connection cannot turn it on. After it is turned on, the site may be public even though the repo is private. That would publish training numbers. Do not turn Pages on if those numbers should stay private.

The snapshot already committed is 23 Oct 2026: CTL 67.3, form −10.5, resting heart rate 55.
