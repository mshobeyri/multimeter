const { _electron: electron } = require('playwright');
const { createCursor } = require('ghost-cursor-playwright');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function findExecutable() {
  const candidates = [
    '/Applications/Visual Studio Code.app/Contents/MacOS/Code',
    '/Applications/Visual Studio Code.app/Contents/MacOS/Visual Studio Code',
    '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Code - Insiders',
    '/Applications/Visual Studio Code - Insiders.app/Contents/MacOS/Visual Studio Code - Insiders',
    path.join(process.env.HOME || '', 'Applications/Visual Studio Code.app/Contents/MacOS/Code')
  ];
  for (const c of candidates) if (fs.existsSync(c)) return c;
  try {
    const { execSync } = require('child_process');
    const mdfind = execSync("mdfind 'kMDItemCFBundleIdentifier == \"com.microsoft.VSCode\"' | head -n 1").toString().trim();
    if (mdfind) {
      const appPath = mdfind.replace(/\.app\/?$/, '.app');
      const candidate = path.join(appPath, 'Contents', 'MacOS', 'Code');
      if (fs.existsSync(candidate)) return candidate;
    }
  } catch (e) {}
  return null;
}

async function run() {
  const home = process.env.HOME || os.homedir();
  const workspace = path.join(home, 'projects', 'test');
  fs.rmSync(workspace, { recursive: true, force: true });
  fs.mkdirSync(workspace, { recursive: true });

  const filePath = path.join(workspace, 'api.mmt');
  // Ensure file exists so VS Code opens it in an editor
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '');

  const executablePath = await findExecutable();
  if (!executablePath) {
    console.error('Could not find VS Code executable. Edit api_demo.js to set `executablePath`.');
    process.exit(1);
  }

  const profileDir = path.join(__dirname, '.vscode-profile');
  // Install local Multimeter VSIX into a temporary extensions directory and launch VS Code with that extensions dir
  const vsixPath = path.join(path.resolve(__dirname, '..'), 'multimeter-1.14.4.vsix');
  const extensionsDir = path.join(__dirname, '.vscode-extensions');
  if (!fs.existsSync(extensionsDir)) fs.mkdirSync(extensionsDir, { recursive: true });
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });
  const userDir = path.join(profileDir, 'User');
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
  const settingsPath = path.join(userDir, 'settings.json');
  const settings = {
    'workbench.editorAssociations': {
      '*.mmt': 'mmt.editor'
    },
    'security.workspace.trust.enabled': false,
    'editor.acceptSuggestionOnEnter': 'off',
    'editor.quickSuggestions': false,
    'editor.suggestOnTriggerCharacters': false,
    'editor.inlineSuggest.enabled': false,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.panel.defaultLocation': 'bottom',
    'chat.commandCenter.enabled': false,
    'workbench.startupEditor': 'none'
  };
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
  const launchArgs = ['--new-window', workspace, '--user-data-dir', profileDir, '--extensions-dir', extensionsDir, '--disable-workspace-trust'];
  if (fs.existsSync(vsixPath)) {
    console.log('Ensuring VSIX is extracted to', extensionsDir);
    try {
      const { execSync } = require('child_process');
      execSync(`unzip -o "${vsixPath}" -d "${extensionsDir}"`);
      console.log('VSIX extracted.');
    } catch (e) {
      console.warn('Failed to extract VSIX automatically, will continue — you may need to install the extension manually:', e.message);
    }
  } else {
    console.warn('Local multimeter vsix not found at', vsixPath, '— extension will not be installed automatically.');
  }
  const app = await electron.launch({ executablePath, args: launchArgs });

  const win = await app.firstWindow();
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(800);

  const isMac = process.platform === 'darwin';
  const mod = isMac ? 'Meta' : 'Control';
  const PIXEL_POSITIONS = {
    explorerApiFile: { x: 280, y: 348 },
    sendButton: { x: 1232, y: 392 }
  };

  // Inject a visible cursor overlay into the VS Code window using cursor.png.
  // Keep the original image aspect ratio by sizing the image to a fixed
  // rendered height and computing the rendered width from the PNG's
  // natural dimensions. Compute the hotspot (arrow tip) proportionally
  // so it always points exactly at the mouse coordinates.
  const cursorPngPath = path.join(__dirname, 'cursor.png');
  const cursorDataUrl = 'data:image/png;base64,' + fs.readFileSync(cursorPngPath).toString('base64');

  await win.evaluate((dataUrl) => {
    const TARGET_HEIGHT = 32; // rendered cursor height in px
    const TIP_X = 3; // tip position in original 24x24 coordinate space
    const TIP_Y = 3;
    const ORIGINAL_W = 24;
    const ORIGINAL_H = 24;

    const img = new Image();
    img.id = '__demo_cursor__';
    img.src = dataUrl;
    img.style.position = 'fixed';
    img.style.top = '0px';
    img.style.left = '0px';
    img.style.pointerEvents = 'none';
    img.style.zIndex = String(2147483647);
    img.style.transition = 'transform 0.14s';
    img.style.transform = 'scale(0.75)';

    // Append early so layout exists; we'll update size on load.
    document.body.appendChild(img);

    img.onload = () => {
      const naturalW = img.naturalWidth || ORIGINAL_W;
      const naturalH = img.naturalHeight || ORIGINAL_H;
      const renderedH = TARGET_HEIGHT;
      const renderedW = Math.round((naturalW / naturalH) * renderedH);
      img.style.width = renderedW + 'px';
      img.style.height = renderedH + 'px';

      // Compute hotspot coordinates in rendered pixels from original tip coords.
      const hotspotX = Math.round((TIP_X / ORIGINAL_W) * renderedW);
      const hotspotY = Math.round((TIP_Y / ORIGINAL_H) * renderedH);
      img.dataset.hotspotX = String(hotspotX);
      img.dataset.hotspotY = String(hotspotY);
      img.style.transformOrigin = `${hotspotX}px ${hotspotY}px`;
    };

    document.addEventListener('mousemove', (e) => {
      const hsX = parseInt(img.dataset.hotspotX || '0', 10);
      const hsY = parseInt(img.dataset.hotspotY || '0', 10);
      img.style.left = (e.clientX - hsX) + 'px';
      img.style.top  = (e.clientY - hsY) + 'px';
    });

    let clickAnimationTimer = null;
    document.addEventListener('mousedown', () => {
      if (clickAnimationTimer) {
        clearTimeout(clickAnimationTimer);
      }
      img.style.transform = 'scale(0.45)';
    });
    document.addEventListener('mouseup', () => {
      if (clickAnimationTimer) {
        clearTimeout(clickAnimationTimer);
      }
      clickAnimationTimer = setTimeout(() => {
        img.style.transform = 'scale(0.75)';
      }, 180);
    });
  }, cursorDataUrl);

  // Create a ghost cursor for natural animated mouse movements.
  const cursor = await createCursor(win);

  // Start with the cursor already in the middle of the window.
  // Set both the visible overlay position and the ghost cursor's internal
  // previous position so the first animated movement begins from center.
  const viewportCenter = await win.evaluate(() => ({
    x: Math.round(window.innerWidth / 2),
    y: Math.round(window.innerHeight / 2)
  }));
  await win.evaluate((center) => {
    const img = document.getElementById('__demo_cursor__');
    if (!img) {
      return;
    }
    const hsX = parseInt(img.dataset.hotspotX || '0', 10);
    const hsY = parseInt(img.dataset.hotspotY || '0', 10);
    img.style.left = (center.x - hsX) + 'px';
    img.style.top = (center.y - hsY) + 'px';
  }, viewportCenter);
  cursor.previous = viewportCenter;
  await win.mouse.move(viewportCenter.x, viewportCenter.y);
  await win.waitForTimeout(500);

  // Make sure Explorer is visible, then click api.mmt so VS Code opens it with the default MMT custom editor.
  console.log('Opening api.mmt from Explorer...');
  await win.keyboard.press(`${mod}+Shift+E`);
  await win.waitForTimeout(800);

  await cursor.actions.move(PIXEL_POSITIONS.explorerApiFile);
  await win.mouse.click(PIXEL_POSITIONS.explorerApiFile.x, PIXEL_POSITIONS.explorerApiFile.y);

  await win.waitForTimeout(2500);

  const workbench = win.frames()[0];
  if (!workbench) {
    throw new Error('Workbench frame not available');
  }

  // Focus the actual Monaco input area inside the MMT webview and type the requested content.
  console.log('Typing YAML into left MMT editor pane...');
  let editorFrame = null;
  for (let i = 0; i < 20 && !editorFrame; i++) {
    for (const frame of win.frames()) {
      try {
        const hasEditor = await frame.locator('textarea.inputarea').count();
        if (hasEditor > 0) {
          editorFrame = frame;
          break;
        }
      } catch (e) {}
    }
    if (!editorFrame) {
      await win.waitForTimeout(300);
    }
  }

  if (!editorFrame) {
    // Fallback: the pixel click likely missed slightly, so reopen by locating the file row.
    const explorerTarget = await workbench.evaluate(() => {
      const candidates = Array.from(document.querySelectorAll('[role="treeitem"], .monaco-list-row, .explorer-item, .label-name'));
      for (const node of candidates) {
        const txt = (node.textContent || '').trim().toLowerCase();
        if (txt === 'api.mmt' || txt.endsWith('/api.mmt') || txt.includes('api.mmt')) {
          const rect = node.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          };
        }
      }
      return null;
    });

    if (explorerTarget) {
      await cursor.actions.move(explorerTarget);
      await win.mouse.click(explorerTarget.x, explorerTarget.y);
      await win.waitForTimeout(2500);
      for (let i = 0; i < 20 && !editorFrame; i++) {
        for (const frame of win.frames()) {
          try {
            const hasEditor = await frame.locator('textarea.inputarea').count();
            if (hasEditor > 0) {
              editorFrame = frame;
              break;
            }
          } catch (e) {}
        }
        if (!editorFrame) {
          await win.waitForTimeout(300);
        }
      }
    }
  }

  if (!editorFrame) {
    throw new Error('Could not find Monaco editor in MMT view');
  }

  // Animate typing: focus Monaco input, clear, then type character by character.
  // Press Escape before every Enter to dismiss any autocomplete suggestion first.
  const inputArea = editorFrame.locator('textarea.inputarea').first();
  await inputArea.evaluate((el) => el.focus());
  await win.waitForTimeout(200);
  await win.keyboard.press(`${mod}+A`);
  await win.keyboard.press('Backspace');

  const yamlLines = [
    'type: api',
    'url: https://test.mmt.dev/echo',
    'method: post',
    'format: json',
    'body:',
    'username: mehrdad',
    'password: 123456'
  ];

  for (let i = 0; i < yamlLines.length; i++) {
    const line = yamlLines[i];
    // Type each character with a delay for a visible animation.
    for (const char of line) {
      await win.keyboard.type(char, { delay: 0 });
      await win.waitForTimeout(40);
    }
    if (i < yamlLines.length - 1) {
      // Dismiss any open suggestion before pressing Enter to prevent autocomplete acceptance.
      await win.keyboard.press('Escape');
      await win.keyboard.press('Enter');
    }
  }

  await win.waitForTimeout(1000);
  await win.keyboard.press(`${mod}+S`);
  await win.waitForTimeout(1500);

  // Click the green send button on the right side using explicit pixel coordinates.
  console.log('Clicking Send in the right MMT pane...');
  await cursor.actions.move(PIXEL_POSITIONS.sendButton);
  await win.mouse.click(PIXEL_POSITIONS.sendButton.x, PIXEL_POSITIONS.sendButton.y);

  // Wait one second as requested
  await win.waitForTimeout(1000);

  await app.close();
  console.log('api_demo completed — opened', filePath, 'and attempted send click.');
}

run().catch(err => {
  console.error('api_demo failed:', err);
  process.exit(1);
});
