// Source: test/bdd/acp-chat-agentic-agent-cwd-file-link.scenario.md

import { promises as fs } from 'fs';
import path from 'path';

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureOptions,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';
import { createBddEvidence } from './utils/bdd-evidence';

const READY_SENTINEL = 'BDD_AGENT_CWD_FILE_LINK_READY';
const AGENT_HOME_MARKER = 'BDD_AGENT_HOME_NOTE_MARKER';
const WORKSPACE_MARKER = 'BDD_WORKSPACE_DECOY_NOTE_MARKER';
const FILE_LINK_PROMPT = 'BDD agent cwd file link';

let runtime: AcpBddFixtureRuntime;

interface LinkProof {
  anchors: Array<{ text: string; href: string }>;
  agentCwdLinkCount: number;
  workspaceReplyHrefCount: number;
}

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function assistantMessage() {
  return chatSlot().locator('.rce-ai-msg').last();
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function sendButton() {
  return chatSlot()
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last();
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.click();
  await page.keyboard.insertText(prompt);
  await expect(input).toContainText(prompt);
  await expect(sendButton()).toBeEnabled({ timeout: 30_000 });
  await sendButton().click();
}

/**
 * after launching an Agentic draft the client asynchronously binds a background
 * session to it (prepareDraftBoundSession). Sending inside that swap window gets
 * swallowed by a half-remounted input (editorRef not yet attached), so wait until
 * the bound session exists and the input area settled before clicking send.
 */
async function waitForDraftBoundSession() {
  await expect
    .poll(
      async () => {
        const state = await page.evaluate(async () => {
          try {
            const response = await (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {});
            return (response?.result?.session ?? null) as {
              sessionId: string;
              requestCount: number;
              threadStatus?: string;
            } | null;
          } catch {
            return null;
          }
        });
        return state ? { ready: true, requestCount: state.requestCount } : { ready: false, requestCount: -1 };
      },
      { timeout: 30_000 },
    )
    .toEqual({ ready: true, requestCount: 0 });
  await page.waitForTimeout(1_000);
}

async function readLinkProof(agentNotePath: string): Promise<LinkProof> {
  return assistantMessage().evaluate((message, expected) => {
    const normalizeFileHref = (href: string) => href.replace(/:\d+(-\d+)?(:\d+)?$/, '');
    const anchors = Array.from(message.querySelectorAll('a')).map((anchor) => ({
      text: anchor.textContent?.trim() || '',
      href: anchor.getAttribute('href') || '',
    }));
    const expectedHref = `file://${expected}`;
    return {
      anchors,
      agentCwdLinkCount: anchors.filter(
        (anchor) => anchor.text.includes('agent-note.md') && normalizeFileHref(anchor.href) === expectedHref,
      ).length,
      workspaceReplyHrefCount: anchors.filter(
        (anchor) => anchor.text.includes('agent-note.md') && normalizeFileHref(anchor.href) !== expectedHref,
      ).length,
    };
  }, agentNotePath);
}

async function readOpenTabUris(): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('#workbench-editor [data-uri]'))
      .map((element) => element.getAttribute('data-uri') || '')
      .filter(Boolean),
  );
}

/** Monaco may tokenize the line, so read the rendered view-lines text instead of matching split nodes. */
async function expectEditorTextContains(marker: string) {
  await expect
    .poll(
      async () => {
        const lines = page.locator('#workbench-editor .view-lines').first();
        return (await lines.textContent()) || '';
      },
      { timeout: 30_000 },
    )
    .toContain(marker);
}

async function readVisualContract(): Promise<{
  chatThinkingPaddingBottom: string | null;
  kaitianIconFontLoaded: boolean;
}> {
  await page.evaluate(() => document.fonts.ready);
  return page.evaluate(() => {
    const thinkingContainer = document.querySelector('[class*="thinking_container"]');
    return {
      chatThinkingPaddingBottom: thinkingContainer ? window.getComputedStyle(thinkingContainer).paddingBottom : null,
      kaitianIconFontLoaded: document.fonts.check('16px kaitian-icon'),
    };
  });
}

/**
 * Creates the disposable agent-home directory with the linked note,
 * plus a distinct decoy note at the IDE workspace root so wrong link
 * resolution is observable.
 */
async function seedNoteFiles(workspaceDir: string): Promise<{ agentHome: string; agentNotePath: string }> {
  const agentHome = path.join(workspaceDir, 'agent-home');
  const agentNotePath = path.join(agentHome, 'notes', 'agent-note.md');
  await fs.mkdir(path.dirname(agentNotePath), { recursive: true });
  await fs.writeFile(agentNotePath, `${AGENT_HOME_MARKER}\n`, 'utf8');

  const workspaceNotePath = path.join(workspaceDir, 'notes', 'agent-note.md');
  await fs.mkdir(path.dirname(workspaceNotePath), { recursive: true });
  await fs.writeFile(workspaceNotePath, `${WORKSPACE_MARKER}\n`, 'utf8');

  return { agentHome, agentNotePath };
}

async function loadWorkbench(options: AcpBddFixtureOptions) {
  runtime = await loadAcpBddFixtureWorkbench(page, options);
  return runtime;
}

test.describe('ACP Chat Agentic Agent-Cwd File Link', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 3);

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('Agent Session cwd (Workspace Target) resolves relative file links, not the IDE workspace', async (_fixtures, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-agent-cwd-file-link', {
      sourceScenario: 'test/bdd/acp-chat-agentic-agent-cwd-file-link.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    // --- Pass 1: session launched from the agent-home Project Group ---
    const passOne = await loadWorkbench({
      fixture: 'file-link-agent-cwd',
      profile: 'interactive',
      delayMs: 10,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    try {
      const { agentHome, agentNotePath } = await seedNoteFiles(passOne.workspaceDir);

      const bridgeAvailable = await page.evaluate(() => Boolean((window as any).__OPENSUMI_E2E__?.addAgenticProject));
      expect(bridgeAvailable, 'loopback e2e project seeding hook must exist').toBe(true);
      const seededProject = await page.evaluate(async (dir) => {
        const record = await (window as any).__OPENSUMI_E2E__.addAgenticProject(dir);
        return record;
      }, agentHome);
      expect(seededProject?.workspacePath).toBe(agentHome);

      const agentHomeGroup = page.locator('[data-testid="agentic-session-project-group"]', {
        hasText: 'agent-home',
      });
      await expect(agentHomeGroup).toBeVisible({ timeout: 30_000 });
      const groupProof = await evidence.saveJson(
        '01-agent-home-project-group',
        { seededProject },
        'agent-home is a Known Workspace Target and renders its Project Group in the Agent Session Browser',
      );
      const groupShot = await evidence.captureScreenshot(
        page,
        '01-agent-home-project-group',
        'Agent Session Browser shows the agent-home Project Group',
      );

      const launchButton = agentHomeGroup.locator('[data-testid="agentic-task-launch-button"]').first();
      await expect(launchButton).toBeVisible({ timeout: 30_000 });
      await launchButton.click();

      const draftContext = page.getByTestId('agentic-task-draft-context');
      await expect(draftContext).toBeVisible({ timeout: 30_000 });
      await expect(draftContext).toContainText('agent-home');
      await evidence.captureScreenshot(page, '02-agent-home-draft-context', 'Session Draft targets agent-home');

      await waitForDraftBoundSession();
      await sendPrompt(FILE_LINK_PROMPT);
      await expect(chatSlot().getByText(READY_SENTINEL)).toBeVisible({ timeout: 30_000 });

      const plainLink = assistantMessage().getByRole('link', { name: 'notes/agent-note.md', exact: true }).first();
      await expect(plainLink).toBeVisible({ timeout: 30_000 });

      const linkProof = await readLinkProof(agentNotePath);
      expect(linkProof.agentCwdLinkCount).toBeGreaterThan(0);
      expect(linkProof.workspaceReplyHrefCount).toBe(0);
      const linkProofArtifact = await evidence.saveJson(
        '02-agent-cwd-link-boundaries',
        linkProof,
        'assistant relative file links resolve against the Agent Session cwd (agent-home), never the IDE workspace',
      );

      // The header exposes the agent working directory because the Workspace Target differs.
      const executionContext = page.getByTestId('agentic-task-execution-context');
      await expect(executionContext).toBeVisible({ timeout: 30_000 });
      await expect(executionContext).toHaveAttribute('title', agentHome);
      const contextProof = await evidence.saveJson(
        '03-agent-execution-context-indicator',
        { title: await executionContext.getAttribute('title') },
        'Agentic Chat header shows the Agent working directory for the differing Workspace Target',
      );

      const messageShot = await evidence.captureScreenshot(
        page,
        '04-agent-cwd-assistant-links',
        'Assistant message renders agent-cwd resolved links with the execution context indicator',
      );

      await plainLink.click();
      const editorTarget = page.locator('#workbench-editor [data-uri$="/agent-home/notes/agent-note.md"]').first();
      await expect(editorTarget).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('#workbench-editor .monaco-editor').first()).toBeVisible({ timeout: 30_000 });
      await expectEditorTextContains(AGENT_HOME_MARKER);

      const tabUris = await readOpenTabUris();
      expect(tabUris.some((uri) => uri.endsWith('/agent-home/notes/agent-note.md'))).toBe(true);
      const decoyUriOpened = tabUris.some(
        (uri) => uri.endsWith('/notes/agent-note.md') && !uri.includes('/agent-home/'),
      );
      expect(decoyUriOpened).toBe(false);
      const openedProof = await evidence.saveJson(
        '05-agent-home-note-opened',
        { tabUris },
        'clicking the relative link opens the agent-home note, not the workspace-root decoy',
      );
      const editorShot = await evidence.captureScreenshot(
        page,
        '06-agent-home-note-opened',
        'Editor opens the agent-home copy of notes/agent-note.md with its marker content',
      );

      const visualContract = await readVisualContract();
      expect(visualContract.chatThinkingPaddingBottom).toBe('28px');
      expect(visualContract.kaitianIconFontLoaded).toBe(true);
      const visualProof = await evidence.saveJson(
        '07-chat-shell-visual-contract',
        visualContract,
        'chat thinking strip reserves 28px bottom padding and the kaitian-icon font is loaded',
      );

      evidence.recordCriticalPoint({
        id: 'CP1',
        requirement:
          'The agent-home Project Group can launch an Agent Session whose Workspace Target differs from the IDE workspace.',
        status: 'pass',
        evidence: [groupProof, groupShot].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP2',
        requirement: 'Assistant relative file links use the Agent Session cwd, not the IDE workspace root.',
        status: 'pass',
        evidence: [linkProofArtifact!, messageShot!].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP3',
        requirement:
          'The Agent Execution Context Indicator shows the agent working directory while the IDE workspace stays unchanged.',
        status: 'pass',
        evidence: [contextProof!].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP4',
        requirement:
          'The clicked link opens the agent-home copy of notes/agent-note.md, never the workspace-root decoy.',
        status: 'pass',
        evidence: [openedProof!, editorShot!].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP5',
        requirement:
          'Chat thinking strip reserves 28px bottom padding and chat icons use the loaded kaitian-icon font.',
        status: 'pass',
        evidence: [visualProof!].filter(Boolean) as string[],
      });
    } finally {
      await runtime.dispose();
    }

    // --- Pass 2: session launched in the current IDE Workspace keeps workspace resolution ---
    const passTwo = await loadWorkbench({
      fixture: 'file-link-agent-cwd',
      profile: 'interactive',
      delayMs: 10,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
    try {
      await seedNoteFiles(passTwo.workspaceDir);

      await launchTaskInCurrentProject(page);
      await waitForDraftBoundSession();
      await sendPrompt(FILE_LINK_PROMPT);
      await expect(chatSlot().getByText(READY_SENTINEL)).toBeVisible({ timeout: 30_000 });

      const plainLink = assistantMessage().getByRole('link', { name: 'notes/agent-note.md', exact: true }).first();
      await expect(plainLink).toBeVisible({ timeout: 30_000 });
      const linkProof = await readLinkProof(path.join(passTwo.workspaceDir, 'notes', 'agent-note.md'));
      expect(linkProof.agentCwdLinkCount).toBeGreaterThan(0);
      expect(linkProof.workspaceReplyHrefCount).toBe(0);

      await plainLink.click();
      const editorTarget = page.locator('#workbench-editor [data-uri$="/notes/agent-note.md"]').first();
      await expect(editorTarget).toBeVisible({ timeout: 30_000 });
      await expectEditorTextContains(WORKSPACE_MARKER);
      const openedUris = await readOpenTabUris();
      expect(openedUris.some((uri) => uri.startsWith(`file://${passTwo.workspaceDir}/notes/agent-note.md`))).toBe(true);

      const fallbackProof = await evidence.saveJson(
        '08-workspace-fallback-opened',
        { openedUris },
        'a session whose Workspace Target equals the IDE workspace resolves the same relative link against the workspace root',
      );
      const fallbackShot = await evidence.captureScreenshot(
        page,
        '09-workspace-fallback-opened',
        'Workspace-equal session opens the workspace-root copy of notes/agent-note.md',
      );
      const noIndicator = page.getByTestId('agentic-task-execution-context');
      await expect(noIndicator).toHaveCount(0);

      evidence.recordCriticalPoint({
        id: 'CP6',
        requirement: 'Workspace-equal sessions keep workspace-root link resolution (fallback parity).',
        status: 'pass',
        evidence: [fallbackProof!, fallbackShot!].filter(Boolean) as string[],
      });
    } finally {
      await runtime.dispose();
    }

    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: 'file-link-agent-cwd',
        profile: 'interactive',
      },
    });
  });
});
