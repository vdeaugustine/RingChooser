# Smart Ring Decision Tool

Oura Ring 4 vs RingConn Gen 2 decision web app. Answers 156 questions across 22 categories and produces a weighted recommendation using the algorithm in `smart_ring_decision_algorithm.md`.

## Getting Started

To run this project locally for development:

1.  **Option A: Direct Open** - Just open `index.html` in any modern web browser.
2.  **Option B: Static Server** - Use a simple static file server for a better development experience:
    ```bash
    npx serve .
    ```
    Alternatively, if you have Python installed:
    ```bash
    python3 -m http.server 8000
    ```

## Hosting on GitHub Pages


1. Push this repo to GitHub.
2. Settings → Pages → Source: Deploy from branch.
3. Branch: main (or master), folder: / (root).
4. Save. The site will be at `https://<username>.github.io/<repo>/`.

All assets are static (index.html, styles.css, questions.js, algorithm.js, app.js). No build step. Data is stored in the browser via `localStorage` so progress persists across sessions and devices using the same browser profile.

## Mobile

The UI is mobile-first and touch-friendly. Progress is saved automatically as the user answers; she can leave and return later.
