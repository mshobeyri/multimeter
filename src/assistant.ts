import * as vscode from 'vscode';

async function handleChatRequest(
    request: any, _chatContext: any, response: any, context: vscode.ExtensionContext, id: string) {
  const text = request.message ?? '';
  const textLower = text.toLowerCase();

  const docMap: {[key: string]: string} = {
    testgen: 'testgen-profile.md',
    environment: 'environment-mmt.md',
    api: 'api-mmt.md',
    doc: 'doc-mmt.md'
  };

  let selected = 'testgen-profile.md';
  for (const key of Object.keys(docMap)) {
    if (textLower.includes(key)) {
      selected = docMap[key];
      break;
    }
  }

  const docUri = vscode.Uri.joinPath(
      context.extensionUri, 'docs', selected);

  let content = '';
  try {
    const data = await vscode.workspace.fs.readFile(docUri);
    content = Buffer.from(data).toString('utf8');
  } catch (err) {
    console.warn(
        `[multimeter:${id}] couldn't read ${selected}`, err);
    response.markdown(
        `Sorry, I couldn't load the document **${
            selected}**.`);
    return;
  }

  if (selected === 'testgen-profile.md') {
    const lines = content.split('\n');
    interface Section {
      heading: string;
      body: string;
    }
    const sections: Section[] = [];
    let currentHeading: string|null = null;
    let buffer: string[] = [];
    const flush = () => {
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          body: buffer.join('\n').trim(),
        });
      }
      buffer = [];
    };
    for (const line of lines) {
      const m = /^(#{1,4})\s+(.*)$/.exec(line);
      if (m) {
        flush();
        currentHeading = m[2].trim();
      } else {
        buffer.push(line);
      }
    }
    flush();

    const queryTokens =
        textLower.split(/[^a-z0-9]+/)
            .filter((t: string) => t.length > 2);

    const scored = sections
                       .map(sec => {
                         const secText =
                             (sec.heading + ' ' + sec.body)
                                 .toLowerCase();
                         let score = 0;
                         for (const tok of queryTokens) {
                           if (secText.includes(tok)) {
                             score++;
                           }
                         }
                         return {score, sec};
                       })
                       .filter(r => r.score > 0)
                       .sort((a, b) => b.score - a.score)
                       .slice(0, 3);

    if (queryTokens.length === 0 || scored.length === 0) {
      response.markdown(
          `### Multimeter TestGen Profile\n\n` +
          `I have the full profile here. Ask a more specific question (e.g. "suite strategy", "OpenAPI mapping", "data generation tokens"), or mention keywords like *api*, *environment*, *testgen* to get related sections.\n\n` +
          `You can also say "generate me a sample test" or "generate me a sample api" to get starter templates.`);
      return;
    }

    const answerParts = scored.map(r => {
      return `### ${r.sec.heading}\n\n` +
          '```md\n' + r.sec.body + '\n```';
    });

    response.markdown(
        answerParts.join('\n\n') +
        '\n\n(Ask for more detail or another topic.)');
    return;
  }

  const MAX_CHARS = 6000;
  const snippet = content.length > MAX_CHARS ?
      content.slice(0, MAX_CHARS) + `\n\n... (truncated)` :
      content;

  response.markdown(
      `### Multimeter: ${selected}\n\n` +
      '```md\n' + snippet + '\n```' +
      `\n\nAsk for another section by using keywords like: ${
          Object.keys(docMap).join(', ')}.` +
      `\n\nOr try "generate me a sample test" for starter templates.`);
}

export function setupChatParticipants(context: vscode.ExtensionContext) {
  if ((vscode as any).chat && (vscode.chat as any).createChatParticipant) {
    const registerDocsParticipant = (id: string) => {
      const participant =
          (vscode.chat as any)
              .createChatParticipant(
                  id,
                  async (request: any, _chatContext: any, response: any) => {
                    await handleChatRequest(request, _chatContext, response, context, id);
                  });

      participant.iconPath = {
        light:
            vscode.Uri.joinPath(context.extensionUri, 'res', 'agent-light.png'),
        dark:
            vscode.Uri.joinPath(context.extensionUri, 'res', 'agent-dark.png'),
      };
      context.subscriptions.push(participant);
    };

    registerDocsParticipant('multimeter');
    registerDocsParticipant('mmt');
  } else {
    console.log(
        '[multimeter] chatParticipant API unavailable (need Insiders + --enable-proposed-api).');
  }
}