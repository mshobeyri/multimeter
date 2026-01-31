import * as mmtcore from 'mmt-core';
import {apiParsePack, docHtml, docParsePack, runner} from 'mmt-core';
import {runJSCode, setRunnerNetworkConfig} from 'mmt-core/jsRunner';
import * as path from 'path';
import * as vscode from 'vscode';
import YAML from 'yaml';

import {parseAssistantRunArgs} from './assistantArgs';
import {getPreparedConfigFromStorage} from '../mmtAPI/network';

async function handleChatRequest(
  request: any, _chatContext: any, response: any,
  context: vscode.ExtensionContext, id: string) {
  const userText = request.message ?? '';
  const userTextLower = userText.toLowerCase();

  // Allow `@mmt run ...` (without a leading slash) in addition to `/run ...`.
  // VS Code structured chat commands populate `request.command`, but plain messages do not.
  if ((!request.command || typeof request.command !== 'string') && typeof userText === 'string') {
    const trimmed = userText.trim();
    const m = trimmed.match(/^(run|print-js|doc|help)\b\s*(.*)$/i);
    if (m) {
      request.command = m[1].toLowerCase();
      request.prompt = (m[2] || '').trim();
    }
  }

  // Provide help mirroring CLI when asked
  const showHelp =
      request.command === 'help' || /(^|\s)\/help(\s|$)/.test(userTextLower);
  if (showHelp) {
    const help = `# Multimeter Assistant\n\n` +
        `## Usage:\n` +
        `  You can ask any question from Multimeter asssistant.\n` +
        `  Also, you can use the following format to interact with Multimeter in form of commands.\n` +
        `  \`@multimeter /[command] [options]\`` +
        `  or` +
        `  \`@mmt /[command] [options]\`. \n\n` +
        `  \`@Multimeter\` stays in the chat after responding, but \`@mmt\` goes away.\n\n` +
        `## Commands:\n` +
        `  \`/run <file>\`                    Test file (.yaml/.yml/.json/.mmt)\n` +
        `    **-q**, **--quiet**              Minimal output\n` +
        `    **-o**, **--out <file>**         Write result JSON to file\n` +
        `    **-i**, **--input <values...>**  Input variables as key value pairs (repeatable)\n` +
        `    **-e**, **--env <values...>**    Environment variables as key value pairs or key=val (repeatable)\n` +
        `    **--env-file <path>**            Environment file (.mmt/.yaml) to read variables from\n` +
        `    **--preset <name>**              Preset name from env file (e.g., runner.dev) or just name under runner\n` +
        `    **--example <name|#n>**          Run a named example (matches \`name\`) or numeric index (#1 = first)\n` +
        `    **--print-js**                   Print generated JS before executing\n\n` +
        `  \`/print-js <file>\`               Convert a test definition file to executable JS and print\n` +
        `    **-s**, **--stages**             Include stage headers as comments when stages exist\n` +
        `    **-i**, **--input <values...>**\n` +
        `    **-e**, **--env <values...>**\n` +
        `    **--env-file <path>**\n` +
        `    **--preset <name>**\n\n` +
        `  \`/doc <file>\`              Generate documentation from a doc .mmt\n` +
        `    **-o**, **--out <file>**   Write output to file (default: <docname>.<ext>)\n` +
        `    **--html**                 Generate HTML (default)\n` +
        `    **--md**                   Generate Markdown instead of HTML\n\n` +
        `## Chat shortcuts:\n` +
        `  \`/run <file> [args]\`       Run a test file (same options as CLI)\n` +
        `  \`/print-js <file> [args]\`  Print generated JS\n` +
        `  \`/doc <file> [--md] [--out <file>]\`  Generate docs\n` +
        `  \`/help\`                    Show this help`;
    response.markdown(help);
    return;
  }

  // Handle structured chat commands: /run, /print-js, /doc
  const isCommand = typeof request.command === 'string' && request.command.length > 0;
  if (isCommand) {
    const ws = vscode.workspace.workspaceFolders?.[0];
    if (!ws) {
      response.markdown('No workspace is open.');
      return;
    }
    const projectRoot = ws.uri.fsPath;
    try {
      if (request.command === 'run') {
        const {runFileOptions, outFile, printJs} =
            await parseAssistantRunArgs(projectRoot, request.prompt || '', context);
        runFileOptions.jsRunner = runJSCode;
        
        // Apply certificate settings from workspace storage
        try {
          const envVars = runFileOptions.envvar || {};
          const netConfig = getPreparedConfigFromStorage(context, envVars);
          setRunnerNetworkConfig(netConfig);
        } catch (e) {
          // Continue without certificates if loading fails
        }
        
        const runOutcome = await runner.runFile(runFileOptions as any);
        const {js, result, displayName, docType, exampleName, exampleIndex} =
            runOutcome as any;

        if (printJs && js && typeof js === 'string' && js.trim()) {
          const safeJs = js.replace(/```/g, '`\u200b``');
          response.markdown('```js\n' + safeJs.trim() + '\n```');
        }

        const nameOnly = displayName || 'run';
        const kindLabel = docType === 'api' ? 'API' :
            docType === 'test'              ? 'test' :
          docType === 'suite'             ? 'suite' :
                                              'Document';
        const exampleLabelParts: string[] = [];
        if (typeof exampleIndex === 'number') {
          exampleLabelParts.push(`#${exampleIndex + 1}`);
        }
        if (exampleName) {
          exampleLabelParts.push(exampleName);
        }
        const header = exampleLabelParts.length ?
            `${kindLabel} ${nameOnly} (example ${exampleLabelParts.join(' ')})` :
            `${kindLabel} ${nameOnly}`;
        const logsBlock = (result.logs && result.logs.length) ?
            `Logs:\n\n\`\`\`\n${result.logs.join('\n')}\n\`\`\`` :
            '';
        const errorsBlock = (result.errors && result.errors.length) ?
            ['Errors:', ...result.errors.map((e: any) => ` - ${e}`)].join('\n') :
            '';
        const out = [
                         `Running ${header}...`, logsBlock,
                         `Success: ${result.success}`,
                         `Duration: ${result.durationMs.toFixed(2)} ms`,
                         errorsBlock
                       ]
                           .filter(Boolean)
                           .join('\n');
        response.markdown(out);
        if (outFile) {
          const outPath = path.isAbsolute(outFile) ? outFile :
                                                       path.join(projectRoot, outFile);
          await vscode.workspace.fs.writeFile(
              vscode.Uri.file(outPath),
              Buffer.from(JSON.stringify(result, null, 2), 'utf8'));
          response.markdown(`Result written: ${outPath}`);
        }
        return;
      }

      if (request.command === 'print-js') {
        const {runFileOptions} =
            await parseAssistantRunArgs(projectRoot, request.prompt || '', context);
        const rawText = runFileOptions.file;
        const inputPairs = runFileOptions.manualInputs || {};
        const envVars = runFileOptions.envvar || {};
        // Use a stable main function name for printed JS
        const name = 'testflow';
        const js = await runner.generateTestJs({
          rawText,
          name,
          inputs: inputPairs,
          envVars,
          fileLoader: runFileOptions.fileLoader,
        });
        if (!js.trim()) {
          response.markdown('No JS could be generated (empty flow).');
          return;
        }
        const safeJs = js.replace(/```/g, '`\u200b``');
        response.markdown('```js\n' + safeJs.trim() + '\n```');
        return;
      }

      if (request.command === 'doc') {
        const tokens =
            (request.prompt || '').match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) ||
            [];
        const unquote = (s: string) => s.replace(/^['"]|['"]$/g, '');
        const argFile = tokens.find((t: string) => !t.startsWith('-')) || '';
        const relPath = unquote(argFile);
        if (!relPath) {
          response.markdown(
              'Usage: /doc <file> [--md] [--out <file>]');
          return;
        }
        const fileUri = vscode.Uri.file(
            path.isAbsolute(relPath) ? relPath :
                                         path.join(projectRoot, relPath));
        const data = await vscode.workspace.fs.readFile(fileUri);
        const text = Buffer.from(data).toString('utf8');
        const doc = docParsePack.yamlToDoc(text) as any;
        const docDir = path.dirname(fileUri.fsPath);
        const sources: string[] = [];
        if (Array.isArray(doc.sources)) {
          sources.push(...doc.sources);
        }
        if (Array.isArray(doc.services)) {
          for (const s of doc.services) {
            if (Array.isArray(s?.sources)) {
              sources.push(...s.sources);
            }
          }
        }
        const files = new Set<string>();
        const walk = async (p: string) => {
          try {
            const stat = await vscode.workspace.fs.stat(vscode.Uri.file(p));
            if ((stat.type & vscode.FileType.Directory) !== 0) {
              const entries =
                  await vscode.workspace.fs.readDirectory(vscode.Uri.file(p));
              for (const [name, type] of entries) {
                await walk(path.join(p, name));
              }
            } else if (
                (stat.type & vscode.FileType.File) !== 0 &&
                p.toLowerCase().endsWith('.mmt')) {
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
          } catch {
          }
        }
        // logo embedding
        let logoDataUrl: string|undefined = undefined;
        const logo = (doc as any)?.logo;
        if (logo && typeof logo === 'string' && !/^https?:\/\//i.test(logo) &&
            !/^data:/i.test(logo)) {
          const p = path.isAbsolute(logo) ? logo : path.join(docDir, logo);
          try {
            const dataBuf =
                await vscode.workspace.fs.readFile(vscode.Uri.file(p));
            const ext = (path.extname(p) || '').toLowerCase();
            const mime = ext === '.png'           ? 'image/png' :
                ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' :
                ext === '.svg'                    ? 'image/svg+xml' :
                ext === '.gif'                    ? 'image/gif' :
                                                    'application/octet-stream';
            logoDataUrl = `data:${mime};base64,${
                Buffer.from(dataBuf).toString('base64')}`;
          } catch {
          }
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
        const findOpt = (name: string) => {
          const pref = `--${name}`;
          for (let i = 0; i < tokens.length; i++) {
            const t = tokens[i];
            if (t.startsWith(pref + '=')) {
              return unquote(t.slice(pref.length + 1));
            }
            if (t === pref && i + 1 < tokens.length) {
              return unquote(tokens[i + 1]);
            }
          }
          return undefined;
        };
        const outPathOpt = findOpt('out');
        if (outPathOpt) {
          const outPath = path.isAbsolute(outPathOpt) ?
              outPathOpt :
              path.join(projectRoot, outPathOpt);
          await vscode.workspace.fs.writeFile(
              vscode.Uri.file(outPath), Buffer.from(htmlOrMd, 'utf8'));
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

  // User-facing docs (paths only, content is not preloaded into the prompt)
  const docMap: {[key: string]: string} = {
    testgenai: 'testgen-profile-ai.md',
    testgen: 'testgen-profile.md',
    environment: 'environment-mmt.md',
    api: 'api-mmt.md',
    doc: 'doc-mmt.md',
  };

  // AI control docs that are always embedded in the base prompt
  const aiDocFiles = [
    'AI/general.md',
    'AI/generate.md',
    'AI/generate-api.md',
    'AI/generate-test.md',
    'AI/generate-env.md',
    'AI/generate-doc.md',
  ];

  const aiDocsContent: {[file: string]: string} = {};
  for (const rel of aiDocFiles) {
    const uri = vscode.Uri.joinPath(context.extensionUri, 'docs', rel);
    try {
      const data = await vscode.workspace.fs.readFile(uri);
      aiDocsContent[rel] = Buffer.from(data).toString('utf8');
    } catch (err) {
      console.warn(`[multimeter:${id}] failed to read AI doc ${rel}`, err);
      aiDocsContent[rel] = '';
    }
  }

  const aiDocsJoined = Object.entries(aiDocsContent)
                            .map(([fname, content]) => `--- ${fname} ---\n${content}`)
                            .join('\n\n');

  const docPathHints = Object.entries(docMap)
                            .map(([key, file]) => `${key}: docs/${file}`)
                            .join('\n');

  // Base prompt: instruct the model
  const BASE_PROMPT = `
You are the Multimeter Test Generation Assistant.

You are given the following AI control documents (read them first and follow them strictly):
${aiDocsJoined}

You also have these user documentation files available by path (content is NOT in the prompt by default):
${docPathHints}

Use the AI docs to decide how to answer and when to generate or edit .mmt files. Refer to the user docs by path only when deeper prose is truly needed.

Please be concise, deterministic, and avoid placeholders unless unavoidable.
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
    if (!filePick) {
      return;
    }
    const args = await vscode.window.showInputBox({
      title: 'Extra args (optional)',
      prompt:
          'e.g., --input user=alice --env-file examples/_environments.mmt --preset runner.dev --print-js'
    });
    const fakeReq = {
      command: 'run',
      prompt: `${filePick}${args ? ' ' + args : ''}`,
      model: (vscode as any).model ?? {sendRequest: async () => ({text: []})},
      token: new vscode.CancellationTokenSource().token,
    };
    const fakeResp = {
      markdown: (t: string) =>
          vscode.window.showInformationMessage((t || '').trim())
    };
    await handleChatRequest(
        fakeReq, {history: []}, fakeResp, context, 'multimeter');
  });

  const printJsCmd =
      vscode.commands.registerCommand('multimeter.print-js', async () => {
        const filePick = await vscode.window.showInputBox({
          title: 'Print JS from Test',
          prompt: 'Enter relative path to .mmt/.yaml file',
          value: 'examples/test1.mmt'
        });
        if (!filePick) {
          return;
        }
        const args = await vscode.window.showInputBox({
          title: 'Extra args (optional)',
          prompt:
              'e.g., --input user=alice --env-file examples/_environments.mmt --preset runner.dev'
        });
        const fakeReq = {
          command: 'print-js',
          prompt: `${filePick}${args ? ' ' + args : ''}`,
          model:
              (vscode as any).model ?? {sendRequest: async () => ({text: []})},
          token: new vscode.CancellationTokenSource().token
        };
        const fakeResp = {
          markdown: (t: string) =>
              vscode.window.showInformationMessage((t || '').trim())
        };
        await handleChatRequest(
            fakeReq, {history: []}, fakeResp, context, 'multimeter');
      });

  const docCmd = vscode.commands.registerCommand('multimeter.doc', async () => {
    const filePick = await vscode.window.showInputBox({
      title: 'Generate Doc',
      prompt: 'Enter relative path to doc .mmt file',
      value: 'demos/doc.cap/project-config.json'
    });
    if (!filePick) {
      return;
    }
    const args = await vscode.window.showInputBox({
      title: 'Options (optional)',
      prompt: 'e.g., --md --out docs/output.md'
    });
    const fakeReq = {
      command: 'doc',
      prompt: `${filePick}${args ? ' ' + args : ''}`,
      model: (vscode as any).model ?? {sendRequest: async () => ({text: []})},
      token: new vscode.CancellationTokenSource().token
    };
    const fakeResp = {
      markdown: (t: string) =>
          vscode.window.showInformationMessage((t || '').trim())
    };
    await handleChatRequest(
        fakeReq, {history: []}, fakeResp, context, 'multimeter');
  });

  context.subscriptions.push(runCmd, printJsCmd, docCmd);
}
