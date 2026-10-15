import { expect } from '@playwright/test';

import test, { page } from './hooks';
import { ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS, loadAcpBddFixtureWorkbench } from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';

const SESSION_PROMPT = 'A deliberately long prompt that must not become the Agent Session title';
const THEMES = [
  { label: 'OpenSumi Design Dark+ (default dark)', root: 'body', className: 'design-dark' },
  { label: 'OpenSumi Design Light+ (default light)', root: 'body', className: 'design-light' },
] as const;

function chatSlot() {
  return page.locator('.AI-Chat-slot:visible');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function activeSessionState(): Promise<{ sessionId?: string; requestCount?: number }> {
  const state = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  return state?.result?.session || {};
}

async function resizeTaskListTo(targetWidth: number): Promise<void> {
  const taskList = page.getByTestId('agentic-session-list');
  const resizeHandle = page.getByTestId('agentic-task-list-resize-handle');
  const currentWidth = Math.round(await taskList.evaluate((element) => element.getBoundingClientRect().width));
  if (currentWidth !== targetWidth) {
    const handleBounds = await resizeHandle.boundingBox();
    expect(handleBounds).not.toBeNull();
    const startX = handleBounds!.x + handleBounds!.width / 2;
    const startY = handleBounds!.y + handleBounds!.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + targetWidth - currentWidth, startY);
    await page.mouse.up();
  }

  await expect(taskList).toHaveCSS('width', `${targetWidth}px`);
}

async function chooseTheme(theme: (typeof THEMES)[number]): Promise<void> {
  const { label, root, className } = theme;
  const alreadySelected = await page.evaluate(
    ({ root, className }) => document.querySelector(root)?.classList.contains(className),
    { root, className },
  );
  if (alreadySelected) {
    return;
  }
  const command = page.evaluate(() =>
    (window as any).__OPENSUMI_E2E__?.executeCommand?.('workbench.action.selectTheme'),
  );
  const option = page.locator('#opensumi-quickpick-item:visible').filter({ hasText: label });
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
  await command;
  await expect(option).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(({ root, className }) => document.querySelector(root)?.classList.contains(className), {
        root,
        className,
      }),
    )
    .toBe(true);
}

test.describe('ACP Chat Agent Session Row presentation', () => {
  test.setTimeout(Math.max(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS, 180_000));

  test('keeps Agent-owned Session metadata compact across list widths and themes', async () => {
    const runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'history',
      profile: 'interactive',
      delayMs: 10,
      sessionPrefix: 'bdd-task-row-presentation',
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1600, height: 900 },
    });

    try {
      await launchTaskInCurrentProject(page);
      await chatInput().click();
      await page.keyboard.insertText(SESSION_PROMPT);
      await expect(chatInput()).toContainText(SESSION_PROMPT);
      const send = chatSlot()
        .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
        .last();
      await send.click();

      await expect
        .poll(
          async () => {
            const requestCount = (await activeSessionState()).requestCount ?? 0;
            if (requestCount === 0 && (await chatInput().textContent())?.includes(SESSION_PROMPT)) {
              await send.click();
            }
            return requestCount;
          },
          { timeout: 60_000 },
        )
        .toBeGreaterThanOrEqual(1);
      const sessionId = (await activeSessionState()).sessionId!;
      expect(sessionId).toBeTruthy();
      const row = page.getByTestId(`agentic-session-row-${sessionId}`);
      await expect(row).toBeVisible({ timeout: 30_000 });
      const title = row.locator('span').first();

      await expect(row).toHaveAttribute('aria-current', 'true');
      await expect(title).toBeVisible({ timeout: 30_000 });
      const sessionTitle = (await title.textContent())?.trim();
      expect(sessionTitle).toBeTruthy();
      expect(sessionTitle).not.toBe(SESSION_PROMPT);
      await expect(row).toHaveAttribute('aria-label', sessionTitle!);
      await expect(row).toHaveAttribute('title', /claude-agent-acp/);
      await expect(row).toHaveCSS('height', '22px');
      await expect(row).toHaveCSS('overflow', 'hidden');
      await expect(title).toHaveCSS('white-space', 'nowrap');
      await expect(title).toHaveCSS('text-overflow', 'ellipsis');
      await expect(page.locator('[data-testid^="agentic-task-archive-"]')).toHaveCount(0);
      await expect(page.locator('[data-testid^="agentic-task-unread-"]')).toHaveCount(0);

      for (const width of [208, 244, 280]) {
        await resizeTaskListTo(width);
        await expect(page.getByTestId('agentic-session-list')).toHaveCSS('width', `${width}px`);
        await expect(row).toHaveCSS('height', '22px');
        await expect(title).toHaveCSS('white-space', 'nowrap');
        const bounds = await row.evaluate((element) => {
          const rowRect = element.getBoundingClientRect();
          return Array.from(element.children).map((child) => {
            const rect = child.getBoundingClientRect();
            return { left: rect.left, right: rect.right, rowLeft: rowRect.left, rowRight: rowRect.right };
          });
        });
        expect(bounds.every(({ left, right, rowLeft, rowRight }) => left >= rowLeft && right <= rowRight)).toBe(true);
      }

      const themeSurfaces: string[] = [];
      for (const theme of THEMES) {
        await chooseTheme(theme);
        await row.focus();
        await expect(row).toHaveCSS('height', '22px');
        const themeStyles = await page.evaluate(() => {
          const body = window.getComputedStyle(document.body);
          const selected = document.querySelector<HTMLElement>(
            '[data-testid^="agentic-session-row-"][aria-current="true"]',
          );
          const styles = (element: HTMLElement | null) => {
            const style = element && window.getComputedStyle(element);
            return (
              style && { color: style.color, backgroundColor: style.backgroundColor, outlineColor: style.outlineColor }
            );
          };
          return {
            body: { color: body.color, backgroundColor: body.backgroundColor },
            selected: styles(selected),
          };
        });
        themeSurfaces.push(`${themeStyles.body.color}/${themeStyles.body.backgroundColor}`);
        expect(themeStyles.selected?.color).not.toBe(themeStyles.selected?.backgroundColor);
      }
      expect(new Set(themeSurfaces).size).toBe(2);

      const search = page.getByPlaceholder('Search sessions');
      await search.fill(sessionTitle!);
      await expect(row).toBeVisible();
      await search.fill(SESSION_PROMPT);
      await expect(row).toHaveCount(0);
    } finally {
      await runtime.dispose();
    }
  });
});
