import { expect } from '@playwright/test';

import test, { page } from './hooks';
import { ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS, loadAcpBddFixtureWorkbench } from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';

const TASK_TITLE = 'A deliberately long Agent Task title for compact row presentation';
const THEMES = [
  { label: 'OpenSumi Design Dark+ (default dark)', root: 'body', className: 'design-dark' },
  { label: 'OpenSumi Design Light+ (default light)', root: 'body', className: 'design-light' },
  { label: 'Dark High Contrast', root: 'html', className: 'hc-black' },
  { label: 'Light High Contrast', root: 'html', className: 'hc-light' },
] as const;

function chatSlot() {
  return page.locator('.AI-Chat-slot:visible');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
}

async function activeSessionId(): Promise<string | undefined> {
  const state = await page.evaluate(async () =>
    (navigator as any).modelContext.executeTool('acp_chat_get_session_state', {}),
  );
  return state?.result?.session?.sessionId;
}

async function inputDraftMessage(): Promise<string | undefined> {
  return page.evaluate(() => (window as any).__OPENSUMI_E2E__?.getAcpInputDraft?.()?.message);
}

async function resizeTaskListTo(targetWidth: number): Promise<void> {
  const taskList = page.getByTestId('agentic-task-list');
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
  const command = page.evaluate(() =>
    (window as any).__OPENSUMI_E2E__?.executeCommand?.('workbench.action.selectTheme'),
  );
  const { label, root, className } = theme;
  const option = page.getByText(label, { exact: true }).last();
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

test.describe('ACP Chat Agentic Task Row presentation', () => {
  test.setTimeout(Math.max(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS, 180_000));

  test('keeps compact metadata, Tooltip disclosure, and row actions stable across Task List widths', async () => {
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
      await page.keyboard.insertText(TASK_TITLE);
      await expect(chatInput()).toContainText(TASK_TITLE);
      await expect.poll(inputDraftMessage).toBe(TASK_TITLE);
      await chatSlot()
        .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
        .last()
        .click();

      await expect.poll(activeSessionId, { timeout: 30_000 }).toBeTruthy();
      const sessionId = (await activeSessionId())!;
      const row = page.getByTestId(`agentic-task-row-${sessionId}`);
      await expect(row).toBeVisible({ timeout: 30_000 });
      const title = row.getByText(TASK_TITLE, { exact: true });
      const archive = page.getByTestId(`agentic-task-archive-${sessionId}`);
      const tooltipContent = page.getByTestId(`agentic-task-tooltip-content-${sessionId}`);

      await expect(row).toHaveAttribute('aria-current', 'true');
      await expect(title).toBeVisible({ timeout: 30_000 });
      await expect(row).toHaveCSS('height', '22px');
      await expect(row).toHaveCSS('overflow', 'hidden');
      await expect(title).toHaveCSS('white-space', 'nowrap');
      await expect(title).toHaveCSS('text-overflow', 'ellipsis');
      await expect(page.getByTestId(`agentic-task-agent-${sessionId}`)).toHaveCount(0);
      await expect(archive).toBeAttached({ timeout: 30_000 });

      for (const width of [208, 244, 280]) {
        await resizeTaskListTo(width);
        await expect(page.getByTestId('agentic-task-list')).toHaveCSS('width', `${width}px`);
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

      await row.hover();
      await expect(tooltipContent).toBeVisible();
      await expect(tooltipContent).toContainText(TASK_TITLE);
      await expect(tooltipContent).toContainText('Agent');
      await expect(tooltipContent).toHaveCSS('font-size', '12px');
      await expect(tooltipContent.getByRole('button')).toHaveCount(0);
      const tooltipBounds = await tooltipContent.evaluate((element) => {
        const rect = element.closest('[role="tooltip"]')!.getBoundingClientRect();
        return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
      });
      expect(tooltipBounds.top).toBeGreaterThanOrEqual(0);
      expect(tooltipBounds.left).toBeGreaterThanOrEqual(0);
      expect(tooltipBounds.right).toBeLessThanOrEqual(1600);
      expect(tooltipBounds.bottom).toBeLessThanOrEqual(900);

      const themeSurfaces: string[] = [];
      for (const theme of THEMES) {
        await chooseTheme(theme);
        await row.focus();
        await expect(tooltipContent).toBeVisible();
        await expect(row).toHaveCSS('height', '22px');
        const themeStyles = await page.evaluate(() => {
          const body = window.getComputedStyle(document.body);
          const selected = document.querySelector<HTMLElement>(
            '[data-testid^="agentic-task-row-"][aria-current="true"]',
          );
          const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]');
          const styles = (element: HTMLElement | null) => {
            const style = element && window.getComputedStyle(element);
            return (
              style && { color: style.color, backgroundColor: style.backgroundColor, outlineColor: style.outlineColor }
            );
          };
          return {
            body: { color: body.color, backgroundColor: body.backgroundColor },
            selected: styles(selected),
            tooltip: styles(tooltip),
          };
        });
        themeSurfaces.push(`${themeStyles.body.color}/${themeStyles.body.backgroundColor}`);
        expect(themeStyles.selected?.color).not.toBe(themeStyles.selected?.backgroundColor);
        expect(themeStyles.tooltip?.color).not.toBe(themeStyles.tooltip?.backgroundColor);
      }
      expect(new Set(themeSurfaces).size).toBeGreaterThanOrEqual(3);

      await page.getByPlaceholder('Search tasks').focus();
      await page.mouse.move(1200, 100);
      await expect(tooltipContent).toBeHidden();
      await row.focus();
      await expect(tooltipContent).toBeVisible();
      await row.press('Escape');
      await expect(tooltipContent).toBeHidden();

      const titleBeforeAction = await title.boundingBox();
      await row.hover();
      await expect(archive).toHaveCSS('pointer-events', 'auto');
      await archive.focus();
      await expect(tooltipContent).toBeHidden();
      expect(await title.boundingBox()).toEqual(titleBeforeAction);
    } finally {
      await runtime.dispose();
    }
  });
});
