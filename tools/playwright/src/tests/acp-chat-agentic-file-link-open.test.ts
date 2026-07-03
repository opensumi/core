// Source: test/bdd/acp-chat-agentic-file-link-open.scenario.md

import { expect } from '@playwright/test';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
  waitForExplorerViewVisible,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

const FILE_LINK_PROMPT = 'BDD file link open';
const READY_SENTINEL = 'BDD_FILE_LINK_READY';
const PLAIN_FILE_LINK_TEXT = 'test/test.js:L1-L2';
const INLINE_FILE_LINK_TEXT = 'test/test.js:1:1';
const EXTERNAL_LINK_TEXT = 'test/test.js';
const EXTERNAL_LINK_HREF = 'https://example.com/opensumi-file-link-label';
const AGENTIC_MAXIMIZE_BUTTON_SELECTOR =
  '#agentic-chat-panel-header-maximize [role="button"], #ai-chat-header-maximize [role="button"]';

let runtime: AcpBddFixtureRuntime;

interface VisibilityProof {
  aiChatVisible: boolean;
  workbenchVisible: boolean;
  editorVisible: boolean;
  explorerVisible: boolean;
  fatalTextVisible: boolean;
  currentTabUris: string[];
}

interface LinkBoundaryProof {
  anchors: Array<{
    text: string;
    href: string;
  }>;
  plainFileLinkCount: number;
  inlineFileLinkCount: number;
  externalLinkCount: number;
  fencedFileLinkCount: number;
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

function chatButton(name: string) {
  return chatSlot().getByRole('button', { name });
}

async function loadFileLinkWorkbench() {
  runtime = await loadAcpBddFixtureWorkbench(page, {
    fixture: 'file-link',
    profile: 'interactive',
    delayMs: 10,
    showChatView: true,
    ensureAgenticLayout: true,
    viewport: { width: 1600, height: 900 },
  });
  await expect(page.getByRole('heading', { name: 'AI Assistant' })).toBeVisible();
  await waitForExplorerViewVisible(page);
}

async function sendPrompt(prompt: string) {
  const input = chatInput();
  await expect(input).toBeVisible();
  await input.click();
  await page.keyboard.type(prompt);
  await chatButton('Send').click();
}

async function readVisibilityProof(): Promise<VisibilityProof> {
  return page.evaluate(() => {
    const isVisible = (element: Element | null | undefined) => {
      if (!element) {
        return false;
      }
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    };
    const firstVisible = (selectors: string[]) =>
      selectors
        .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
        .find((element) => isVisible(element));
    const visibleText = document.body.innerText || '';

    return {
      aiChatVisible: isVisible(document.querySelector('.AI-Chat-slot')),
      workbenchVisible: isVisible(document.querySelector('#workbench-editor')),
      editorVisible: Boolean(firstVisible(['#workbench-editor .monaco-editor', '#workbench-editor [data-uri]'])),
      explorerVisible: Boolean(
        firstVisible(['[data-viewlet-id="explorer"]', '#opensumi-left-tabbar li#explorer.active']),
      ),
      fatalTextVisible: /SERVICE_UNAVAILABLE|EXECUTION_ERROR|Initializing ACP service|uncaught|stack trace/i.test(
        visibleText,
      ),
      currentTabUris: Array.from(document.querySelectorAll('#workbench-editor [data-uri]'))
        .map((element) => element.getAttribute('data-uri') || '')
        .filter(Boolean),
    };
  });
}

async function readLinkBoundaryProof(): Promise<LinkBoundaryProof> {
  return assistantMessage().evaluate(
    (message, expected) => {
      const anchors = Array.from(message.querySelectorAll('a')).map((anchor) => ({
        text: anchor.textContent?.trim() || '',
        href: anchor.getAttribute('href') || '',
      }));
      const isFileHref = (href: string) => href.startsWith('file:');

      return {
        anchors,
        plainFileLinkCount: anchors.filter(
          (anchor) => anchor.text === expected.plainFileLinkText && isFileHref(anchor.href),
        ).length,
        inlineFileLinkCount: anchors.filter(
          (anchor) => anchor.text === expected.inlineFileLinkText && isFileHref(anchor.href),
        ).length,
        externalLinkCount: anchors.filter(
          (anchor) => anchor.text === expected.externalLinkText && anchor.href === expected.externalLinkHref,
        ).length,
        fencedFileLinkCount: anchors.filter(
          (anchor) => anchor.text === expected.externalLinkText && isFileHref(anchor.href),
        ).length,
      };
    },
    {
      plainFileLinkText: PLAIN_FILE_LINK_TEXT,
      inlineFileLinkText: INLINE_FILE_LINK_TEXT,
      externalLinkText: EXTERNAL_LINK_TEXT,
      externalLinkHref: EXTERNAL_LINK_HREF,
    },
  );
}

async function collapseAgenticWorkbench() {
  const maximizeButton = page.locator(AGENTIC_MAXIMIZE_BUTTON_SELECTOR).first();
  await expect(maximizeButton).toBeVisible({ timeout: 30_000 });
  await maximizeButton.click();
  await expect
    .poll(
      async () => {
        const proof = await readVisibilityProof();
        return proof.workbenchVisible;
      },
      { timeout: 30_000 },
    )
    .toBe(false);
}

test.describe('ACP Chat Agentic File Link Open', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);
    await loadFileLinkWorkbench();
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('File Link Open restores the workbench and Explorer from maximized Agentic chat', async ({
    browser: _browser,
  }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'acp-chat-agentic-file-link-open', {
      sourceScenario: 'test/bdd/acp-chat-agentic-file-link-open.scenario.md',
      profile: 'interactive',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });

    await sendPrompt(FILE_LINK_PROMPT);
    await expect(chatSlot().getByText(READY_SENTINEL)).toBeVisible({ timeout: 30_000 });

    const plainFileLink = assistantMessage().getByRole('link', { name: PLAIN_FILE_LINK_TEXT });
    await expect(plainFileLink).toBeVisible({ timeout: 30_000 });

    const linkBoundary = await readLinkBoundaryProof();
    expect(linkBoundary.plainFileLinkCount).toBe(1);
    expect(linkBoundary.inlineFileLinkCount).toBe(1);
    expect(linkBoundary.externalLinkCount).toBe(1);
    expect(linkBoundary.fencedFileLinkCount).toBe(0);
    const linkBoundaryProof = await evidence.saveJson(
      '01-link-boundaries',
      linkBoundary,
      'assistant markdown renders file links, external link labels, and fenced code with correct link boundaries',
    );

    const beforeMaximize = await readVisibilityProof();
    expect(beforeMaximize.workbenchVisible).toBe(true);
    expect(beforeMaximize.explorerVisible).toBe(true);

    await collapseAgenticWorkbench();

    const maximized = await readVisibilityProof();
    expect(maximized.aiChatVisible).toBe(true);
    expect(maximized.workbenchVisible).toBe(false);
    expect(maximized.explorerVisible).toBe(false);
    const maximizedProof = await evidence.saveJson(
      '02-maximized-before-file-link',
      maximized,
      'Agentic chat is maximized and the workbench plus Explorer are hidden before clicking the file link',
    );

    await plainFileLink.click();
    await waitForExplorerViewVisible(page);
    await expect(page.locator('#workbench-editor')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#workbench-editor [data-uri$="/test/test.js"]').first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('#workbench-editor .monaco-editor').first()).toBeVisible({ timeout: 30_000 });

    const afterClick = await readVisibilityProof();
    expect(afterClick.workbenchVisible).toBe(true);
    expect(afterClick.editorVisible).toBe(true);
    expect(afterClick.explorerVisible).toBe(true);
    expect(afterClick.currentTabUris.some((uri) => uri.endsWith('/test/test.js'))).toBe(true);
    expect(afterClick.fatalTextVisible).toBe(false);
    const afterClickProof = await evidence.saveJson(
      '03-after-file-link-click',
      afterClick,
      'clicking the assistant file link restores the workbench, Explorer, and opens test/test.js',
    );

    evidence.recordCriticalPoint({
      id: 'CP1',
      requirement: 'Assistant markdown creates file links for plain and inline-code paths only.',
      status: 'pass',
      evidence: [linkBoundaryProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP2',
      requirement: 'External markdown link labels that look like file paths remain normal external links.',
      status: 'pass',
      evidence: [linkBoundaryProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP3',
      requirement: 'The file-link click path restores workbench/editor and Explorer from maximized Agentic chat.',
      status: 'pass',
      evidence: [maximizedProof, afterClickProof].filter(Boolean) as string[],
    });
    evidence.recordCriticalPoint({
      id: 'CP4',
      requirement: 'The clicked file link opens the workspace file test/test.js.',
      status: 'pass',
      evidence: [afterClickProof].filter(Boolean) as string[],
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
