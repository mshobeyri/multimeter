Playwright demo for recording a VS Code (web) interaction.

Quick start

1. Open a terminal in the repo root and run:

```bash
cd playwright-demo
npm install
npx playwright install chromium
npm run demo
```

Video files will be saved to `playback-videos/` inside this folder.

Notes
- Script opens https://vscode.dev in Chromium and records a short clip.
- For desktop VS Code automation see the project README in the main repo.

Desktop VS Code demo

1. Ensure `ffmpeg` is installed and available in your PATH (Homebrew: `brew install ffmpeg`).
2. Run the desktop demo (this launches your local VS Code):

```bash
cd playwright-demo
npm run demo-desktop
```

The script will start an `ffmpeg` screen recording, launch VS Code, perform a couple UI actions, then stop and save the recording in `playback-videos/`.

If `ffmpeg` cannot find the correct macOS capture device, adjust the `-i '1:none'` argument in `playwright-vscode-desktop.js`.
