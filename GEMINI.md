## Saving this document (required)
1) Save this file as **`CLAUDE.md`** at the **root of the repository**.  
2) Copy it exactly (byte-for-byte) so all AI tools load the same instructions:

```bash
cp CLAUDE.md GEMINI.md
cp CLAUDE.md AGENTS.md
```

## Project Overview
Smart Ring Decision Tool is a mobile-first web application designed to help users choose between the Oura Ring 4 and RingConn Gen 2. It uses a comprehensive 156-question survey across 22 categories to generate a weighted recommendation.

## Commands
This is a static HTML/JS project with no build step. 
- **Development**: Open `index.html` directly in a browser or use a simple static file server (e.g., `npx serve .`).
- **Deployment**: Deploy to GitHub Pages by pushing to the `main` branch.

## Architecture
- **`index.html`**: The main entry point and single-page application structure.
- **`styles.css`**: Contains all styling for the application.
- **`questions.js`**: Contains the full data set of questions, categories, and ring specifications.
- **`algorithm.js`**: Implements the decision-making logic, scoring Oura vs. RingConn based on user ratings.
- **`app.js`**: Handles UI interactions, state management (via `localStorage`), and screen routing.

## State Management
- Data is persisted in `localStorage` under keys like `ring_chooser_answers`.
- Progress is tracked by the number of answered questions vs. total questions.

## UI Design
- Mobile-first, responsive design.
- Uses a screen-switching mechanism (adding/removing `active` class).
- Rating scale is 0-10 (importance level).
