# FastAPI Starter Kit Documentation

This repository contains the source code for the documentation site of the **FastAPI Starter Kit**, accessible at [fastapi-startkit.github.io](https://fastapi-startkit.github.io/).

The documentation is built using [VitePress](https://vitepress.dev/), a Vite-native documentation framework.

## 🚀 Development

To run the documentation site locally for development:

```bash
# Install dependencies
npm install

# Start local development server
npm run docs:dev
```

## 🏗️ Build and Deployment

The site is automatically built and deployed to GitHub Pages using **GitHub Actions**.

- **Workflow**: [.github/workflows/deploy.yml](.github/workflows/deploy.yml)
- **Automatic Deployment**: Any push to the `main` branch triggers a new build and deployment.

## 📁 Repository Structure

- `docs/`: Contains the Markdown files for the documentation.
- `.vitepress/`: VitePress configuration and theme customizations.
- `index.md`: The landing page of the documentation site.
