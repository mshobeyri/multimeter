import * as vscode from 'vscode';

async function handleChatRequest(
    request: any, _chatContext: any, response: any,
    context: vscode.ExtensionContext, id: string) {
  const userText = request.message ?? '';
  const userTextLower = userText.toLowerCase();

  // Map of keywords to doc filenames
  const docMap: {[key: string]: string} = {
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
1. You MUST read the testgen-profile.md document for details on how to generate tests.
2. You MUST generate tests with the data you have and ask the user for confirmation or additional input.
3. You MUST use the exact structures outlined in the testgen-profile.md and never deviate them.
4. Use the fence language identifier yaml (i.e. \`\`\`yaml).
5. Inside YAML do not use stray backticks.

Here are the source documents (for reference context only, NEVER reprint verbatim unless asked):
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
}
