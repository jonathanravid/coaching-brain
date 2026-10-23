# GitHub

The brain and the desk source live in a private repo, `jonathanravid/coaching-brain`. The intervals API key is a repository secret, not a file in the repo.

A GitHub Action refreshes `public/desk-live.json` and `site/desk-live.json` every hour from intervals. GitHub Pages publishes the `site/` folder from that snapshot. The page in this sandbox still reads intervals directly when it is open.
