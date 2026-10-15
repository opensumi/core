// Source: tools/playwright/src/tests/acp-chat-agentic-per-session-input-draft.test.ts
//
// Regression spec for per-session input drafts (Agentic Layout).
//
// Decision: .scratch/acp-sticky-send/issues/03-per-session-input-draft.md — the
// input draft used to be a single service-wide field, so unsent text followed the
// composer across session switches (session1's draft stayed visible in session2).
// Drafts are now stored per session (keyed by the bound session id, with a
// dedicated slot for the task-draft phase): typing syncs into the active slot,
// the draft phase migrates its content to the session it binds to, and switching
// sessions restores the incoming session's slot.
//
// Session-creation latency does not matter here — every wait is on the bound
// session state, not on timing.

import { promises as fs } from 'fs';
import path from 'path';

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';

const PROMPT_A = 'BDD per-session draft AAA';
const PROMPT_B = 'BDD per-session draft BBB';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

function sendButton() {
  return chatSlot()
    .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
    .last();
}

function sessionRow(sessionId: string) {
  return page.locator(`[data-testid="agentic-session-row-${sessionId}"]`);
}

interface ChatSessionState {
  sessionId: string;
  requestCount: number;
  threadStatus?: string;
}

async function readSessionState(): Promise<ChatSessionState | null> {
  return page.evaluate(async () => {
    try {
      const response = await (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {});
      return (response?.result?.session ?? null) as ChatSessionState | null;
    } catch {
      return null;
    }
  });
}

/** Launch a task draft from the seeded project group and resolve with its bound session id. */
async function launchAndAwaitBoundSession(): Promise<string> {
  const group = page.locator('[data-testid="agentic-session-project-group"]', { hasText: 'agent-home' });
  await expect(group).toBeVisible({ timeout: 30_000 });
  await group.locator('[data-testid="agentic-task-launch-button"]').first().click();
  await expect(page.getByTestId('agentic-task-draft-context')).toBeVisible({ timeout: 30_000 });

  let sessionId = '';
  await expect
    .poll(
      async () => {
        sessionId = (await readSessionState())?.sessionId ?? '';
        return sessionId;
      },
      { timeout: 45_000 },
    )
    .not.toEqual('');
  return sessionId;
}

/** Activate a session row and resolve once it reports itself as the active session. */
async function activateSession(sessionId: string): Promise<void> {
  await expect(sessionRow(sessionId)).toBeVisible({ timeout: 30_000 });
  await sessionRow(sessionId).click();
  await expect.poll(async () => (await readSessionState())?.sessionId ?? '', { timeout: 45_000 }).toBe(sessionId);
}

test.describe('ACP Chat Agentic per-session input drafts', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 3);

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('switching sessions keeps each session its own unsent input draft', async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'file-link-agent-cwd',
      profile: 'interactive',
      delayMs: 10,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });

    const agentHome = path.join(runtime.workspaceDir, 'agent-home');
    await fs.mkdir(path.join(agentHome, 'notes'), { recursive: true });
    await fs.writeFile(path.join(agentHome, 'notes', 'agent-note.md'), 'BDD_AGENT_HOME_NOTE_MARKER\n', 'utf8');
    await page.evaluate(async (dir) => (window as any).__OPENSUMI_E2E__.addAgenticProject(dir), agentHome);

    // Session A: send one turn so it has history and stays listed.
    const sessionA = await launchAndAwaitBoundSession();
    const input = chatInput();
    await expect(input).toBeVisible({ timeout: 30_000 });
    await input.click();
    await page.keyboard.insertText(PROMPT_A);
    await expect(input).toContainText(PROMPT_A, { timeout: 10_000 });
    await sendButton().click();
    await expect
      .poll(async () => (await readSessionState())?.requestCount ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect(input).not.toContainText(PROMPT_A, { timeout: 15_000 });

    // Launching session B switches the composer to B: clean slot, no A leftovers.
    const sessionB = await launchAndAwaitBoundSession();
    expect(sessionB).not.toBe(sessionA);
    await expect(input).not.toContainText(PROMPT_A, { timeout: 10_000 });

    // Accept B with one dispatched turn: a draft-bound session without any turn is
    // still an "unaccepted Agentic draft", and switching away from it pops the
    // discard-draft confirmation instead of switching silently.
    await input.click();
    await page.keyboard.insertText('BDD per-session warmup');
    await expect(input).toContainText('BDD per-session warmup', { timeout: 10_000 });
    await sendButton().click();
    await expect
      .poll(async () => (await readSessionState())?.requestCount ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await expect(input).not.toContainText('BDD per-session warmup', { timeout: 15_000 });

    // Unsent text typed in B belongs to B.
    await input.click();
    await page.keyboard.insertText(PROMPT_B);
    await expect(input).toContainText(PROMPT_B, { timeout: 10_000 });

    // Back to A: B's unsent text must not leak in (A's slot is empty — all sent).
    await activateSession(sessionA);
    await expect(input).not.toContainText(PROMPT_B, { timeout: 10_000 });

    // And B remembers its unsent text.
    await activateSession(sessionB);
    await expect(input).toContainText(PROMPT_B, { timeout: 10_000 });

    // Isolation holds both ways.
    await activateSession(sessionA);
    await expect(input).not.toContainText(PROMPT_B, { timeout: 10_000 });
  });
});
