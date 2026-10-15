# FastAPI Starter Kit Documentation

Source for the documentation site at [fastapi-startkit.github.io](https://fastapi-startkit.github.io/), built with [VitePress](https://vitepress.dev/).

## Development

```bash
npm install
npm run docs:dev
```

## Build and Deployment

Every push to `main` builds the site and deploys it to GitHub Pages through [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

## Repository Structure

- `docs/`: documentation pages in Markdown.
- `.vitepress/`: VitePress configuration and theme.
- `index.md`: the landing page.
