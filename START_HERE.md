# Coral-lytics: start here

This folder has everything needed to build and deploy the Coral-lytics website.

## For the person (Shaurya)

1. Open a new chat in the "Coral Bleaching" project and choose Sonnet.
2. Attach `coral-lytics.zip`.
3. Paste this prompt:

> Unzip the attached coral-lytics.zip and read START_HERE.md, then BUILD_HANDOVER.md, in full. Build the Coral-lytics site by following the build steps in section 14 in order. After each step, check its "Done when" in a headless browser and tell me in one or two lines that it passed, then continue to the next step without waiting for me. Do not redesign anything; match reference/mockups. Ask me before creating a GitHub repo or deploying. When the site works on localhost, send me the project folder as a zip.

4. When it asks about deploying, say which free option you want:
   - **GitHub Pages** (recommended): a free public URL like `https://<your-username>.github.io/coral-lytics/`. Needs your GitHub account.
   - **Netlify Drop**: drag one folder onto a web page. No GitHub needed. Gives a free URL.

## For the builder model

- Read `BUILD_HANDOVER.md` fully before writing code.
- Look at every image in `reference/mockups/` and open `reference/scrubber-prototype.html`.
- The starter already installs and builds. Data is already prepared in `public/data`.
- Work one step at a time. Keep `NOTES.md` updated with what you did and any decisions.
- If you run out of context, the next session can continue from `NOTES.md` and the step list.
