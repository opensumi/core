import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { type Page, expect } from '@playwright/test';

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

export interface AcpBddFixtureOptions {
  fixture: AcpBddFixture;
  profile?: WebMcpProfile;
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
  const layoutLabel = page.getByText(/^(Agentic|Classic)$/).first();
  await expect(layoutLabel).toBeVisible();
  if ((await layoutLabel.textContent())?.trim() === 'Classic') {
    await layoutLabel.click();
    await page.getByText('Agentic', { exact: true }).last().click();
  }
  await expect(page.getByText('Agentic', { exact: true }).first()).toBeVisible();
}

function fixtureUrl(workspaceDir: string, profile: WebMcpProfile): string {
  const params = new URLSearchParams({ workspaceDir });
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
    workspace = new OpenSumiWorkspace(runtimeOptions.workspaceFiles || [ACP_BDD_DEFAULT_WORKSPACE]);
    await workspace.initWorksapce();
    const workspaceDir = workspace.workspace.codeUri.fsPath;
    await writeMockAcpAgentSettings(workspaceDir, runtimeOptions);

    app = new OpenSumiApp(page);
    const url = fixtureUrl(workspaceDir, profile);
    await page.goto(url);
    await waitForWorkbenchReady(page);

    if (runtimeOptions.waitForModelContext !== false || runtimeOptions.showChatView) {
      await page.waitForFunction(() => Boolean((navigator as any).modelContext?.executeTool));
    }
    if (runtimeOptions.showChatView) {
      await page.evaluate(async () => {
        await (navigator as any).modelContext.executeTool('acp_chat_show_chat_view', {});
      });
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
