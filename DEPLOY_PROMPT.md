# Paste this into Claude Code

Open a terminal in this folder, start Claude Code, and paste everything inside the box.

```
This folder is a finished Vite site called Coral-lytics. It already has a git commit on main and a GitHub Pages workflow at .github/workflows/deploy.yml. Deploy it to GitHub Pages on my GitHub account, Shaurya6355.

1. Run npm install and npm run build. Confirm the build passes.
2. Using the gh CLI, create a public repo named coral-lytics under Shaurya6355 and push the main branch to it. If gh is not logged in, tell me to run gh auth login first.
3. Turn on GitHub Pages with the source set to GitHub Actions. You can use: gh api -X POST repos/Shaurya6355/coral-lytics/pages -f build_type=workflow . If Pages is already enabled, skip this step.
4. Wait for the "Deploy to GitHub Pages" workflow run to finish. Use gh run watch.
5. Open https://shaurya6355.github.io/coral-lytics/ and check that the loading screen runs, the story loads, and #/explore, #/gallery and #/event/8554/20051015 open without errors.
6. Tell me the live URL. Do not change any design or code unless the build or deploy fails.
```
