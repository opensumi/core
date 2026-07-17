// Source: test/bdd/acp-chat-agentic-history.scenario.md

import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { expect } from '@playwright/test';

import { OpenSumiApp } from '../app';
import { OpenSumiExplorerView } from '../explorer-view';
import { OpenSumiTextEditor } from '../text-editor';
import { OpenSumiWorkspace } from '../workspace';

import test, { page } from './hooks';
import {
  ACP_BDD_DEFAULT_WORKSPACE,
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  aiNativeWorkbenchUrl,
  ensureAgenticLayout,
  getMockAcpAgentCommand,
  waitForAcpChatReady,
  waitForWorkbenchReady,
  writeAiNativePanelLayoutSettings,
  writeMockAcpAgentSettings,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const CURRENT_SESSION_PREFIX = 'bdd-task-workbench-current';
const OTHER_SESSION_PREFIX = 'bdd-task-workbench-other';
const MISSING_SESSION_PREFIX = 'bdd-task-workbench-missing';
const DIRTY_EDITOR_MESSAGE = 'You have unsaved editor changes. Choose how to continue.';
const PENDING_ACTIVATION_STORAGE_KEY = 'agentic.pending-task-activation.v2';

interface SessionState {
  active: boolean;
  session: { sessionId: string; title: string } | null;
}

let currentWorkspace: OpenSumiWorkspace;
let otherWorkspace: OpenSumiWorkspace;
let missingWorkspace: OpenSumiWorkspace;
let currentWorkspaceDir: string;
let otherWorkspaceDir: string;
let missingWorkspaceDir: string;
let currentOlderSessionId: string;
let currentNewerSessionId: string;
let otherReadySessionId: string;

async function writeNamedHistoryAgents(
  workspaceDir: string,
  userPreferenceDirName: string,
  sessionPrefix: string,
): Promise<void> {
  await writeMockAcpAgentSettings(workspaceDir, {
    agentType: 'claude-agent-acp',
    delayMs: 10,
    fixture: 'history',
    profile: 'interactive',
    sessionPrefix,
  });

  const settingsPath = path.join(workspaceDir, '.sumi', 'settings.json');
  const settings = JSON.parse(await fs.readFile(settingsPath, 'utf8')) as Record<string, unknown>;
  const agents = { ...(settings['ai-native.acp.agents'] as Record<string, unknown>) };
  agents['claude-agent-acp'] = {
    ...getMockAcpAgentCommand({
      agentType: 'claude-agent-acp',
      delayMs: 10,
      fixture: 'history',
      profile: 'interactive',
      sessionPrefix,
    }),
    description: 'Agent A',
  };
  agents['agent-b'] = {
    ...getMockAcpAgentCommand({
      agentType: 'agent-b',
      delayMs: 10,
      fixture: 'history',
      profile: 'interactive',
      sessionPrefix: `${sessionPrefix}-agent-b`,
    }),
    description: 'Agent B',
  };
  settings['ai.native.agent.defaultType'] = 'claude-agent-acp';
  settings['ai.native.agent.configs'] = agents;
  settings['ai-native.acp.agents'] = agents;
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
  const userPreferencePath = path.join(os.homedir(), userPreferenceDirName, 'settings.json');
  await fs.mkdir(path.dirname(userPreferencePath), { recursive: true });
  await fs.writeFile(
    userPreferencePath,
    `${JSON.stringify(
      {
        'ai.native.agent.defaultType': 'claude-agent-acp',
        'ai.native.agent.configs': agents,
        'ai-native.acp.agents': agents,
      },
      null,
      2,
    )}\n`,
    'utf8',
  );
  await writeAiNativePanelLayoutSettings(workspaceDir, 'agentic');
}

async function showAgenticChatView(): Promise<void> {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
  });
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

async function openWorkspace(workspaceDir: string, layout: 'agentic' | 'classic' = 'agentic'): Promise<void> {
  await page.goto(workspaceUrl(workspaceDir, layout), { waitUntil: 'domcontentloaded' });
  await waitForWorkbenchReady(page);
  await showAgenticChatView();
}

function workspaceUrl(workspaceDir: string, layout: 'agentic' | 'classic' = 'agentic'): string {
  const workspace = [currentWorkspace, otherWorkspace, missingWorkspace].find(
    (candidate) => candidate?.workspace.codeUri.fsPath === workspaceDir,
  );
  const url = new URL(aiNativeWorkbenchUrl(workspaceDir, 'interactive', layout), 'http://localhost:8080');
  url.searchParams.set('persistAiNativeE2E', 'true');
  if (workspace) {
    url.searchParams.set('userPreferenceDirName', workspace.userPreferenceDirName);
  }
  return `${url.pathname}${url.search}`;
}

async function getSessionState(): Promise<SessionState> {
  const result = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  expect(result.success).toBe(true);
  return result.result as SessionState;
}

async function expectSession(sessionId: string): Promise<void> {
  await expect.poll(async () => (await getSessionState()).session?.sessionId, { timeout: 30_000 }).toBe(sessionId);
}

function getAgentOptionTestId(agentLabel: 'Agent A' | 'Agent B'): string {
  return `agentic-task-agent-option-${agentLabel === 'Agent A' ? 'claude-agent-acp' : 'agent-b'}`;
}

async function createTask(title: string, agentLabel: 'Agent A' | 'Agent B' = 'Agent A'): Promise<string> {
  const header = page.getByTestId('agentic-chat-panel-header');
  const menuButton = header.getByTestId('agentic-task-agent-menu-button');
  await expect(menuButton).toBeVisible({ timeout: 30_000 });
  await menuButton.click();
  const menu = header.getByTestId('agentic-task-agent-menu');
  await expect(menu).toBeVisible();
  await menu.getByTestId(getAgentOptionTestId(agentLabel)).click();
  await expect(menu).toBeHidden();
  return submitTaskDraft(title, agentLabel);
}

function getTaskDraftComposer() {
  return page.locator('.AI-Chat-slot [contenteditable="true"]').last();
}

async function submitTaskDraft(title: string, agentLabel = 'Agent A'): Promise<string> {
  await page.waitForTimeout(250);
  const draftState = await getSessionState();
  if (draftState.active) {
    throw new Error(`New Task did not enter a draft: ${JSON.stringify({ agentLabel, draftState })}`);
  }

  const input = getTaskDraftComposer();
  await input.click();
  await page.keyboard.insertText(title);
  await page
    .locator('.AI-Chat-slot')
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last()
    .click();
  await expect.poll(async () => (await getSessionState()).session?.sessionId, { timeout: 30_000 }).toBeTruthy();
  const sessionId = (await getSessionState()).session!.sessionId;
  await expect(page.getByTestId(`agentic-task-row-${sessionId}`)).toBeVisible({ timeout: 30_000 });
  return sessionId;
}

async function renameProjectForTask(sessionId: string, label: string): Promise<void> {
  const group = page.locator('[data-testid="agentic-task-project-group"]').filter({
    has: page.getByTestId(`agentic-task-row-${sessionId}`),
  });
  await group.getByRole('button', { name: /^Manage / }).click();
  await page.locator('button[aria-label^="Rename "]').click();
  const input = page.getByLabel('Project name');
  await expect(input).toBeVisible();
  await input.fill(label);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(group).toContainText(label);
}

async function selectTask(sessionId: string): Promise<void> {
  const row = page.getByTestId(`agentic-task-row-${sessionId}`);
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
}

async function dirtyEditor(marker: string): Promise<OpenSumiTextEditor> {
  const app = new OpenSumiApp(page);
  // The active Terminal container can consume the full Agentic workbench height
  // even when the generic Panel slot reports hidden. Hide that actual container
  // before opening the file used to establish the dirty-editor precondition.
  const terminalPanel = page.locator('[data-viewlet-id="terminal"]');
  if (await terminalPanel.isVisible()) {
    await page.locator('#opensumi-bottom-tabbar li#terminal').click();
    await expect(terminalPanel).toBeHidden();
  }
  const explorer = await app.open(OpenSumiExplorerView);
  explorer.initFileTreeView(currentWorkspace.workspace.displayName);
  await explorer.fileTreeView.open();
  const editor = await app.openEditor(OpenSumiTextEditor, explorer, 'editor.js');
  await editor.addTextToNewLineAfterLineByLineNumber(1, marker);
  expect(await editor.isDirty()).toBe(true);
  return editor;
}

async function expectNoDirtyEditorSwitchDialog(): Promise<void> {
  const dialog = page.locator('.kt-overlay:visible').filter({ hasText: DIRTY_EDITOR_MESSAGE });
  await expect(dialog).toHaveCount(0);
}

test.describe('ACP Chat Agentic Task Workbench', () => {
  test.setTimeout(180_000);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await page.setViewportSize({ width: 1600, height: 900 });
    currentWorkspace = new OpenSumiWorkspace([ACP_BDD_DEFAULT_WORKSPACE]);
    otherWorkspace = new OpenSumiWorkspace([ACP_BDD_DEFAULT_WORKSPACE]);
    missingWorkspace = new OpenSumiWorkspace([ACP_BDD_DEFAULT_WORKSPACE]);
    await Promise.all([
      currentWorkspace.initWorksapce(),
      otherWorkspace.initWorksapce(),
      missingWorkspace.initWorksapce(),
    ]);
    currentWorkspaceDir = currentWorkspace.workspace.codeUri.fsPath;
    otherWorkspaceDir = otherWorkspace.workspace.codeUri.fsPath;
    missingWorkspaceDir = missingWorkspace.workspace.codeUri.fsPath;
    await Promise.all([
      writeNamedHistoryAgents(currentWorkspaceDir, currentWorkspace.userPreferenceDirName, CURRENT_SESSION_PREFIX),
      writeNamedHistoryAgents(otherWorkspaceDir, otherWorkspace.userPreferenceDirName, OTHER_SESSION_PREFIX),
      writeNamedHistoryAgents(missingWorkspaceDir, missingWorkspace.userPreferenceDirName, MISSING_SESSION_PREFIX),
    ]);

    await openWorkspace(currentWorkspaceDir);
    currentOlderSessionId = await createTask('Current older');
    currentNewerSessionId = await createTask('Current newer');
    const unnamedCurrentGroup = page.locator('[data-testid="agentic-task-project-group"]').filter({
      has: page.getByTestId(`agentic-task-row-${currentNewerSessionId}`),
    });
    await expect(unnamedCurrentGroup.getByTitle(currentWorkspaceDir, { exact: true })).toContainText(
      path.basename(currentWorkspaceDir),
    );
    await renameProjectForTask(currentNewerSessionId, 'Project Current');

    await openWorkspace(otherWorkspaceDir);
    otherReadySessionId = await createTask('Other ready');
    await renameProjectForTask(otherReadySessionId, 'Project Other');

    await openWorkspace(missingWorkspaceDir);
    const missingReadySessionId = await createTask('Missing ready');
    await renameProjectForTask(missingReadySessionId, 'Project Missing');
    await fs.rm(missingWorkspaceDir, { recursive: true, force: true });

    await openWorkspace(currentWorkspaceDir);
    await renameProjectForTask(currentNewerSessionId, 'Project Current');
    await renameProjectForTask(otherReadySessionId, 'Project Other');
    const search = page.getByPlaceholder('Search tasks');
    await search.fill('Missing');
    await search.fill('');
  });

  test.afterAll(async () => {
    currentWorkspace?.dispose();
    otherWorkspace?.dispose();
    missingWorkspace?.dispose();
    await Promise.all(
      [currentWorkspace, otherWorkspace, missingWorkspace]
        .filter(Boolean)
        .map((workspace) =>
          fs.rm(path.join(os.homedir(), workspace.userPreferenceDirName), { recursive: true, force: true }),
        ),
    );
  });

  test('runs the contextual Task Workbench BDD contract with safe restore', async ({ browser: _browser }, testInfo) => {
    void _browser;
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-history', {
      sourceScenario: 'test/bdd/acp-chat-agentic-history.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const currentGroup = page.locator('[data-testid="agentic-task-project-group"]').filter({
      has: page.getByTestId(`agentic-task-row-${currentNewerSessionId}`),
    });
    const otherGroup = page.locator('[data-testid="agentic-task-project-group"]').filter({
      has: page.getByTestId(`agentic-task-row-${otherReadySessionId}`),
    });

    await expect(page.getByTestId('agentic-task-list')).toBeVisible();
    await expect(page.getByTestId('agentic-chat-panel-header')).toBeVisible();
    await expect(page.locator('#workbench-editor')).toBeVisible();
    await expect(page.locator('[data-viewlet-id="explorer"]')).toBeVisible();
    await expect(currentGroup.getByTestId('agentic-task-launch-button')).toHaveCount(1);
    await expect(otherGroup.getByTestId('agentic-task-launch-button')).toHaveCount(1);
    await expect(page.getByTestId('agentic-project-add-button')).toBeVisible();
    await expect(currentGroup.getByTitle(currentWorkspaceDir, { exact: true })).toContainText('Project Current');
    await expect(otherGroup.getByTitle(otherWorkspaceDir, { exact: true })).toContainText('Project Other');
    await expect(currentGroup.getByTestId('agentic-task-launch-button')).toHaveAttribute(
      'aria-label',
      'New Task for Project Current',
    );
    await expect(currentGroup.getByTestId('agentic-task-agent-menu-button')).toHaveCount(0);
    await expect(page.getByText('Project Missing', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Missing ready', { exact: true })).toHaveCount(0);
    const currentProjectLaunchButton = currentGroup.getByTestId('agentic-task-launch-button');
    await expect(currentProjectLaunchButton).toHaveCSS('opacity', '0.72');
    await currentProjectLaunchButton.hover();
    await expect(currentProjectLaunchButton).toHaveCSS('opacity', '1');
    await currentProjectLaunchButton.focus();
    await expect(currentProjectLaunchButton).toHaveCSS('opacity', '1');

    const search = page.getByPlaceholder('Search tasks');
    await search.fill('Current older');
    await expect(page.getByTestId(`agentic-task-row-${currentOlderSessionId}`)).toBeVisible();
    await expect(page.getByTestId(`agentic-task-row-${currentNewerSessionId}`)).toHaveCount(0);
    await expect(page.getByTestId(`agentic-task-row-${otherReadySessionId}`)).toHaveCount(0);
    await search.fill('Missing');
    await expect(page.getByText('Missing ready', { exact: true })).toHaveCount(0);
    await search.fill('');

    const initialTaskListState = {
      currentNewerVisible: await page.getByTestId(`agentic-task-row-${currentNewerSessionId}`).isVisible(),
      currentOlderVisible: await page.getByTestId(`agentic-task-row-${currentOlderSessionId}`).isVisible(),
      otherReadyVisible: await page.getByTestId(`agentic-task-row-${otherReadySessionId}`).isVisible(),
      unavailableProjectVisible: await page.getByText('Project Missing', { exact: true }).count(),
    };
    const initialScreenshot = await evidence.captureScreenshot(
      page,
      '01-task-list-and-workbench',
      'Task List, conversation, Explorer, and editor are visible while unavailable Projects are filtered',
    );
    const initialProof = await evidence.saveJson(
      '01-task-list-and-registry',
      initialTaskListState,
      'The deterministic history fixture renders current and other Tasks while filtering the unavailable Project from the Task List',
    );

    const header = page.getByTestId('agentic-chat-panel-header');
    const launcher = header.getByTestId('agentic-task-launch-button');
    const fullscreen = page.locator('#agentic-chat-panel-header-maximize [role="button"]');
    const [launcherBox, fullscreenBox] = await Promise.all([launcher.boundingBox(), fullscreen.boundingBox()]);
    expect(launcherBox).not.toBeNull();
    expect(fullscreenBox).not.toBeNull();
    expect((launcherBox?.x || 0) + (launcherBox?.width || 0)).toBeLessThanOrEqual(fullscreenBox?.x || 0);

    await launcher.click();
    const agentMenu = header.getByTestId('agentic-task-agent-menu');
    await expect(agentMenu).toBeVisible();
    await expect(page.getByText('Choose Project', { exact: true })).toHaveCount(0);
    await agentMenu.getByTestId(getAgentOptionTestId('Agent A')).click();
    const headerDirectSession = await submitTaskDraft('Header direct draft');
    await expect(page.getByTestId(`agentic-task-row-${headerDirectSession}`)).toBeVisible();

    const urlBeforeProjectLaunch = page.url();
    await otherGroup.getByTestId('agentic-task-launch-button').click();
    await expect(getTaskDraftComposer()).toBeVisible();
    expect(page.url()).toBe(urlBeforeProjectLaunch);
    await submitTaskDraft('Project recall draft');
    const urlBeforeHeaderForeignProjectLaunch = page.url();
    const launchedAgentBSession = await createTask('Agent B contextual draft', 'Agent B');
    expect(page.url()).toBe(urlBeforeHeaderForeignProjectLaunch);
    const launchProof = await evidence.saveJson(
      '02-contextual-launch',
      {
        activeSession: await getSessionState(),
        currentWorkspaceUrl: page.url(),
        headerForeignProjectLaunchUrl: urlBeforeHeaderForeignProjectLaunch,
        projectLaunchUrl: urlBeforeProjectLaunch,
        launchedTaskVisible: await page.getByTestId(`agentic-task-row-${launchedAgentBSession}`).isVisible(),
      },
      'Project Other launches its recalled Agent in place, and the Header Agent menu keeps the selected Task Project without navigating the current workspace',
    );

    await selectTask(currentOlderSessionId);
    await expectSession(currentOlderSessionId);

    const dirtyMarker = '// BDD_SESSION_FIRST';
    const dirtyEditorInCurrentWorkspace = await dirtyEditor(dirtyMarker);
    const urlBeforeSelection = page.url();
    await selectTask(otherReadySessionId);
    await expectSession(otherReadySessionId);
    expect(page.url()).toBe(urlBeforeSelection);
    await expect(page.getByTestId('agentic-task-execution-context')).toHaveAttribute('title', otherWorkspaceDir);
    await expect(page.getByTestId(`agentic-task-unread-${otherReadySessionId}`)).toHaveCount(0);
    await expectNoDirtyEditorSwitchDialog();
    expect(await dirtyEditorInCurrentWorkspace.isDirty()).toBe(true);
    expect(await page.evaluate((key) => window.sessionStorage.getItem(key), PENDING_ACTIVATION_STORAGE_KEY)).toBeNull();
    const activationProof = await evidence.saveJson(
      '03-cross-project-activation',
      {
        active: await getSessionState(),
        executionContext: await page.getByTestId('agentic-task-execution-context').getAttribute('title'),
        urlAfterSelection: page.url(),
        urlBeforeSelection,
      },
      'Cross-project activation restores the matching ACP session in place while retaining the current workbench URL and workspace',
    );

    const urlBeforeForeignProjectLaunch = page.url();
    await otherGroup.getByTestId('agentic-task-launch-button').click();
    await expect(getTaskDraftComposer()).toBeVisible();
    expect(page.url()).toBe(urlBeforeForeignProjectLaunch);
    await expectNoDirtyEditorSwitchDialog();
    expect(await dirtyEditorInCurrentWorkspace.isDirty()).toBe(true);
    const dirtyProof = await evidence.saveJson(
      '04-session-first-dirty-editor',
      {
        activeSession: await getSessionState(),
        currentWorkspaceUrl: page.url(),
        projectLaunchUrl: urlBeforeForeignProjectLaunch,
        retainedDirtyMarker: dirtyMarker,
      },
      'Cross-project selection and Project-group launch retain the dirty current-workspace editor without displaying a save/discard dialog',
    );

    const currentNewerRow = page.getByTestId(`agentic-task-row-${currentNewerSessionId}`);
    const archiveCurrentNewer = page.getByTestId(`agentic-task-archive-${currentNewerSessionId}`);
    await currentNewerRow.hover();
    await expect(archiveCurrentNewer).toHaveCSS('pointer-events', 'auto');
    await archiveCurrentNewer.click();
    await expect(page.getByTestId(`agentic-task-row-${currentNewerSessionId}`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Archived Tasks', exact: true }).click();
    const archivedCurrentNewer = page.getByTestId(`agentic-task-row-${currentNewerSessionId}`);
    const unarchiveCurrentNewer = page.getByTestId(`agentic-task-unarchive-${currentNewerSessionId}`);
    await archivedCurrentNewer.hover();
    await expect(unarchiveCurrentNewer).toHaveCSS('pointer-events', 'auto');
    await unarchiveCurrentNewer.click();
    await expect(page.getByTestId(`agentic-task-row-${currentNewerSessionId}`)).toBeVisible();

    await writeAiNativePanelLayoutSettings(currentWorkspaceDir, 'classic');
    await page.goto(workspaceUrl(currentWorkspaceDir, 'classic'), { waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
      timeout: 60_000,
    });
    await page.evaluate(async () => {
      await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
    });
    await waitForAcpChatReady(page);
    await expect(page.getByTestId('acp-chat-history-button')).toBeVisible();

    await writeAiNativePanelLayoutSettings(currentWorkspaceDir, 'agentic');
    await openWorkspace(currentWorkspaceDir);
    await expect(page.getByTestId('agentic-task-list')).toBeVisible();
    await expect(page.getByTestId('agentic-chat-panel-header').getByTestId('agentic-task-launch-button')).toBeVisible();
    const layoutProof = await evidence.saveJson(
      '05-archive-and-layout-boundary',
      { classicHistoryButton: true },
      'Archive/unarchive keeps the Task in its Project and Classic retains its own history action before Agentic is restored',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement:
        'Task List keeps all four Agentic regions visible, exposes cwd tooltips, and filters unavailable Project content.',
      status: 'pass',
      evidence: [initialScreenshot, initialProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement:
        'Header New Task is adjacent to fullscreen and opens an Agent dropdown; Project-group + uses its recalled Agent and the Header retains the selected Task Project without an override arrow or workspace navigation.',
      status: 'pass',
      evidence: [launchProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement:
        'Cross-Project Task activation restores the matching ACP session in place while retaining the browser URL, current workspace, and foreign-Project execution context.',
      status: 'pass',
      evidence: [activationProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement:
        'Dirty editors remain untouched during cross-Project Task activation and Project-group launch; no save/discard dialog is rendered.',
      status: 'pass',
      evidence: [dirtyProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP5',
      requirement: 'Archive and Classic/Agentic boundaries preserve Task identity and legacy history behavior.',
      status: 'pass',
      evidence: [layoutProof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: { browserSurface: 'Playwright Chromium', fixture: 'history', profile: 'interactive', url: page.url() },
    });
  });
});
