const { _electron: electron } = require('playwright');
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

async function findExecutable() {
  const candidates = [
    '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
    '/Applications/Visual Studio Code.app/Contents/MacOS/Visual Studio Code',
    '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Code - Insiders',
    '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Visual Studio Code - Insiders',
    path.join(process.env.HOME || '', 'Applications/Visual Studio Code.app/Contents/MacOS/Code')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) {
      return c;
    }
  }
  try {
    const { execSync } = require('child_process');
    const mdfind = execSync("mdfind 'kMDItemCFBundleIdentifier == \"com.microsoft.VSCode\"' | head -n 1").toString().trim();
    if (mdfind) {
      const appPath = mdfind.replace(/\.app\/?$/, '.app');
      const candidate = path.join(appPath, 'Contents', 'MacOS', 'Code');
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  } catch (e) {}
  return null;
}

function findGreenSendButton(buffer) {
  const screenshot = PNG.sync.read(buffer);
  const { width, height, data } = screenshot;
  const searchStartX = Math.floor(width * 0.52);
  const searchEndX = width - 1;
  const searchStartY = Math.floor(height * 0.12);
  const searchEndY = Math.floor(height * 0.72);
  const visited = new Uint8Array(width * height);
  const candidates = [];

  const isTargetGreen = (r, g, b, a) => {
    return a > 220 && g >= 85 && g <= 190 && r >= 20 && r <= 110 && b >= 20 && b <= 110 && g - r >= 28 && g - b >= 18;
  };

  const getOffset = (x, y) => ((y * width) + x) * 4;
  const getIndex = (x, y) => (y * width) + x;

  for (let y = searchStartY; y <= searchEndY; y++) {
    for (let x = searchStartX; x <= searchEndX; x++) {
      const pixelIndex = getIndex(x, y);
      if (visited[pixelIndex]) {
        continue;
      }

      const offset = getOffset(x, y);
      if (!isTargetGreen(data[offset], data[offset + 1], data[offset + 2], data[offset + 3])) {
        continue;
      }

      const queue = [[x, y]];
      visited[pixelIndex] = 1;
      let count = 0;
      let totalX = 0;
      let totalY = 0;
      let minX = x;
      let maxX = x;
      let minY = y;
      let maxY = y;

      while (queue.length > 0) {
        const [currentX, currentY] = queue.pop();
        count += 1;
        totalX += currentX;
        totalY += currentY;
        minX = Math.min(minX, currentX);
        maxX = Math.max(maxX, currentX);
        minY = Math.min(minY, currentY);
        maxY = Math.max(maxY, currentY);

        const neighbors = [
          [currentX - 1, currentY],
          [currentX + 1, currentY],
          [currentX, currentY - 1],
          [currentX, currentY + 1]
        ];

        for (const [nextX, nextY] of neighbors) {
          if (nextX < searchStartX || nextX > searchEndX || nextY < searchStartY || nextY > searchEndY) {
            continue;
          }

          const nextIndex = getIndex(nextX, nextY);
          if (visited[nextIndex]) {
            continue;
          }

          visited[nextIndex] = 1;
          const nextOffset = getOffset(nextX, nextY);
          if (isTargetGreen(data[nextOffset], data[nextOffset + 1], data[nextOffset + 2], data[nextOffset + 3])) {
            queue.push([nextX, nextY]);
          }
        }
      }

      const boxWidth = maxX - minX + 1;
      const boxHeight = maxY - minY + 1;
      const fillRatio = count / (boxWidth * boxHeight);
      const aspectRatio = boxWidth / boxHeight;
      const centerX = totalX / count;
      const centerY = totalY / count;

      if (count < 80 || count > 4000) {
        continue;
      }
      if (boxWidth < 12 || boxWidth > 80 || boxHeight < 12 || boxHeight > 80) {
        continue;
      }
      if (aspectRatio < 0.65 || aspectRatio > 1.35) {
        continue;
      }
      if (fillRatio < 0.35 || fillRatio > 0.92) {
        continue;
      }

      const rightBias = centerX / width;
      const midBias = 1 - Math.abs((centerY / height) - 0.38);
      const sizeBias = 1 - (Math.abs(boxWidth - 30) + Math.abs(boxHeight - 30)) / 60;
      const score = (rightBias * 4) + (midBias * 2) + sizeBias + fillRatio;

      candidates.push({
        x: Math.round(centerX),
        y: Math.round(centerY),
        width: boxWidth,
        height: boxHeight,
        score
      });
    }
  }

  candidates.sort((left, right) => right.score - left.score);
  return candidates[0] || null;
}

async function run() {
  const home = process.env.HOME || os.homedir();
  const demoName = path.basename(__filename, '.js');
  const workspace = path.join(home, 'projects', 'test', demoName);

  // Kill orphaned ffmpeg processes from previous runs that may lock video files.
  try {
    const { execSync } = require('child_process');
    const pids = execSync("pgrep -f 'ffmpeg.*avfoundation' 2>/dev/null || true").toString().trim();
    for (const pid of pids.split('\n').filter(Boolean)) {
      try { execSync(`kill -9 ${pid} 2>/dev/null`); } catch (e) {}
    }
  } catch (e) {}

  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  // Create empty placeholder files — content will be typed live during the demo.
  for (const name of ['post_with_inputs_outputs.mmt', 'get_with_outputs.mmt']) {
    fs.writeFileSync(path.join(workspace, name), '');
  }

  const executablePath = await findExecutable();
  if (!executablePath) {
    console.error(`Could not find VS Code executable. Edit ${path.basename(__filename)} to set executablePath.`);
    process.exit(1);
  }

  // Clean VS Code profile to avoid stale state / file lock issues.
  const profileDir = path.join(__dirname, '.vscode-profile');
  fs.rmSync(profileDir, { recursive: true, force: true });
  // Install local Multimeter VSIX into a temporary extensions directory and launch VS Code with that extensions dir
  const parentDir = path.resolve(__dirname, '..');
  const vsixCandidates = fs.readdirSync(parentDir).filter(f => f.startsWith('multimeter') && f.endsWith('.vsix'));
  const vsixPath = vsixCandidates.length > 0 ? path.join(parentDir, vsixCandidates[0]) : null;
  const extensionsDir = path.join(__dirname, '.vscode-extensions');
  if (!fs.existsSync(extensionsDir)) {
    fs.mkdirSync(extensionsDir, { recursive: true });
  }
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }
  const userDir = path.join(profileDir, 'User');
  if (!fs.existsSync(userDir)) {
    fs.mkdirSync(userDir, { recursive: true });
  }
  const settingsPath = path.join(userDir, 'settings.json');
  const settings = {
    'workbench.editorAssociations': {
      '*.mmt': 'mmt.editor'
    },
    'security.workspace.trust.enabled': false,
    'security.workspace.trust.startupPrompt': 'never',
    'editor.acceptSuggestionOnEnter': 'off',
    'editor.quickSuggestions': false,
    'editor.suggestOnTriggerCharacters': false,
    'editor.inlineSuggest.enabled': false,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.panel.defaultLocation': 'bottom',
    'chat.commandCenter.enabled': false,
    'workbench.startupEditor': 'none',
    'workbench.welcomePage.walkthroughs.openOnInstall': false,
    'workbench.tips.enabled': false,
    'update.mode': 'none',
    'extensions.autoCheckUpdates': false,
    'extensions.autoUpdate': false,
    'extensions.ignoreRecommendations': true,
    'telemetry.telemetryLevel': 'off'
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  const launchArgs = ['--new-window', workspace, '--user-data-dir', profileDir, '--extensions-dir', extensionsDir, '--disable-workspace-trust'];
  if (vsixPath && fs.existsSync(vsixPath)) {
    console.log('Ensuring VSIX is extracted to', extensionsDir);
    try {
      const { execSync } = require('child_process');
      execSync(`unzip -o "${vsixPath}" -d "${extensionsDir}"`);
      console.log('VSIX extracted.');
    } catch (e) {
      console.warn('Failed to extract VSIX automatically, will continue — you may need to install the extension manually:', e.message);
    }
  } else if (!fs.readdirSync(extensionsDir).some(f => f.startsWith('mshobeyri.multimeter'))) {
    console.warn('No multimeter vsix found in', parentDir, 'and no extension installed in', extensionsDir);
  }
  const app = await electron.launch({ executablePath, args: launchArgs });

  // Start a screen recording via ffmpeg to capture the demo as an MP4.
  const videoDir = path.join(__dirname, 'video');
  if (!fs.existsSync(videoDir)) {
    fs.mkdirSync(videoDir, { recursive: true });
  }
  const outFile = path.join(videoDir, `${path.basename(__filename, '.js')}.mp4`);
  const tempMkvFile = path.join(videoDir, `${path.basename(__filename, '.js')}.mkv`);
  // Remove stale video files from previous runs.
  for (const f of [outFile, tempMkvFile]) {
    try { fs.unlinkSync(f); } catch (e) {}
  }

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(800);

  async function dismissStartupPopups() {
    for (let attempt = 0; attempt < 8; attempt++) {
      let dismissed = false;

      try {
        const workbench = win.frames()[0];
        if (workbench) {
          const closeTarget = await workbench.evaluate(() => {
            const selectors = [
              '.monaco-dialog-box .dialog-buttons-row button',
              '.monaco-dialog-box button',
              '.notifications-center .notification-list-item .monaco-button',
              '.notification-toast .monaco-button',
              '.notification-toast .codicon-close',
              '.notifications-center .codicon-close',
              '[role="dialog"] button',
              '.quick-input-widget .monaco-button'
            ];

            const badWords = ['cancel', 'close', 'not now', 'later', 'skip', 'dismiss', 'no'];

            for (const selector of selectors) {
              const nodes = Array.from(document.querySelectorAll(selector));
              for (const node of nodes) {
                const text = (node.textContent || '').trim().toLowerCase();
                const title = (node.getAttribute('title') || '').trim().toLowerCase();
                const aria = (node.getAttribute('aria-label') || '').trim().toLowerCase();
                if (badWords.some(word => text === word || title.includes(word) || aria.includes(word) || text.includes(word))) {
                  const rect = node.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
                  }
                }
              }
            }
            return null;
          });

          if (closeTarget) {
            await win.mouse.click(closeTarget.x, closeTarget.y);
            dismissed = true;
          }
        }
      } catch (e) {}

      if (!dismissed) {
        await win.keyboard.press('Escape');
      }

      await win.waitForTimeout(300);
    }
  }

  await dismissStartupPopups();

  // Use Electron window bounds for cropping.
  let cropFilter = null;
  let recordedWindowBounds = null;
  try {
    const bounds = await app.evaluate(async ({ BrowserWindow, screen }) => {
      const browserWindow = BrowserWindow.getAllWindows()[0];
      if (!browserWindow) {
        return null;
      }

      const rawBounds = browserWindow.getBounds();
      const display = screen.getDisplayMatching(rawBounds);
      const scaleFactor = display?.scaleFactor || 1;

      return {
        x: Math.round(rawBounds.x * scaleFactor),
        y: Math.round(rawBounds.y * scaleFactor),
        width: Math.round(rawBounds.width * scaleFactor),
        height: Math.round(rawBounds.height * scaleFactor)
      };
    });

    if (bounds && bounds.width > 0 && bounds.height > 0) {
      recordedWindowBounds = bounds;
      cropFilter = `crop=${bounds.width}:${bounds.height}:${bounds.x}:${bounds.y}`;
      console.log('Will crop recording to VSCode window:', cropFilter);
    }
  } catch (e) {
    console.warn('Could not determine VS Code window bounds for cropping:', e.message);
  }

  let ffmpegProc = null;
  async function startRecording() {
    if (ffmpegProc) {
      return;
    }

    try {
      const tryIndices = [0, 1, 2, 3];
      for (const idx of tryIndices) {
        try {
          const ffArgsBase = ['-y', '-f', 'avfoundation', '-framerate', '30', '-i', `${idx}:none`];
          const ffArgs = cropFilter ? ffArgsBase.concat(['-vf', cropFilter, tempMkvFile]) : ffArgsBase.concat([tempMkvFile]);
          console.log('Attempting ffmpeg with device index', idx);
          let started = false;
          ffmpegProc = spawn('ffmpeg', ffArgs, { stdio: ['pipe', 'ignore', 'pipe'] });
          ffmpegProc.on('error', (err) => {
            console.warn('ffmpeg process error:', err.message);
            ffmpegProc = null;
          });
          ffmpegProc.stderr.on('data', (b) => {
            const s = b.toString();
            const firstLine = s.split('\n')[0];
            console.log('[ffmpeg]', firstLine);
          });
          ffmpegProc.on('exit', (code, sig) => {
            if (!started) {
              console.warn('ffmpeg exited immediately with', code, sig, 'for index', idx);
              ffmpegProc = null;
            }
          });

          await new Promise((res) => setTimeout(res, 700));
          if (ffmpegProc && !ffmpegProc.killed) {
            started = true;
            console.log('Started ffmpeg recording to', tempMkvFile, 'using device', idx);
            return;
          }
        } catch (e) {
          console.warn('ffmpeg attempt failed for index', idx, e.message);
          ffmpegProc = null;
        }
      }

      if (!ffmpegProc) {
        console.warn('Could not start ffmpeg recording on any probed avfoundation index');
      }
    } catch (e) {
      console.warn('Could not start ffmpeg recording:', e.message);
      ffmpegProc = null;
    }
  }

  async function stopRecording() {
    if (!ffmpegProc || ffmpegProc.killed) {
      return;
    }

    const proc = ffmpegProc;
    ffmpegProc = null;

    // ffmpeg avfoundation on macOS ignores stdin/SIGINT/SIGTERM.
    // We record to MKV (resilient to abrupt termination) and convert to MP4 after.
    try {
      proc.stdin.write('q\n');
    } catch (e) {}

    await new Promise((resolve) => {
      proc.once('exit', resolve);
      setTimeout(() => {
        try {
          proc.kill('SIGKILL');
        } catch (e) {}
        resolve();
      }, 1500);
    });

    // Convert MKV → MP4 (re-mux without re-encoding)
    if (fs.existsSync(tempMkvFile)) {
      try {
        const { execSync } = require('child_process');
        execSync(`ffmpeg -y -i "${tempMkvFile}" -c copy "${outFile}" 2>/dev/null`);
        fs.unlinkSync(tempMkvFile);
        console.log('Recording saved to', outFile);
      } catch (e) {
        console.warn('MKV→MP4 conversion failed:', e.message);
      }
    }
  }

  const isMac = process.platform === 'darwin';
  const mod = isMac ? 'Meta' : 'Control';

  let cleanupStarted = false;
  async function cleanupAndExit(exitCode) {
    if (cleanupStarted) {
      return;
    }
    cleanupStarted = true;

    try {
      await stopRecording();
    } catch (e) {
      console.warn('Failed while stopping recording during signal cleanup:', e.message);
    }

    try {
      await app.close();
    } catch (e) {
      console.warn('Failed while closing app during signal cleanup:', e.message);
    }

    process.exit(exitCode);
  }

  process.once('SIGINT', () => {
    void cleanupAndExit(130);
  });
  process.once('SIGTERM', () => {
    void cleanupAndExit(143);
  });

  try {

  // Inject a visible cursor overlay into the VS Code window.
  const cursorPngPath = path.join(__dirname, 'cursor.png');
  const cursorDataUrl = 'data:image/png;base64,' + fs.readFileSync(cursorPngPath).toString('base64');

  await win.evaluate((dataUrl) => {
    const TIP_FRAC_X = 3 / 24;
    const TIP_FRAC_Y = 3 / 24;

    const img = new Image();
    img.id = '__demo_cursor__';
    img.src = dataUrl;
    img.style.position = 'fixed';
    img.style.top = '0px';
    img.style.left = '0px';
    img.style.pointerEvents = 'none';
    img.style.zIndex = String(2147483647);
    img.style.transition = 'transform 0.14s';
    img.style.transform = 'scale(1)';

    document.body.appendChild(img);

    img.onload = () => {
      const hotspotX = Math.round(img.naturalWidth * TIP_FRAC_X);
      const hotspotY = Math.round(img.naturalHeight * TIP_FRAC_Y);
      img.dataset.hotspotX = String(hotspotX);
      img.dataset.hotspotY = String(hotspotY);
      img.style.transformOrigin = `${hotspotX}px ${hotspotY}px`;
    };

    window.__demoSetCursorPos = (x, y) => {
      const hsX = parseInt(img.dataset.hotspotX || '0', 10);
      const hsY = parseInt(img.dataset.hotspotY || '0', 10);
      img.style.left = (x - hsX) + 'px';
      img.style.top = (y - hsY) + 'px';
    };

    window.__demoGetCursorPos = () => {
      const hsX = parseInt(img.dataset.hotspotX || '0', 10);
      const hsY = parseInt(img.dataset.hotspotY || '0', 10);
      return {
        x: parseFloat(img.style.left || '0') + hsX,
        y: parseFloat(img.style.top || '0') + hsY
      };
    };

    document.addEventListener('mousemove', (e) => {
      window.__demoSetCursorPos(e.clientX, e.clientY);
    });

    let clickAnimationTimer = null;
    document.addEventListener('mousedown', () => {
      if (clickAnimationTimer) {
        clearTimeout(clickAnimationTimer);
      }
      img.style.transform = 'scale(0.6)';
    });
    document.addEventListener('mouseup', () => {
      if (clickAnimationTimer) {
        clearTimeout(clickAnimationTimer);
      }
      clickAnimationTimer = setTimeout(() => {
        img.style.transform = 'scale(1)';
      }, 180);
    });
  }, cursorDataUrl);

  // Straight-line animated mouse movement helper.
  async function moveMouse(target, durationMs = 100) {
    const start = await win.evaluate(() => {
      if (typeof window.__demoGetCursorPos === 'function') {
        return window.__demoGetCursorPos();
      }
      return null;
    }) || target;

    const distance = Math.hypot(target.x - start.x, target.y - start.y);
    const stepsByDuration = Math.max(3, Math.round(durationMs / 16));
    const stepsByDistance = Math.max(3, Math.round(distance / 24));
    const steps = Math.min(stepsByDuration, stepsByDistance, 18);
    const stepDelay = Math.max(0, durationMs / steps);
    const dx = (target.x - start.x) / steps;
    const dy = (target.y - start.y) / steps;
    for (let i = 1; i <= steps; i++) {
      const x = Math.round(start.x + dx * i);
      const y = Math.round(start.y + dy * i);
      await win.evaluate((pos) => {
        if (typeof window.__demoSetCursorPos === 'function') {
          window.__demoSetCursorPos(pos.x, pos.y);
        }
      }, { x, y });
      await win.mouse.move(x, y);
      if (stepDelay > 0) {
        await win.waitForTimeout(stepDelay);
      }
    }
  }

  // Start with the cursor in the middle of the window.
  const viewportCenter = await win.evaluate(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2)
  }));
  await win.evaluate((center) => {
    if (typeof window.__demoSetCursorPos === 'function') {
      window.__demoSetCursorPos(center.x, center.y);
    }
  }, viewportCenter);
  await win.mouse.move(viewportCenter.x, viewportCenter.y);
  await win.waitForTimeout(500);

  // === Reusable helpers ===

  const workbench = win.frames()[0];
  if (!workbench) {
    throw new Error('Workbench frame not available');
  }

  async function findEditorFrame() {
    for (let i = 0; i < 20; i++) {
      for (const frame of win.frames()) {
        try {
          const hasEditor = await frame.locator('textarea.inputarea').count();
          if (hasEditor > 0) {
            return frame;
          }
        } catch (e) {}
      }
      await win.waitForTimeout(300);
    }
    return null;
  }

  async function openExplorerFile(fileName) {
    console.log(`Opening ${fileName} from Explorer...`);
    await win.keyboard.press(`${mod}+Shift+E`);
    await win.waitForTimeout(800);
    let target = null;
    if (workbench) {
      try {
        target = await workbench.evaluate((fn) => {
          const candidates = Array.from(document.querySelectorAll('[role="treeitem"], .monaco-list-row, .explorer-item, .label-name'));
          for (const node of candidates) {
            const txt = (node.textContent || '').trim().toLowerCase();
            if (txt === fn || txt.endsWith('/' + fn) || txt.includes(fn)) {
              const rect = node.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
              }
            }
          }
          return null;
        }, fileName.toLowerCase());
      } catch (e) { target = null; }
    }
    if (target) {
      await moveMouse(target);
      await win.mouse.click(target.x, target.y);
    } else {
      console.warn(`Could not find ${fileName} in Explorer DOM`);
    }
    await win.waitForTimeout(2500);
  }

  async function clickTabOnRightPanel(tabName) {
    for (const frame of win.frames()) {
      try {
        const tab = frame.locator('button.tab-button-small', { hasText: tabName });
        const count = await tab.count();
        if (count > 0) {
          const box = await tab.first().boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            const target = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
            await moveMouse(target);
            await win.mouse.click(target.x, target.y);
            console.log(`Clicked ${tabName} tab at`, target);
            await win.waitForTimeout(800);
            return true;
          }
        }
      } catch (e) {}
    }
    return false;
  }

  async function typeYamlContent(yamlLines, { clickBodyTab = true } = {}) {
    const editorFrame = await findEditorFrame();
    if (!editorFrame) {
      throw new Error('Could not find Monaco editor in MMT view');
    }
    // Click inside the Monaco editor area to ensure it has keyboard focus.
    const inputArea = editorFrame.locator('textarea.inputarea').first();
    const editorContainer = editorFrame.locator('.monaco-editor').first();
    const box = await editorContainer.boundingBox();
    if (box) {
      await win.mouse.click(box.x + 50, box.y + 50);
      await win.waitForTimeout(300);
    } else {
      await inputArea.evaluate((el) => el.focus());
      await win.waitForTimeout(200);
    }
    await win.keyboard.press(`${mod}+A`);
    await win.keyboard.press('Backspace');
    for (let i = 0; i < yamlLines.length; i++) {
      const line = yamlLines[i];
      for (const char of line) {
        await win.keyboard.type(char, { delay: 0 });
        await win.waitForTimeout(40);
      }
      if (i < yamlLines.length - 1) {
        await win.keyboard.press('Escape');
        await win.keyboard.press('Enter');
        // Monaco may auto-indent the new line. Clear any auto-inserted whitespace
        // so the next line's own leading spaces are typed from column 0.
        await win.keyboard.press('Home');
        await win.keyboard.press('Home');
        await win.keyboard.press('Shift+End');
        await win.keyboard.press('Delete');
      }
      // After typing the 'type:' line, optionally click Body tab to show the right panel reacting.
      if (i === 0 && line.startsWith('type: api') && clickBodyTab) {
        await win.waitForTimeout(500);
        await clickTabOnRightPanel('Body');
        // Click back into the editor to continue typing.
        const box2 = await editorContainer.boundingBox();
        if (box2) {
          await win.mouse.click(box2.x + 50, box2.y + 50);
          await win.waitForTimeout(300);
          // Move mouse to a neutral spot (top-left title bar area) to avoid hover tooltips over text.
          await moveMouse({ x: 100, y: 20 });
          await win.mouse.move(100, 20);
        }
        // Move cursor to end of document before continuing.
        await win.keyboard.press(`${mod}+End`);
      }
    }
    await win.waitForTimeout(500);
    await win.keyboard.press(`${mod}+S`);
    await win.waitForTimeout(1500);
  }

  async function clickSendButton() {
    console.log('Clicking Send...');
    let sendTarget = null;
    for (const frame of win.frames()) {
      try {
        const sendBtn = frame.locator('button[title="Send"]');
        const count = await sendBtn.count();
        if (count > 0) {
          const box = await sendBtn.first().boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            sendTarget = { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) };
            console.log('Found Send button via DOM at', sendTarget);
            break;
          }
        }
      } catch (e) {}
    }
    if (!sendTarget) {
      try {
        const screenshot = await win.screenshot({ scale: 'css', animations: 'disabled' });
        sendTarget = findGreenSendButton(screenshot);
        if (sendTarget) {
          console.log('Detected Send button visually at', sendTarget);
        }
      } catch (e) {
        console.warn('Visual Send detection failed:', e.message);
      }
    }
    if (sendTarget) {
      await moveMouse(sendTarget);
      await win.evaluate((pos) => {
        if (typeof window.__demoSetCursorPos === 'function') {
          window.__demoSetCursorPos(pos.x, pos.y);
        }
      }, sendTarget);
      await win.mouse.click(sendTarget.x, sendTarget.y);
    } else {
      console.warn('Could not find Send button');
    }
    await win.waitForTimeout(2000);
  }

  // === Phase 1: Type and send post_with_inputs_outputs.mmt ===
  await openExplorerFile('post_with_inputs_outputs.mmt');
  await startRecording();

  console.log('Typing API YAML into post_with_inputs_outputs.mmt...');
  await typeYamlContent([
    'type: api',
    'title: Post echo with inputs',
    'description: Send dynamic values via inputs and extract them from the echoed response',
    'inputs:',
    '  username: alice',
    '  role: admin',
    'outputs:',
    '  echoed_username: body[body][username]',
    '  echoed_role: body[body][role]',
    '  method: body[method]',
    'url: https://test.mmt.dev/echo',
    'method: post',
    'format: json',
    'body:',
    '  username: i:username',
    '  role: i:role'
  ]);

  // Click "In / Out" tab to show the inputs panel with default values.
  await clickTabOnRightPanel('In / Out');
  await win.waitForTimeout(1000);

  await clickSendButton();

  // After the response arrives, the outputs should be populated.
  // Click "In / Out" tab again to show the outputs.
  await clickTabOnRightPanel('In / Out');
  await win.waitForTimeout(1500);

  // === Phase 2: Type and send get_with_outputs.mmt ===
  await openExplorerFile('get_with_outputs.mmt');

  console.log('Typing API YAML into get_with_outputs.mmt...');
  await typeYamlContent([
    'type: api',
    'title: Get user info',
    'description: Fetch a JSON payload and extract fields as outputs',
    'outputs:',
    '  name: body[name]',
    '  item_count: body[tags].length',
    '  first_tag: body[tags][0]',
    'url: https://test.mmt.dev/json',
    'method: get',
    'format: json'
  ], { clickBodyTab: false });

  // Click "In / Out" tab to show the outputs definition.
  await clickTabOnRightPanel('In / Out');
  await win.waitForTimeout(1000);

  await clickSendButton();

  // After the response arrives, show the extracted outputs.
  await clickTabOnRightPanel('In / Out');
  await win.waitForTimeout(1500);

  console.log(`${demoName} demo completed.`);
  } finally {
    await stopRecording();

    try {
      await app.close();
    } catch (e) {
      console.warn('Failed to close app cleanly:', e.message);
    }
  }
}

run().catch(err => {
  console.error(`${path.basename(__filename, '.js')} failed:`, err);
  process.exit(1);
});
