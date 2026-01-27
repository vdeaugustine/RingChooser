# Smart Ring Decision Tool

Oura Ring 4 vs RingConn Gen 2 decision web app. Answers 156 questions across 22 categories and produces a weighted recommendation using the algorithm in `smart_ring_decision_algorithm.md`.

## Hosting on GitHub Pages

1. Push this repo to GitHub.
2. Settings → Pages → Source: Deploy from branch.
3. Branch: main (or master), folder: / (root).
4. Save. The site will be at `https://<username>.github.io/<repo>/`.

All assets are static (index.html, styles.css, questions.js, algorithm.js, app.js). No build step. Data is stored in the browser via `localStorage` so progress persists across sessions and devices using the same browser profile.

## Mobile

The UI is mobile-first and touch-friendly. Progress is saved automatically as the user answers; she can leave and return later.
