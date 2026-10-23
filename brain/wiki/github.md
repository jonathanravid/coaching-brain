# GitHub

The brain and the desk source are in the private repo [jonathanravid/coaching-brain](https://github.com/jonathanravid/coaching-brain). The intervals API key is not in the repo.

The dashboard is published at [jonathanravid.github.io/coaching-brain](https://jonathanravid.github.io/coaching-brain/). It is public. GitHub will not let this account make Pages private. The snapshot it is serving is 23 Oct 2026: CTL 67.3, form −10.5, resting heart rate 55.

`scripts/refresh-desk.mjs` writes `public/desk-live.json` and `site/desk-live.json`. The Refresh desk workflow is set to run every hour. It cannot run until two Actions secrets exist: `INTERVALS_API_KEY` and `INTERVALS_ATHLETE_ID`. This GitHub connection cannot create those secrets.
