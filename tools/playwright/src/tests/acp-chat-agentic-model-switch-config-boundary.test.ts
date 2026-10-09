// Regression: switching a session config option (model) while a turn is
// generating must NOT hit the agent until the turn boundary.
//
// Root cause being locked down: AcpChatInternalService.setSessionConfigOption
// used to fire session/set_config_option immediately, even while the agent was
// still streaming a prompt. Real agents crash on that (the connection dies), and
// the aftermath matched the user report: the queued message stopped draining,
// and "Immediate Send" silently converted it into a failed turn.
//
// The mock agent runs with --crash-on-config-change: it exits the moment a
// set_config_option arrives during an active prompt, so any mid-turn leak turns
// this spec red with stream errors instead of green.

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import { type AcpBddFixtureRuntime, loadAcpBddFixtureWorkbench } from './utils/acp-bdd-fixture';

let runtime: AcpBddFixtureRuntime;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function mainInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function submit(text: string): Promise<void> {
  const input = mainInput();
  await expect(input).toBeVisible();
  await input.click();
  await input.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
  await input.press('Enter');
}

async function switchModel(fromLabel: string, toLabel: string): Promise<void> {
  const trigger = chatSlot().locator('[role="combobox"]', { hasText: fromLabel }).first();
  await expect(trigger).toBeVisible({ timeout: 10_000 });
  await trigger.click();
  const option = page.getByRole('option', { name: toLabel }).first();
  await expect(option).toBeVisible({ timeout: 10_000 });
  // While a turn streams the selector sits under the disabled-tooltip
  // ("Clear or create session to change model"). The pointer stays on the
  // trigger after opening the dropdown and that tooltip can pop above the
  // open option list and swallow the click on slower machines. Park the
  // pointer over the message list so the tooltip closes, then click.
  const list = page.getByTestId('agentic-virtual-message-list');
  const box = (await list.boundingBox().catch(() => null)) ?? { x: 200, y: 200, width: 400, height: 400 };
  await page.mouse.move(box.x + box.width / 2, box.y + 30);
  await page.waitForTimeout(300);
  await option.click();
  await expect(chatSlot().locator('[role="combobox"]', { hasText: toLabel }).first()).toBeVisible({ timeout: 10_000 });
}

async function slotText(): Promise<string> {
  return chatSlot()
    .first()
    .innerText()
    .catch(() => '');
}

async function scrollListToBottom(): Promise<void> {
  await page
    .getByTestId('agentic-virtual-message-list')
    .evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    })
    .catch(() => undefined);
}

async function shot(name: string): Promise<void> {
  await page
    .screenshot({ path: `/tmp/opencode/model-switch-boundary/${name}.png`, fullPage: false })
    .catch(() => undefined);
}

test.describe('ACP agentic: model switch defers to turn boundary', () => {
  test.setTimeout(300_000);
  let connectionErrors: string[] = [];

  test.beforeAll(async () => {
    connectionErrors = [];
    page.setDefaultTimeout(20_000);
    page.on('console', (msg) => {
      if (msg.type() === 'error' && /connection closed/i.test(msg.text())) {
        connectionErrors.push(msg.text());
      }
    });
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'long-stream',
      profile: 'interactive',
      delayMs: 1200,
      longStreamTicks: 25,
      crashOnConfigChange: true,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('mid-turn model switch survives and the queued turn drains with the new model', async () => {
    // 1. Start a long-streaming turn.
    await submit('count-active');
    const stopButton = chatSlot().getByRole('button', { name: 'Stop', exact: true });
    await expect(stopButton).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/BDD_LONG_STREAM_CHUNK_\d+/).first()).toBeVisible({ timeout: 30_000 });
    await shot('01-turn-one-generating');

    // 2. Switch the model mid-turn. The mock crashes if the change reaches it
    //    now — surviving tail growth proves the change stayed local.
    await switchModel('BDD Small', 'BDD Large');
    await expect(stopButton).toBeVisible({ timeout: 5_000 });
    const textBeforeSwitch = await slotText();
    await expect
      .poll(async () => (await slotText()).length, { timeout: 30_000, intervals: [500] })
      .toBeGreaterThan(textBeforeSwitch.length);
    await shot('02-after-mid-turn-switch');

    // 3. Send a second message while generating: it must queue.
    await submit('count-queued');
    const queuedTurn = page.getByTestId('acp-queued-turn');
    await expect(queuedTurn).toHaveCount(1, { timeout: 15_000 });
    await shot('03-second-turn-queued');

    // 4. Turn one finishes naturally at the boundary; the queued turn must
    //    start on its own with the deferred model applied.
    await expect(stopButton).toBeHidden({ timeout: 120_000 });
    await expect(queuedTurn).toHaveCount(0, { timeout: 15_000 });
    await shot('04-second-turn-started');

    // 5. Turn two runs to completion. The virtualized list may stop following
    //    the stream after the queue collapses, so scroll to the bottom before
    //    reading: the completed reply must render its final actions row.
    const messageRows = page.getByTestId('agentic-message-row');
    await expect
      .poll(
        async () => {
          await scrollListToBottom();
          return messageRows
            .last()
            .innerText()
            .catch(() => '');
        },
        { timeout: 120_000, intervals: [1_000] },
      )
      .toContain('Afresh');
    await expect(stopButton).toBeHidden({ timeout: 5_000 });
    await expect(page.getByTestId('acp-queued-turn')).toHaveCount(0, { timeout: 5_000 });
    await shot('05-second-turn-finished');

    expect(
      connectionErrors,
      `the agent connection must stay alive for the whole run, got: ${JSON.stringify(connectionErrors)}`,
    ).toEqual([]);
  });
});
