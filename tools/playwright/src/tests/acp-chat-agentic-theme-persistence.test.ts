// Source: test/bdd/acp-chat-agentic-theme-persistence.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  ensureAgenticLayout,
  loadAcpBddFixtureWorkbench,
  waitForAcpChatReady,
  waitForWorkbenchReady,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const LIGHT_THEME = 'OpenSumi Design Light+ (default light)';

let runtime: AcpBddFixtureRuntime;

async function chooseTheme(label: string) {
  const isMac = await page.evaluate(() => /Mac/.test(navigator.platform));
  await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+Shift+P`);
  const input = page.locator('#opensumi-quickpick-input');
  await expect(input).toBeVisible();
  await input.fill('Color Theme');
  const command = page.locator('#opensumi-quickpick-item[aria-label="Color Theme"]');
  await expect(command).toBeVisible({ timeout: 15_000 });
  await command.locator("[class*='item_label_container']").first().click();
  const option = page.getByText(label, { exact: true }).last();
  await expect(option).toBeVisible({ timeout: 15_000 });
  await option.click();
}

async function switchLayoutByMenu(target: 'Agent' | 'Classic') {
  await page.locator('#opensumi-menubar').getByText('View', { exact: true }).click();
  const panelLayout = page.getByText('Panel Layout', { exact: true }).last();
  await expect(panelLayout).toBeVisible();
  await panelLayout.hover();
  const targetLabel = page.getByText(target, { exact: true }).last();
  const targetItem = targetLabel.locator('xpath=ancestor::li[contains(@class,"kt-inner-menu-item")][1]');
  await expect(targetItem).toBeVisible();
  await targetItem.click();
}

async function visualState() {
  return page.evaluate(() => {
    const visible = (element: Element | null) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
    };
    const chat = document.querySelector('.AI-Chat-slot');
    const workbench = document.querySelector('#workbench-editor');
    const input = document.querySelector('.AI-Chat-slot [role="textbox"]');
    const header = document.querySelector('.AI-Chat-slot [data-testid="agentic-chat-panel-header"]');
    const chatRect = chat?.getBoundingClientRect();
    const workbenchRect = workbench?.getBoundingClientRect();
    const bodyStyle = window.getComputedStyle(document.body);
    const inputStyle = input ? window.getComputedStyle(input) : undefined;
    return {
      bodyClass: document.body.className,
      bodyColor: bodyStyle.color,
      bodyBackground: bodyStyle.backgroundColor,
      chat: chatRect && { x: chatRect.x, width: chatRect.width, height: chatRect.height },
      workbench: workbenchRect && { x: workbenchRect.x, width: workbenchRect.width, height: workbenchRect.height },
      chatVisible: visible(chat),
      headerVisible: visible(header),
      inputVisible: visible(input),
      inputColor: inputStyle?.color,
      inputBackground: inputStyle?.backgroundColor,
      hasFatalText: /failed to start|fatal error|initializing acp service/i.test(document.body.innerText || ''),
      url: window.location.href,
    };
  });
}

async function dragAgenticChatToWidth(targetWidth: number) {
  const handle = await page.evaluate(() => {
    const chat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
    if (!chat) {
      return undefined;
    }
    return Array.from(document.querySelectorAll('.design-slot_resize_horizontal'))
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0)
      .map((rect) => ({
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        distance: Math.abs(rect.x + rect.width / 2 - chat.right),
      }))
      .sort((a, b) => a.distance - b.distance)[0];
  });
  if (!handle) {
    throw new Error('未找到 Agentic AI Chat splitter');
  }
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetWidth, handle.y + handle.height / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(100);
}

async function showChatAfterReload() {
  await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
  await page.evaluate(async () => (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {}));
  await waitForAcpChatReady(page);
  await ensureAgenticLayout(page);
}

test.describe('ACP Chat Agentic 主题与布局持久化', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'default',
      panelLayout: 'agentic',
      writePanelLayoutPreference: false,
      showChatView: true,
      ensureAgenticLayout: true,
      viewport: { width: 1800, height: 1000 },
    });
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('切换浅色主题并调整宽度后，重载和布局往返仍保持可读与可用', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-theme-persistence', {
      sourceScenario: 'test/bdd/acp-chat-agentic-theme-persistence.scenario.md',
      profile: 'default',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const initial = await visualState();

    await chooseTheme(LIGHT_THEME);
    await expect.poll(() => page.evaluate(() => document.body.classList.contains('design-light'))).toBe(true);
    const light = await visualState();
    expect(light.chatVisible).toBe(true);
    expect(light.headerVisible).toBe(true);
    expect(light.inputVisible).toBe(true);
    expect(light.hasFatalText).toBe(false);
    expect(light.inputColor).not.toBe(light.inputBackground);

    await dragAgenticChatToWidth(900);
    const resized = await visualState();
    expect(resized.chat?.width).toBeGreaterThanOrEqual(640);
    expect(resized.chat?.width).toBeLessThanOrEqual(1440);
    expect(resized.workbench?.width).toBeGreaterThanOrEqual(480);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitForWorkbenchReady(page);
    await showChatAfterReload();
    const reloaded = await visualState();
    expect(reloaded.bodyClass).toContain('design-light');
    expect(reloaded.chatVisible).toBe(true);
    expect(reloaded.headerVisible).toBe(true);
    expect(reloaded.inputVisible).toBe(true);
    expect(reloaded.chat?.width).toBeGreaterThanOrEqual(640);
    expect(reloaded.chat?.width).toBeLessThanOrEqual(1440);
    expect(reloaded.hasFatalText).toBe(false);

    await switchLayoutByMenu('Classic');
    await page.waitForSelector('#main-horizontal-ai');
    await switchLayoutByMenu('Agent');
    await page.waitForSelector('#main-horizontal-ai-agentic');
    await ensureAgenticLayout(page);
    const roundTrip = await visualState();
    expect(roundTrip.bodyClass).toContain('design-light');
    expect(roundTrip.chat?.x).toBeLessThan(roundTrip.workbench?.x ?? Number.POSITIVE_INFINITY);
    expect(roundTrip.chatVisible).toBe(true);
    expect(roundTrip.headerVisible).toBe(true);
    expect(roundTrip.inputVisible).toBe(true);
    expect(roundTrip.hasFatalText).toBe(false);

    const proof = await evidence.saveJson(
      '01-theme-layout-persistence',
      { initial, light, resized, reloaded, roundTrip },
      '浅色主题、Agentic 几何、重载持久化与 Classic 往返后的可读性',
    );
    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: '主题变化后 Agentic 标题、输入与聊天区域仍可见且前景/背景可区分。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: '重载保留主题与 Agentic 布局，几何仍在边界内；Classic 往返恢复左侧 Chat。',
      status: 'pass',
      evidence: [proof].filter(Boolean) as string[],
    });
    await evidence.finalize({
      scenarioVerdict: 'PASS',
      hardeningVerdict: 'CONVERT',
      runtime: {
        url: page.url(),
        viewport: page.viewportSize(),
        browserSurface: 'Playwright Chromium',
        fixture: runtime.fixture,
        profile: runtime.profile,
      },
    });
  });
});
