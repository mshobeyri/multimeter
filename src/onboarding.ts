import * as vscode from 'vscode';

const STATE_KEY = 'multimeter.onboarding.levels.v7';

export type OnboardingLevelId = 'welcome'|'firstRequest';
export type OnboardingTaskId =
    'welcome'|'createFile'|'typePost'|'sendFirst'|'changeBody'|'sendAgain'|
    'saveFile';

export interface OnboardingTaskInfo {
  id: OnboardingTaskId;
  title: string;
  icon: string;
  how: string[];
  sample?: string;
}

export interface OnboardingLevelInfo {
  id: OnboardingLevelId;
  title: string;
  intro?: boolean;
  icon: string;
  iconColor: string;
  illustration?: string;
  lead?: string;
  tasks: OnboardingTaskInfo[];
}

export const ONBOARDING_LEVELS: OnboardingLevelInfo[] = [
  {
    id: 'welcome',
    title: 'Welcome to Multimeter',
    intro: true,
    icon: 'smiley',
    iconColor: '#facc15',
    illustration: 'welcome.svg',
    lead:
        'Multimeter is Git-native API testing. Requests are `.mmt` files in your repo, next to the code they hit — not a collection locked in a cloud app.',
    tasks: [
      {
        id: 'welcome',
        title: 'Welcome to Multimeter',
        icon: 'info',
        how: [
          '`.mmt` files are YAML. Open one like any other file, edit it, and commit it.',
          '`type:` at the top sets what the file is: `api`, `test`, `env`, `suite`, and more.',
          'An API is a `.mmt` file with `type: api`. URL, method, and body live in that file.',
        ],
      },
    ],
  },
  {
    id: 'firstRequest',
    title: 'Your first request',
    icon: 'rocket-compact',
    iconColor: '#7dd3fc',
    illustration: 'first-request.svg',
    tasks: [
      {
        id: 'createFile',
        title: 'Create a .mmt file',
        icon: 'new-file',
        how: [
          'Create a `.mmt` file in your project, or [create one now](how).',
        ],
      },
      {
        id: 'typePost',
        title: 'Write type: api for a POST',
        icon: 'edit',
        how: [
          'On the left YAML, type this POST. Do not type in the right panel.',
          'Or [Fill in a sample](how).',
        ],
        sample: `type: api
title: Simple POST
url: https://test.mmt.dev/echo
method: post
format: json
body:
  message: hello
`,
      },
      {
        id: 'sendFirst',
        title: 'Send the first POST',
        icon: 'send',
        how: [
          'Click [Send](how) to send the request to the server. The response appears on the right.',
        ],
      },
      {
        id: 'changeBody',
        title: 'Change the body message',
        icon: 'edit',
        how: [
          'On the left YAML, [change the message](how). Do not type in the right panel.',
        ],
      },
      {
        id: 'sendAgain',
        title: 'Send again',
        icon: 'refresh',
        how: [
          'Click [Send](how) again. The response should show the new `message`.',
        ],
      },
      {
        id: 'saveFile',
        title: 'Save the file',
        icon: 'save',
        how: [
          '[Save](how) the left YAML (`Cmd+S` / `Ctrl+S`). The right side is temporary.',
        ],
      },
    ],
  },
];

export function looksLikeSimplePost(raw: string): boolean {
  const text = String(raw || '');
  return /^\s*type:\s*api\b/m.test(text) &&
      /^\s*method:\s*post\b/im.test(text) &&
      /^\s*url:\s*\S/m.test(text);
}

export function extractMessage(raw: string): string|undefined {
  const yaml = String(raw || '').match(/^\s*message:\s*(.+)$/m);
  if (yaml) {
    return yaml[1].trim().replace(/^['"]|['"]$/g, '');
  }
  const json = String(raw || '').match(/"message"\s*:\s*"([^"]*)"/);
  if (json) {
    return json[1];
  }
  return undefined;
}

function isMmtDocument(document: vscode.TextDocument): boolean {
  return document.languageId === 'mmt' ||
      document.uri.path.toLowerCase().endsWith('.mmt');
}

function allTasks(): OnboardingTaskInfo[] {
  return ONBOARDING_LEVELS.flatMap(level => level.tasks);
}

function emptyTasks(): Record<OnboardingTaskId, boolean> {
  const tasks = {} as Record<OnboardingTaskId, boolean>;
  for (const task of allTasks()) {
    tasks[task.id] = false;
  }
  return tasks;
}

function levelComplete(
    level: OnboardingLevelInfo,
    tasks: Record<OnboardingTaskId, boolean>): boolean {
  return level.tasks.every(task => tasks[task.id]);
}

function currentTaskId(tasks: Record<OnboardingTaskId, boolean>):
    OnboardingTaskId|null {
  const task = allTasks().find(item => !tasks[item.id]);
  return task ? task.id : null;
}

export function coachTargetForTask(task: OnboardingTaskId|null): string {
  if (task === 'createFile') {
    return 'gallery';
  }
  if (task === 'sendFirst' || task === 'sendAgain') {
    return 'send';
  }
  if (task === 'typePost' || task === 'changeBody') {
    return 'yaml';
  }
  return '';
}

function nextStepTitle(currentId: OnboardingTaskId|null): string {
  const tasks = allTasks();
  const index = tasks.findIndex(task => task.id === currentId);
  const next = index >= 0 ? tasks[index + 1] : undefined;
  return next?.title || "Congratulations, You're ready";
}

export interface OnboardingSnapshot {
  complete: boolean;
  levels: Array<{id: OnboardingLevelId; title: string; done: boolean; current: boolean}>;
  levelDoneCount: number;
  levelTotal: number;
  tasks: Array<{id: OnboardingTaskId; title: string; icon: string; done: boolean; current: boolean}>;
  taskDoneCount: number;
  taskTotal: number;
  currentLevelId: OnboardingLevelId;
  currentLevelTitle: string;
  progressPercent: number;
  showSteps: boolean;
  intro: boolean;
  lead: string;
  levelIcon: string;
  levelIconColor: string;
  illustration: string;
  currentTaskId: OnboardingTaskId|null;
  howTitle: string;
  howParagraphs: string[];
  howButton: string;
  howIcon: string;
  howSample: string;
}

interface PersistedOnboarding {
  firstSendMessage?: string;
  tasks: Record<OnboardingTaskId, boolean>;
}

function emptyState(): PersistedOnboarding {
  return {
    firstSendMessage: undefined,
    tasks: emptyTasks(),
  };
}

async function collapseGetStartedPanel(): Promise<void> {
  try {
    await vscode.commands.executeCommand('workbench.action.focusSideBar');
    await new Promise(resolve => setTimeout(resolve, 50));
    await vscode.commands.executeCommand('list.collapse');
  } catch {
    // VS Code has no public API to collapse a view pane.
  }
}

export class OnboardingController {
  private listeners: Array<(snapshot: OnboardingSnapshot) => void> = [];
  private collapseTimer?: NodeJS.Timeout;
  private readonly state: PersistedOnboarding;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.state = this.readState();
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(event => {
          if (isMmtDocument(event.document)) {
            this.onDocumentChange(event.document.getText());
          }
        }),
        vscode.workspace.onDidSaveTextDocument(document => {
          if (isMmtDocument(document) && this.state.tasks.sendAgain) {
            this.mark('saveFile');
          }
        }),
    );
  }

  snapshot(): OnboardingSnapshot {
    const currentId = currentTaskId(this.state.tasks);
    const currentLevel = ONBOARDING_LEVELS.find(
        level => level.tasks.some(task => task.id === currentId)) ||
        ONBOARDING_LEVELS[ONBOARDING_LEVELS.length - 1];
    const currentTask = allTasks().find(task => task.id === currentId);
    const complete = !currentId;
    const overall = allTasks();
    const overallDone = overall.filter(task => this.state.tasks[task.id]).length;
    return {
      complete,
      levels: ONBOARDING_LEVELS.map(level => ({
        id: level.id,
        title: level.title,
        done: levelComplete(level, this.state.tasks),
        current: !complete && currentLevel.id === level.id,
      })),
      levelDoneCount:
          ONBOARDING_LEVELS.filter(level => levelComplete(level, this.state.tasks))
              .length,
      levelTotal: ONBOARDING_LEVELS.length,
      tasks: currentLevel.tasks.map(task => ({
        id: task.id,
        title: task.title,
        icon: task.icon,
        done: !!this.state.tasks[task.id],
        current: currentId === task.id,
      })),
      taskDoneCount: currentLevel.tasks.filter(task => this.state.tasks[task.id]).length,
      taskTotal: currentLevel.tasks.length,
      currentLevelId: currentLevel.id,
      currentLevelTitle: currentLevel.title,
      progressPercent: complete ? 100 :
          Math.round((overallDone / overall.length) * 100),
      showSteps: !currentLevel.intro,
      intro: !!currentLevel.intro,
      lead: currentLevel.lead || '',
      levelIcon: currentLevel.icon,
      levelIconColor: currentLevel.iconColor,
      illustration: currentLevel.illustration || '',
      currentTaskId: currentId,
      howTitle: currentTask?.title || '',
      howParagraphs: currentTask?.how || [],
      howButton: nextStepTitle(currentId),
      howIcon: currentTask?.icon || 'play',
      howSample: currentTask?.sample || '',
    };
  }

  onChange(listener: (snapshot: OnboardingSnapshot) => void): vscode.Disposable {
    this.listeners.push(listener);
    return new vscode.Disposable(() => {
      this.listeners = this.listeners.filter(item => item !== listener);
    });
  }

  onOpenedMmt(): void {
    this.mark('createFile');
  }

  onApiRun(rawFile: string): void {
    this.mark('createFile');
    if (looksLikeSimplePost(rawFile)) {
      this.mark('typePost');
    }
    const message = extractMessage(rawFile);
    if (!this.state.tasks.sendFirst) {
      this.state.firstSendMessage = message;
      this.mark('sendFirst');
      return;
    }
    if (message !== undefined &&
        this.state.firstSendMessage !== undefined &&
        message !== this.state.firstSendMessage) {
      this.mark('changeBody');
      this.mark('sendAgain');
    }
  }

  collapsePanel(): void {
    void collapseGetStartedPanel();
  }

  completeCurrentLevel(): void {
    const currentId = currentTaskId(this.state.tasks);
    if (!currentId) {
      return;
    }
    const currentLevel = ONBOARDING_LEVELS.find(
        level => level.tasks.some(task => task.id === currentId));
    if (!currentLevel) {
      return;
    }
    let changed = false;
    for (const task of currentLevel.tasks) {
      if (!this.state.tasks[task.id]) {
        this.state.tasks[task.id] = true;
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    if (!currentTaskId(this.state.tasks)) {
      this.scheduleCollapse();
    }
    void this.persist();
    this.emit();
  }

  mark(task: OnboardingTaskId): void {
    if (this.state.tasks[task]) {
      return;
    }
    this.state.tasks[task] = true;
    if (!currentTaskId(this.state.tasks)) {
      this.scheduleCollapse();
    }
    void this.persist();
    this.emit();
  }

  async reset(): Promise<void> {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
      this.collapseTimer = undefined;
    }
    this.state.firstSendMessage = undefined;
    this.state.tasks = emptyTasks();
    await this.persist();
    this.emit();
    await vscode.commands.executeCommand('multimeter.start.focus');
  }

  private onDocumentChange(rawFile: string): void {
    if (looksLikeSimplePost(rawFile)) {
      this.mark('createFile');
      this.mark('typePost');
    }
    const message = extractMessage(rawFile);
    if (this.state.tasks.sendFirst &&
        message !== undefined &&
        this.state.firstSendMessage !== undefined &&
        message !== this.state.firstSendMessage) {
      this.mark('changeBody');
    }
  }

  private scheduleCollapse(): void {
    if (this.collapseTimer) {
      clearTimeout(this.collapseTimer);
    }
    this.collapseTimer = setTimeout(() => {
      this.collapsePanel();
    }, 1800);
  }

  private emit(): void {
    const snapshot = this.snapshot();
    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }

  private readState(): PersistedOnboarding {
    const stored = this.context.globalState.get<PersistedOnboarding>(STATE_KEY);
    const tasks = emptyTasks();
    if (stored?.tasks) {
      for (const task of allTasks()) {
        tasks[task.id] = !!stored.tasks[task.id];
      }
    }
    return {
      firstSendMessage: stored?.firstSendMessage,
      tasks,
    };
  }

  private persist(): Thenable<void> {
    return this.context.globalState.update(STATE_KEY, this.state);
  }
}

let instance: OnboardingController|undefined;

export function initOnboarding(context: vscode.ExtensionContext):
    OnboardingController {
  instance = new OnboardingController(context);
  return instance;
}

export function getOnboarding(): OnboardingController|undefined {
  return instance;
}
