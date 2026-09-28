// Source: tools/playwright/src/tests/acp-chat-agentic-send-during-session-creation.test.ts
//
// Regression spec for the draft-bound session swap window (Agentic Layout).
//
// Root cause (2026-09-24, see scenario Timing Notes in the header of
// test/bdd/acp-chat-agentic-agent-cwd-file-link.scenario.md): while the
// draft-bound session is being created, startSessionModel holds
// sessionLoading=true for the whole session-creation RPC and the view mapped
// that onto submitDisabled, which removed the send button's onClick entirely
// (and early-returned the Enter path). A send click inside that window was
// silently lost: no turn was dispatched and the typed prompt stayed in the
// input. The fix keeps the send affordance active during the creation window
// and lets the existing queued-turn machinery hold the draft: the turn is
// reserved (initialStartPending -> "Starting task…"), awaits the in-flight
// session creation via ensureSessionModel, and dispatches into the bound
// session without a second click.
//
// The mock agent's --new-session-delay-ms widens the creation window
// deterministically so the click reliably lands inside it.
//
// Timing note: if a very slow environment pushed the click past the window,
// the turn would dispatch directly (no initialStartPending hold) and the
// acp-task-launch-status assertion below would fail spuriously — the 4s
// window is sized to keep that practically unreachable.

import { promises as fs } from 'fs';
import path from 'path';

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
} from './utils/acp-bdd-fixture';

const PROMPT = 'BDD send during session creation';
const NEW_SESSION_DELAY_MS = 4000;

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

test.describe('ACP Chat Agentic send during session creation', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS * 3);

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('a send click inside the creation window dispatches once the draft-bound session binds', async () => {
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

    // The mock agent delays session/new by NEW_SESSION_DELAY_MS, so the
    // creation window is open for several seconds after the launch. The click
    // right after typing therefore lands inside the window — without the fix
    // it was silently swallowed (no turn, no feedback).
    await sendButton().click();

    // The held turn shows the existing "Starting task…" feedback while the
    // draft-bound session is still being created.
    await expect(page.getByTestId('acp-task-launch-status')).toBeVisible({ timeout: 10_000 });

    // The turn must dispatch into the bound session WITHOUT a second click.
    await expect
      .poll(async () => (await readSessionState())?.requestCount ?? 0, { timeout: 30_000 })
      .toBeGreaterThan(0);

    // The input draft is cleared by the accepted submission (no duplicate re-send).
    await expect(input).not.toContainText(PROMPT, { timeout: 15_000 });
  });
});
