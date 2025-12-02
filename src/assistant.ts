import * as vscode from 'vscode';
import * as path from 'path';
import YAML from 'yaml';
import { runner, docParsePack, apiParsePack, docHtml } from 'mmt-core';
import { runJSCode } from 'mmt-core/jsRunner';
import * as mmtcore from 'mmt-core';

async function handleChatRequest(
    request: any, _chatContext: any, response: any,
    context: vscode.ExtensionContext, id: string) {
  const userText = request.message ?? '';
  const userTextLower = userText.toLowerCase();

  // Handle structured chat commands: /run, /print-js, /doc
  if (request.command === 'run' || request.command === 'print-js' || request.command === 'doc') {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      response.markdown('No workspace folder is open.');
      return;
    }
    const projectRoot = ws.uri.fsPath;

    // Simple token parser: split by spaces preserving quoted strings
    const tokens = (request.prompt || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
    const unquote = (s: string) => s.replace(/^['"]|['"]$/g, '');

    // Helpers: parse --key=value and repeated pairs
    const takeFlag = (name: string) => tokens.some((t: string) => t === `--${name}` || t === `-${name[0]}`);
    const findOpt = (name: string) => {
      const pref = `--${name}`;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith(pref + '=')) return unquote(t.slice(pref.length + 1));
        if (t === pref && i + 1 < tokens.length) return unquote(tokens[i + 1]);
      }
      return undefined;
    };
    const collectList = (name: string): string[] => {
      const out: string[] = [];
      const pref = `--${name}`;
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t === pref && i + 1 < tokens.length) {
          out.push(unquote(tokens[i + 1]));
          i++;
        } else if (t.startsWith(pref + '=')) {
          out.push(unquote(t.slice(pref.length + 1)));
        }
      }
      return out;
    };
    const parsePairs = (list: string[]|undefined): Record<string, any> => {
      const out: Record<string, any> = {};
      const arr = Array.isArray(list) ? list : [];
      for (let i = 0; i < arr.length; i++) {
        const token = arr[i] ?? '';
        const eq = token.indexOf('=');
        if (eq > 0) {
          const k = token.slice(0, eq).trim();
          const v = token.slice(eq + 1);
          if (k) out[k] = v;
        } else if (i + 1 < arr.length) {
          const k = token.trim();
          const v = arr[++i];
          if (k) out[k] = v;
        }
      }
      return out;
    };

    const argFile = tokens.find((t: string) => !t.startsWith('-')) || '';
    const relPath = unquote(argFile);
    if (!relPath) {
      response.markdown('Usage: /run <file> [--input key=val ...] [--env key=val ...] [--env-file path] [--preset name] [--print-js]');
      return;
    }
    const fileUri = vscode.Uri.file(path.isAbsolute(relPath) ? relPath : path.join(projectRoot, relPath));
    const dir = path.dirname(fileUri.fsPath);

    const nodeLoader = async (p: string) => {
      const abs = path.isAbsolute(p) ? p : path.join(dir, p);
      try {
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(abs));
        return Buffer.from(data).toString('utf8');
      } catch {
        return '';
      }
    };

    const inputPairs = parsePairs(collectList('input'));
    let envVars: Record<string, any> = parsePairs(collectList('env'));

    const envFile = findOpt('env-file');
    const preset = findOpt('preset');
    if (envFile) {
      try {
        const p = path.isAbsolute(envFile) ? envFile : path.join(dir, envFile);
        const data = await vscode.workspace.fs.readFile(vscode.Uri.file(p));
        const doc = YAML.parse(Buffer.from(data).toString('utf8')) as any;
        const variables = doc?.variables || {};
        const presets = doc?.presets || {};
        if (preset) {
          let mapping: Record<string, any>|undefined;
          if (presets.runner && presets.runner[preset]) {
            mapping = presets.runner[preset];
          } else if (preset.includes('.')) {
            const [group, name] = preset.split('.', 2);
            if (presets[group] && presets[group][name]) mapping = presets[group][name];
          }
          if (mapping) {
            for (const [k, choice] of Object.entries(mapping)) {
              const def = variables?.[k];
              if (def && typeof def === 'object' && !Array.isArray(def) && Object.prototype.hasOwnProperty.call(def, choice)) {
                envVars[k] = def[choice as any];
              } else {
                envVars[k] = choice;
              }
            }
          }
        }
        // Apply overrides
        for (const [k, v] of Object.entries(envVars)) {
          const def = variables?.[k];
          if (def && typeof def === 'object' && !Array.isArray(def)) {
            envVars[k] = Object.prototype.hasOwnProperty.call(def, v) ? def[v] : v;
          }
        }
      } catch (e: any) {
        response.markdown(`Failed to read env file: ${e?.message || e}`);
        return;
      }
    }

    try {
      if (request.command === 'run') {
        const data = await vscode.workspace.fs.readFile(fileUri);
        const rawText = Buffer.from(data).toString('utf8');
        const name = path.basename(fileUri.fsPath).replace(/[^a-zA-Z0-9_]/g, '_');
        const js = await runner.generateTestJs({ rawText, name, inputs: inputPairs, envVars, fileLoader: nodeLoader});
        const printJs = takeFlag('print-js');
        if (printJs) {
          response.markdown('```js');
          response.markdown(js.trim());
          response.markdown('```');
        }
        const result = await runner.runGeneratedJs(js, path.basename(fileUri.fsPath), (lvl, msg) => {}, runJSCode);
        // Pretty output formatting (single message with line breaks)
        const nameOnly = path.basename(fileUri.fsPath);
        const logsBlock = (result.logs && result.logs.length)
          ? `Logs:\n\n\`\`\`\n${result.logs.join('\n')}\n\`\`\``
          : '';
        const errorsBlock = (result.errors && result.errors.length)
          ? ['Errors:', ...result.errors.map(e => ` - ${e}`)].join('\n')
          : '';
        const out = [
          `Running test ${nameOnly}...`,
          logsBlock,
          `Success: ${result.success}`,
          `Duration: ${result.durationMs.toFixed(2)} ms`,
          errorsBlock
        ].filter(Boolean).join('\n');
        response.markdown(out);
        const outFile = findOpt('out');
        if (outFile) {
          const outPath = path.isAbsolute(outFile) ? outFile : path.join(projectRoot, outFile);
          await vscode.workspace.fs.writeFile(vscode.Uri.file(outPath), Buffer.from(JSON.stringify(result, null, 2), 'utf8'));
          response.markdown(`Result written: ${outPath}`);
        }
        return;
      }
      if (request.command === 'print-js') {
        const data = await vscode.workspace.fs.readFile(fileUri);
        const rawText = Buffer.from(data).toString('utf8');
        const name = path.basename(fileUri.fsPath).replace(/[^a-zA-Z0-9_]/g, '_');
        const js = await runner.generateTestJs({ rawText, name, inputs: inputPairs, envVars, fileLoader: nodeLoader});
        if (!js.trim()) {
          response.markdown('No JS could be generated (empty flow).');
          return;
        }
        response.markdown('```js');
        response.markdown(js.trim());
        response.markdown('```');
        return;
      }
      if (request.command === 'doc') {
        const data = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(data).toString('utf8');
        const doc = docParsePack.yamlToDoc(text) as any;
        const docDir = path.dirname(fileUri.fsPath);
        const sources: string[] = [];
        if (Array.isArray(doc.sources)) sources.push(...doc.sources);
        if (Array.isArray(doc.services)) {
          for (const s of doc.services) {
            if (Array.isArray(s?.sources)) sources.push(...s.sources);
          }
        }
        const files = new Set<string>();
        const walk = async (p: string) => {
          try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
            if ((stat.type & vscode.FileType.Directory) !== 0) {
              const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(p));
              for (const [name, type] of entries) {
                await walk(path.join(p, name));
              }
            } else if ((stat.type & vscode.FileType.File) !== 0 && p.toLowerCase().endsWith('.mmt')) {
              files.add(p);
            }
          } catch {
          }
        };
        for (const s of sources) {
          const abs = path.isAbsolute(s) ? s : path.join(docDir, s);
          if (/\.mmt$/i.test(abs)) {
            files.add(abs);
          } else {
            await walk(abs);
          }
        }
        const apis: any[] = [];
        for (const f of Array.from(files)) {
          try {
            const t = await vscode.workspace.fs.readFile(vscode.Uri.file(f));
            const txt = Buffer.from(t).toString('utf8');
            const parsed = YAML.parse(txt) as any;
            if (parsed && parsed.type === 'api') {
              const api = apiParsePack.yamlToAPI(txt) as any;
              (api as any).__file = f;
              apis.push(api);
            }
          } catch {}
        }
        // logo embedding
        let logoDataUrl: string|undefined = undefined;
        const logo = (doc as any)?.logo;
        if (logo && typeof logo === 'string' && !/^https?:\/\//i.test(logo) && !/^data:/i.test(logo)) {
          const p = path.isAbsolute(logo) ? logo : path.join(docDir, logo);
          try {
            const dataBuf = await vscode.workspace.fs.readFile(vscode.Uri.file(p));
            const ext = (path.extname(p) || '').toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.svg' ? 'image/svg+xml' : ext === '.gif' ? 'image/gif' : 'application/octet-stream';
            logoDataUrl = `data:${mime};base64,${Buffer.from(dataBuf).toString('base64')}`;
          } catch {}
        }
        const useMd = !!tokens.find((t: string) => t === '--md');
        const htmlOrMd = (docHtml && !useMd) ?
            docHtml.buildDocHtml(apis, {
              title: (doc as any).title,
              description: (doc as any).description,
              logo: logoDataUrl || (doc as any).logo,
              sources: Array.isArray(doc.sources) ? doc.sources : undefined,
              services: Array.isArray(doc.services) ? doc.services : undefined,
            }) :
            (mmtcore as any).docMarkdown.buildDocMarkdown(apis, {
              title: (doc as any).title,
              description: (doc as any).description,
              logo: logoDataUrl || (doc as any).logo,
              sources: Array.isArray(doc.sources) ? doc.sources : undefined,
              services: Array.isArray(doc.services) ? doc.services : undefined,
            });
        const outPathOpt = findOpt('out');
        if (outPathOpt) {
          const outPath = path.isAbsolute(outPathOpt) ? outPathOpt : path.join(projectRoot, outPathOpt);
          await vscode.workspace.fs.writeFile(vscode.Uri.file(outPath), Buffer.from(htmlOrMd, 'utf8'));
          response.markdown(`Doc generated: ${outPath}`);
        } else {
          response.markdown(htmlOrMd);
        }
        return;
      }
    } catch (e: any) {
      response.markdown(`Command failed: ${e?.message || e}`);
      return;
    }
  }

  // Legacy @mmt /run handler removed in favor of structured chat commands

  // Map of keywords to doc filenames
  const docMap: {[key: string]: string} = {
    testgenai: 'testgen-profile-ai.md',
    testgen: 'testgen-profile.md',
    environment: 'environment-mmt.md',
    api: 'api-mmt.md',
    doc: 'doc-mmt.md',
  };

  // Load all docs content
  const docsContent: {[file: string]: string} = {};
  for (const filename of Object.values(docMap)) {
    const docUri = vscode.Uri.joinPath(context.extensionUri, 'docs', filename);
    try {
      const data = await vscode.workspace.fs.readFile(docUri);
      docsContent[filename] = Buffer.from(data).toString('utf8');
    } catch (err) {
      console.warn(`[multimeter:${id}] failed to read ${filename}`, err);
      docsContent[filename] = '';
    }
  }

  // Base prompt: instruct the model
  const BASE_PROMPT = `
You are the Multimeter Test Generation Assistant.
You MUST follow these formatting rules for any code output:
1. You MUST read the testgenai-profile.md document for details on how to generate tests.
2. You MUST generate tests with the data you have and ask the user for confirmation or additional input.
3. You MUST use the exact structures outlined in the testgenai-profile.md and never deviate them.
4. Use the fence language identifier yaml (i.e. \`\`\`yaml).
5. Inside YAML do not use stray backticks.

Here are the source documents for details(for reference context only, NEVER reprint verbatim unless asked):
${
      Object.entries(docsContent)
          .map(([fname, content]) => `--- ${fname} ---\n${content}`)
          .join('\n\n')}

When responding:
- If user asks "generate" or provides an API/test idea, respond with YAML output following rules above.
- If user asks a conceptual question, provide concise explanation referencing sections; include NO code unless requested.
- If user asks for modification, output only the modified YAML block.

Be concise, deterministic, and avoid placeholders unless unavoidable.
`;

  // Build messages for LLM: include base prompt, history, user message
  const messages: vscode.LanguageModelChatMessage[] = [];
  messages.push(vscode.LanguageModelChatMessage.User(BASE_PROMPT));

  // Include conversation history
  for (const turn of _chatContext.history) {
    // _chatContext.history items may not exactly be ChatRequest/Response,
    // depends on API assuming `turn` has `message` for user, or `response` for
    // assistant
    if ((turn as any).message) {
      messages.push(
          vscode.LanguageModelChatMessage.User((turn as any).message));
    } else if ((turn as any).response) {
      // response may be array of fragments
      const fullResp =
          (turn as any)
              .response.map((r: any) => (r.value?.value ?? r.value ?? ''))
              .join('\n');
      messages.push(vscode.LanguageModelChatMessage.Assistant(fullResp));
    }
  }

  // Finally user's current message
  messages.push(vscode.LanguageModelChatMessage.User(userText));

  // Send to LLM
  const chatResponse =
      await request.model.sendRequest(messages, {}, request.token);

  // Stream response back
  for await (const fragment of chatResponse.text) {
    response.markdown(fragment);
  }
}

export function setupChatParticipants(context: vscode.ExtensionContext) {
  if ((vscode as any).chat && (vscode.chat as any).createChatParticipant) {
    const register = (id: string) => {
      const participant =
          (vscode.chat as any)
              .createChatParticipant(
                  id, async (req: any, chatContext: any, resp: any) => {
                    await handleChatRequest(
                        req, chatContext, resp, context, id);
                  });

      participant.iconPath = {
        light:
            vscode.Uri.joinPath(context.extensionUri, 'res', 'agent-light.png'),
        dark:
            vscode.Uri.joinPath(context.extensionUri, 'res', 'agent-dark.png'),
      };

      context.subscriptions.push(participant);
    };

    register('multimeter');
    register('mmt');
  } else {
    console.log('[multimeter] chatParticipant API is not available.');
  }

  // Command palette helpers that delegate to chat command handling
  const runCmd = vscode.commands.registerCommand('multimeter.run', async () => {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      vscode.window.showErrorMessage('No workspace is open.');
      return;
    }
    const filePick = await vscode.window.showInputBox({
      title: 'Run API/Test',
      prompt: 'Enter relative path to .mmt/.yaml file',
      value: 'examples/test1.mmt'
    });
    if (!filePick) return;
    const args = await vscode.window.showInputBox({
      title: 'Extra args (optional)',
      prompt: 'e.g., --input user=alice --env-file examples/_environments.mmt --preset runner.dev --print-js'
    });
    const fakeReq = {
      command: 'run',
      prompt: `${filePick}${args ? ' ' + args : ''}`,
      model: (vscode as any).model ?? { sendRequest: async () => ({ text: [] }) },
      token: new vscode.CancellationTokenSource().token,
    };
    const fakeResp = { markdown: (t: string) => vscode.window.showInformationMessage((t || '').trim()) };
    await handleChatRequest(fakeReq, { history: [] }, fakeResp, context, 'multimeter');
  });

  const printJsCmd = vscode.commands.registerCommand('multimeter.printJs', async () => {
    const filePick = await vscode.window.showInputBox({ title: 'Print JS from Test', prompt: 'Enter relative path to .mmt/.yaml file', value: 'examples/test1.mmt' });
    if (!filePick) return;
    const args = await vscode.window.showInputBox({ title: 'Extra args (optional)', prompt: 'e.g., --input user=alice --env-file examples/_environments.mmt --preset runner.dev' });
    const fakeReq = { command: 'print-js', prompt: `${filePick}${args ? ' ' + args : ''}`, model: (vscode as any).model ?? { sendRequest: async () => ({ text: [] }) }, token: new vscode.CancellationTokenSource().token };
    const fakeResp = { markdown: (t: string) => vscode.window.showInformationMessage((t || '').trim()) };
    await handleChatRequest(fakeReq, { history: [] }, fakeResp, context, 'multimeter');
  });

  const docCmd = vscode.commands.registerCommand('multimeter.doc', async () => {
    const filePick = await vscode.window.showInputBox({ title: 'Generate Doc', prompt: 'Enter relative path to doc .mmt file', value: 'demos/doc.cap/project-config.json' });
    if (!filePick) return;
    const args = await vscode.window.showInputBox({ title: 'Options (optional)', prompt: 'e.g., --md --out docs/output.md' });
    const fakeReq = { command: 'doc', prompt: `${filePick}${args ? ' ' + args : ''}`, model: (vscode as any).model ?? { sendRequest: async () => ({ text: [] }) }, token: new vscode.CancellationTokenSource().token };
    const fakeResp = { markdown: (t: string) => vscode.window.showInformationMessage((t || '').trim()) };
    await handleChatRequest(fakeReq, { history: [] }, fakeResp, context, 'multimeter');
  });

  context.subscriptions.push(runCmd, printJsCmd, docCmd);
}
