// Source: tools/playwright/src/tests/acp-chat-agentic-held-turn-cancelled-on-discard.test.ts
//
// Decision A of .scratch/acp-sticky-send/issues/01-supersede-held-turn-semantics.md.
//
// With sticky send, a Send clicked during the draft-bound session creation window
// is held by the queued-turn runtime and dispatches once the session binds. When
// real agents take seconds (cloud Linux environments) that window is wide, and a
// user who gives up and discards the draft — or supersedes it by launching a new
// task — must not have the held message silently start a brand-new session on
// their behalf (latest-intent semantics, ADR-0004).
//
// Mechanism: discard/supersede bump draftBoundSessionGeneration;
// ensureSessionModel captures the generation when the held turn arrives and
// throws ACP_SESSION_CREATION_CANCELLED if the generation changed while the
// preparation was in flight; the queued-turn runtime drops the turn silently
// (no re-queue, no start-failed pause). The mock agent's
// --new-session-delay-ms keeps the window deterministic.

import { promises as fs } from 'fs';
import path from 'path';

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';

const NEW_SESSION_DELAY_MS = 4000;
const PROMPT = 'BDD held turn must not outlive its draft';

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

/** Fixture + agent-home project + a send landing inside the 4s creation window. */
async function sendInsideCreationWindow(): Promise<void> {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'file-link-agent-cwd',
    profile: 'interactive',
    delayMs: 10,
    newSessionDelayMs: NEW_SESSION_DELAY_MS,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });

  const agentHome = path.join(runtime.workspaceDir, 'agent-home');
  await fs.mkdir(path.join(agentHome, 'notes'), { recursive: true });
  await fs.writeFile(path.join(agentHome, 'notes', 'agent-note.md'), 'BDD_AGENT_HOME_NOTE_MARKER\n', 'utf8');
  const seededProject = await page.evaluate(async (dir) => (window as any).__OPENSUMI_E2E__.addAgenticProject(dir), agentHome);
  expect(seededProject?.workspacePath).toBe(agentHome);

  const agentHomeGroup = page.locator('[data-testid="agentic-session-project-group"]', {
    hasText: 'agent-home',
  });
  await expect(agentHomeGroup).toBeVisible({ timeout: 30_000 });
  await agentHomeGroup.locator('[data-testid="agentic-task-launch-button"]').first().click();
  await expect(page.getByTestId('agentic-task-draft-context')).toBeVisible({ timeout: 30_000 });

  const input = chatInput();
  await expect(input).toBeVisible({ timeout: 30_000 });
  await input.click();
  await page.keyboard.insertText(PROMPT);
  await expect(input).toContainText(PROMPT, { timeout: 10_000 });

  await sendButton().click();
  await expect(page.getByTestId('acp-task-launch-status')).toBeVisible({ timeout: 10_000 });
}

test.describe('ACP Chat Agentic held turn cancelled on draft supersede/discard', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 3);

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('launching a new task during the window cancels the held turn instead of starting it in a session', async () => {
    await sendInsideCreationWindow();

    // Supersede: launch a new task while the previous draft's session is still
    // being created. The old draft (and its held turn) must die with it.
    const agentHomeGroup = page.locator('[data-testid="agentic-session-project-group"]', {
      hasText: 'agent-home',
    });
    await agentHomeGroup.locator('[data-testid="agentic-task-launch-button"]').first().click();
    await expect(page.getByTestId('agentic-task-draft-context')).toBeVisible({ timeout: 30_000 });

    // The new draft binds its own session on schedule.
    let supersedingSessionId: string;
    await expect.poll(async () => (await readSessionState())?.sessionId ?? '', { timeout: 45_000 }).not.toEqual('');

    // Let the ORIGINAL creation window fully elapse. Under the cancelled
    // semantics nothing else may start; under the pre-fix fallback the held turn
    // would start a brand-new session right about here and yank the active
    // session.
    await page.waitForTimeout(NEW_SESSION_DELAY_MS + 2_000);

    supersedingSessionId = (await readSessionState())?.sessionId ?? '';
    expect(supersedingSessionId).not.toEqual('');
    // Still the superseding draft's session (no takeover), nothing dispatched.
    await expect
      .poll(async () => (await readSessionState())?.sessionId ?? '', { timeout: 15_000 })
      .toBe(supersedingSessionId);
    await expect.poll(async () => (await readSessionState())?.requestCount ?? 0, { timeout: 15_000 }).toBe(0);
    await expect(page.getByText(PROMPT)).toHaveCount(0);
  });

  test('discarding the draft via the close confirmation prevents the held turn from starting', async () => {
    await runtime?.dispose();
    await sendInsideCreationWindow();

    // Explicit discard: the draft close affordance pops the discard confirmation
    // because the composer still holds the (reserved) unsent message.
    await expect(page.getByTestId('agentic-task-draft-close')).toBeVisible({ timeout: 10_000 });
    await page.getByTestId('agentic-task-draft-close').click();
    const discardButton = page.getByRole('button', { name: /^Discard Draft$/ });
    await expect(discardButton).toBeVisible({ timeout: 15_000 });
    await discardButton.click();

    // The panel hides; no session may ever be created for the cancelled turn.
    await page.waitForTimeout(NEW_SESSION_DELAY_MS + 2_000);
    const state = await readSessionState();
    expect(state).toBeNull();
  });
});
