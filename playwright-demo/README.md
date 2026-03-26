Playwright demo for recording a VS Code (web) interaction.

Quick start

1. Open a terminal in the repo root and run:

```bash
cd playwright-demo
npm install
npm run 1_simple_api_test
```

Video files are saved to `video/` inside this folder.

Notes
- `npm run demo` and `npm run 1_simple_api_test` run the first example demo.
- `npm run 2_api_environment_variables` runs the environment-variables example demo.
- These scripts launch your local VS Code and record the interaction with `ffmpeg`.

Desktop VS Code demo

1. Ensure `ffmpeg` is installed and available in your PATH (Homebrew: `brew install ffmpeg`).
2. Run one of the example demos (this launches your local VS Code):

```bash
cd playwright-demo
npm run 1_simple_api_test
```

Or:

```bash
cd playwright-demo
npm run 2_api_environment_variables
```

The script starts an `ffmpeg` screen recording, launches VS Code, performs the demo steps, then saves the recording in `video/`.

If `ffmpeg` cannot find the correct macOS capture device, adjust the `-i '${idx}:none'` input in the demo script you are running.
