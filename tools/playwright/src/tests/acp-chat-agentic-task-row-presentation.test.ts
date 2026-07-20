import { expect } from '@playwright/test';

import test, { page } from './hooks';
import { ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS, loadAcpBddFixtureWorkbench } from './utils/acp-bdd-fixture';
import { launchTaskInCurrentProject } from './utils/acp-task-list';

const TASK_TITLE = 'A deliberately long Agent Task title for compact row presentation';
const THEME_LABELS = [
  'OpenSumi Design Dark+ (default dark)',
  'OpenSumi Design Light+ (default light)',
  'Dark High Contrast',
  'Light High Contrast',
] as const;

function chatSlot() {
  return page.locator('.AI-Chat-slot');
}

function chatInput() {
  return chatSlot().locator('[contenteditable="true"]').last();
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

async function chooseTheme(label: string): Promise<void> {
  const isMac = await page.evaluate(() => /Mac/.test(navigator.platform));
  await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+Shift+P`);
  const input = page.locator('#opensumi-quickpick-input');
  await expect(input).toBeVisible();
  await input.fill('Color Theme');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const command = document.querySelector<HTMLElement>('#opensumi-quickpick-item[aria-label="Color Theme"]');
        return !!command && command.getBoundingClientRect().height > 0;
      }),
    )
    .toBe(true);
  await page.evaluate(() => {
    document
      .querySelector<HTMLElement>('#opensumi-quickpick-item[aria-label="Color Theme"] [class*="item_label_container"]')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.querySelectorAll<HTMLElement>('#opensumi-quickpick-item')).some(
          (element) =>
            /High Contrast|default light|default dark/.test(element.textContent || '') &&
            element.getBoundingClientRect().height > 0,
        ),
      ),
    )
    .toBe(true);
  await input.fill(label);
  await expect
    .poll(() =>
      page.evaluate((themeLabel) => {
        const option = Array.from(document.querySelectorAll<HTMLElement>('#opensumi-quickpick-item')).find(
          (element) => element.textContent?.includes(themeLabel) && element.getBoundingClientRect().height > 0,
        );
        return !!option;
      }, label),
    )
    .toBe(true);
  await page.evaluate((themeLabel) => {
    Array.from(document.querySelectorAll<HTMLElement>('#opensumi-quickpick-item'))
      .find((element) => element.textContent?.includes(themeLabel) && element.getBoundingClientRect().height > 0)
      ?.querySelector<HTMLElement>('[class*="item_label_container"]')
      ?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
  }, label);
  await expect(input).toBeHidden();
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
      await chatSlot()
        .getByRole('button', { name: /^(Enter\s+)?Send$|^Enter\s+发送$|^发送$/i })
        .last()
        .click();

      const row = page.locator('[data-testid^="agentic-task-row-"]').filter({ hasText: TASK_TITLE }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
      const rowTestId = await row.getAttribute('data-testid');
      expect(rowTestId).toBeTruthy();
      const sessionId = rowTestId!.replace('agentic-task-row-', '');
      const title = row.getByText(TASK_TITLE, { exact: true });
      const archive = page.getByTestId(`agentic-task-archive-${sessionId}`);
      const tooltipContent = page.getByTestId(`agentic-task-tooltip-content-${sessionId}`);

      await expect(row).toHaveAttribute('aria-current', 'true');
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
      await expect(tooltipContent).toContainText('Agent:');
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
      for (const themeLabel of THEME_LABELS) {
        await chooseTheme(themeLabel);
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
