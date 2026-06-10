import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { type Page } from '@playwright/test';

import { OpenSumiApp } from '../../app';
import { OpenSumiWorkspace } from '../../workspace';

export const ACP_BDD_FIXTURES = [
  'stream-rich',
  'long-stream',
  'permission',
  'send-failure',
  'create-failure',
  'load-failure',
  'auth-required',
  'config-failure',
  'history',
] as const;

export type AcpBddFixture = (typeof ACP_BDD_FIXTURES)[number];
export type WebMcpProfile = 'default' | 'interactive' | 'full';
export type AiNativePanelLayout = 'classic' | 'agentic';

export interface AcpBddFixtureOptions {
  fixture: AcpBddFixture;
  profile?: WebMcpProfile;
  panelLayout?: AiNativePanelLayout;
  workspaceFiles?: string[];
  delayMs?: number;
  longStreamTicks?: number;
  sessionPrefix?: string;
  agentType?: string;
  showChatView?: boolean;
  ensureAgenticLayout?: boolean;
  waitForModelContext?: boolean;
  viewport?: {
    width: number;
    height: number;
  };
}

export interface AcpBddFixtureRuntime {
  app: OpenSumiApp;
  workspace: OpenSumiWorkspace;
  fixture: AcpBddFixture;
  profile: WebMcpProfile;
  workspaceDir: string;
  url: string;
  dispose(): Promise<void>;
}

export interface AcpBddFixturePass extends AcpBddFixtureOptions {
  name?: string;
}

export const ACP_BDD_REPO_ROOT = path.resolve(__dirname, '../../../../..');
export const ACP_BDD_DEFAULT_WORKSPACE = path.join(ACP_BDD_REPO_ROOT, 'tools/playwright/src/tests/workspaces/default');
export const ACP_BDD_MOCK_ACP_AGENT = path.join(ACP_BDD_REPO_ROOT, 'test/bdd/fixtures/acp-agent/mock-acp-agent.mjs');
const DEFAULT_AGENT_TYPE = 'claude-agent-acp';
const LOCK_ROOT = path.join(os.tmpdir(), 'opensumi-bdd-acp-fixture-runtime');
const LOCK_STALE_MS = 5 * 60 * 1000;
const LOCK_TIMEOUT_MS = 90 * 1000;
export const ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS = 120 * 1000;
const MODEL_CONTEXT_TIMEOUT_MS = 60 * 1000;
const ACP_CHAT_READY_TIMEOUT_MS = 60 * 1000;
const AI_NATIVE_PANEL_LAYOUT_SETTING_ID = 'ai.native.panelLayout';
let nextRuntimeId = 1;

function assertSupportedFixture(fixture: string): asserts fixture is AcpBddFixture {
  if (!(ACP_BDD_FIXTURES as readonly string[]).includes(fixture)) {
    throw new Error(`Unsupported ACP BDD fixture: ${fixture}`);
  }
}

function createSessionPrefix(): string {
  return `bdd-session-${process.pid}-${Date.now()}-${nextRuntimeId++}`;
}

function withRuntimeDefaults(options: AcpBddFixtureOptions): AcpBddFixtureOptions {
  return {
    ...options,
    sessionPrefix: options.sessionPrefix || createSessionPrefix(),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireRuntimeLock(): Promise<() => Promise<void>> {
  const lockDir = path.join(LOCK_ROOT, 'runtime.lock');
  const startedAt = Date.now();

  await fs.mkdir(LOCK_ROOT, { recursive: true });

  while (Date.now() - startedAt < LOCK_TIMEOUT_MS) {
    try {
      await fs.mkdir(lockDir);
      await fs.writeFile(
        path.join(lockDir, 'owner.json'),
        `${JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }, null, 2)}\n`,
        'utf8',
      );
      return async () => {
        await fs.rm(lockDir, { recursive: true, force: true });
      };
    } catch (error: any) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      try {
        const stat = await fs.stat(lockDir);
        if (Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
          await fs.rm(lockDir, { recursive: true, force: true });
          continue;
        }
      } catch (statError: any) {
        if (statError?.code !== 'ENOENT') {
          throw statError;
        }
      }

      await sleep(250);
    }
  }

  throw new Error(`Timed out waiting for ACP BDD fixture runtime lock: ${lockDir}`);
}

async function readJsonObject(filePath: string): Promise<Record<string, unknown>> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error: any) {
    if (error?.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

export function getMockAcpAgentCommand(options: AcpBddFixtureOptions) {
  assertSupportedFixture(options.fixture);

  const args = [ACP_BDD_MOCK_ACP_AGENT, `--fixture=${options.fixture}`];
  const env: Record<string, string> = {
    OPENSUMI_ACP_BDD_FIXTURE: options.fixture,
  };

  if (options.delayMs !== undefined) {
    args.push(`--delay-ms=${options.delayMs}`);
    env.OPENSUMI_ACP_BDD_DELAY_MS = String(options.delayMs);
  }
  if (options.longStreamTicks !== undefined) {
    args.push(`--long-stream-ticks=${options.longStreamTicks}`);
    env.OPENSUMI_ACP_BDD_LONG_STREAM_TICKS = String(options.longStreamTicks);
  }
  if (options.sessionPrefix) {
    args.push(`--session-prefix=${options.sessionPrefix}`);
    env.OPENSUMI_ACP_BDD_SESSION_PREFIX = options.sessionPrefix;
  }

  return {
    command: process.execPath,
    args,
    cwd: ACP_BDD_REPO_ROOT,
    env,
    streaming: true,
    description: `OpenSumi BDD mock ACP agent (${options.fixture})`,
  };
}

export async function writeMockAcpAgentSettings(workspaceDir: string, options: AcpBddFixtureOptions): Promise<void> {
  const settingsDir = path.join(workspaceDir, '.sumi');
  const settingsPath = path.join(settingsDir, 'settings.json');
  const agentType = options.agentType || DEFAULT_AGENT_TYPE;
  const settings = await readJsonObject(settingsPath);
  const existingAgents = settings['ai-native.acp.agents'];
  const agents =
    existingAgents && typeof existingAgents === 'object' && !Array.isArray(existingAgents)
      ? { ...(existingAgents as Record<string, unknown>) }
      : {};

  agents[agentType] = getMockAcpAgentCommand({ ...options, agentType });
  settings['ai.native.agent.defaultType'] = agentType;
  settings['ai-native.acp.agents'] = agents;

  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export async function writeAiNativePanelLayoutSettings(
  workspaceDir: string,
  panelLayout: AiNativePanelLayout,
): Promise<void> {
  const settingsDir = path.join(workspaceDir, '.sumi');
  const settingsPath = path.join(settingsDir, 'settings.json');
  const settings = await readJsonObject(settingsPath);

  settings[AI_NATIVE_PANEL_LAYOUT_SETTING_ID] = panelLayout;

  await fs.mkdir(settingsDir, { recursive: true });
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export async function waitForWorkbenchReady(page: Page): Promise<void> {
  await page.waitForSelector('.loading_indicator', { state: 'detached' });
  await page.waitForSelector('#main');
  await page.waitForFunction(() => {
    const text = document.body.innerText || '';
    const shellReady =
      document.readyState === 'complete' &&
      !!document.querySelector('#main') &&
      !document.querySelector('.loading_indicator');
    const workbenchVisible =
      text.includes('EXPLORER') ||
      text.includes('Agentic') ||
      text.includes('editor.js') ||
      !!document.querySelector('.monaco-editor');
    return shellReady && workbenchVisible;
  });
}

export async function ensureAgenticLayout(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const aiChat = document.querySelector('.AI-Chat-slot')?.getBoundingClientRect();
      const workbench = document.querySelector('#workbench-editor')?.getBoundingClientRect();

      return Boolean(aiChat && workbench && aiChat.width >= 640 && aiChat.x < workbench.x);
    },
    undefined,
    { timeout: 30_000 },
  );
}

export async function waitForAcpChatReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const slot = document.querySelector('.AI-Chat-slot');
      if (!slot) {
        return false;
      }

      const slotRect = slot.getBoundingClientRect();
      const slotText = slot.textContent || '';
      if (slotRect.width <= 0 || slotRect.height <= 0 || slotText.includes('Initializing ACP service')) {
        return false;
      }

      const hasVisibleInput = Array.from(
        slot.querySelectorAll('textarea, input, [role="textbox"], [contenteditable="true"]'),
      ).some((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
      });
      const hasAcpHistory = Boolean(
        slot.querySelector('[data-testid="acp-chat-history-inline"], [data-testid="acp-chat-history-button"]'),
      );

      return hasVisibleInput || hasAcpHistory || slotText.includes('AI Assistant');
    },
    undefined,
    { timeout: ACP_CHAT_READY_TIMEOUT_MS },
  );
}

export function aiNativeWorkbenchUrl(
  workspaceDir: string,
  profile: WebMcpProfile = 'default',
  panelLayout: AiNativePanelLayout = 'agentic',
): string {
  const params = new URLSearchParams({ workspaceDir, aiNative: 'true', aiPanelLayout: panelLayout });
  if (profile !== 'default') {
    params.set('webMcpProfile', profile);
  }
  return `/?${params.toString()}`;
}

export async function loadAcpBddFixtureWorkbench(
  page: Page,
  options: AcpBddFixtureOptions,
): Promise<AcpBddFixtureRuntime> {
  assertSupportedFixture(options.fixture);
  const runtimeOptions = withRuntimeDefaults(options);
  const releaseLock = await acquireRuntimeLock();

  let app: OpenSumiApp | undefined;
  let workspace: OpenSumiWorkspace | undefined;

  try {
    if (runtimeOptions.viewport) {
      await page.setViewportSize(runtimeOptions.viewport);
    }

    const profile = runtimeOptions.profile || 'default';
    const panelLayout = runtimeOptions.panelLayout || 'agentic';
    workspace = new OpenSumiWorkspace(runtimeOptions.workspaceFiles || [ACP_BDD_DEFAULT_WORKSPACE]);
    await workspace.initWorksapce();
    const workspaceDir = workspace.workspace.codeUri.fsPath;
    await writeMockAcpAgentSettings(workspaceDir, runtimeOptions);
    await writeAiNativePanelLayoutSettings(workspaceDir, panelLayout);

    app = new OpenSumiApp(page);
    const url = aiNativeWorkbenchUrl(workspaceDir, profile, panelLayout);
    await page.goto(url);
    await waitForWorkbenchReady(page);

    if (runtimeOptions.waitForModelContext !== false || runtimeOptions.showChatView) {
      await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool), undefined, {
        timeout: MODEL_CONTEXT_TIMEOUT_MS,
      });
    }
    if (runtimeOptions.showChatView) {
      await page.evaluate(async () => {
        await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
      });
      await waitForAcpChatReady(page);
    }
    if (runtimeOptions.ensureAgenticLayout) {
      await ensureAgenticLayout(page);
    }

    return {
      app,
      workspace,
      fixture: runtimeOptions.fixture,
      profile,
      workspaceDir,
      url: page.url(),
      async dispose() {
        app?.dispose();
        workspace?.dispose();
        await releaseLock();
      },
    };
  } catch (error) {
    app?.dispose();
    workspace?.dispose();
    await releaseLock();
    throw error;
  }
}

export async function runAcpBddFixturePasses<T>(
  page: Page,
  passes: AcpBddFixturePass[],
  runPass: (runtime: AcpBddFixtureRuntime, pass: AcpBddFixturePass) => Promise<T>,
): Promise<T[]> {
  const results: T[] = [];

  for (const pass of passes) {
    const runtime = await loadAcpBddFixtureWorkbench(page, pass);
    try {
      results.push(await runPass(runtime, pass));
    } finally {
      await runtime.dispose();
    }
  }

  return results;
}
