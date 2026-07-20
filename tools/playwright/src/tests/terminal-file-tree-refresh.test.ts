// Source: test/bdd/terminal-file-tree-refresh.scenario.md

import { expect } from '@playwright/test';

import { OpenSumiExplorerView } from '../explorer-view';

import test, { page } from './hooks';
import {
  ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS,
  type AcpBddFixtureRuntime,
  loadAcpBddFixtureWorkbench,
  waitForExplorerViewVisible,
} from './utils/acp-bdd-fixture';
import { createBddEvidence } from './utils/bdd-evidence';

let runtime: AcpBddFixtureRuntime;

async function executeTool<T>(name: string, args: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ toolName, toolArgs }) => (navigator as any).modelContext.executeTool(toolName, toolArgs),
    { toolName: name, toolArgs: args },
  ) as Promise<{ success: boolean; result: T; error?: string; message?: string }>;
}

test.describe('终端文件树自动刷新', () => {
  test.setTimeout(ACP_BDD_FIXTURE_HOOK_TIMEOUT_MS);

  test.beforeAll(async () => {
    runtime = await loadAcpBddFixtureWorkbench(page, {
      fixture: 'stream-rich',
      profile: 'full',
      showChatView: false,
      ensureAgenticLayout: true,
      viewport: { width: 1800, height: 1000 },
    });
    await waitForExplorerViewVisible(page);
  });

  test.afterAll(async () => {
    await runtime?.dispose();
  });

  test('终端创建和删除文件后 Explorer 无需手动刷新即可同步', async ({ browser: _browser }, testInfo) => {
    const evidence = createBddEvidence(testInfo, 'terminal-file-tree-refresh', {
      sourceScenario: 'test/bdd/terminal-file-tree-refresh.scenario.md',
      profile: 'full',
      executionMode: 'deterministic-fixture',
      hardeningVerdict: 'CONVERT',
    });
    const runId = `${process.pid}-${Date.now()}`;
    const relativeFile = `terminal-file-tree-refresh-${runId}.txt`;
    const markerCwd = `TREE_CWD_${runId}`;
    const markerCreate = `TREE_CREATE_${runId}`;
    const markerDelete = `TREE_DELETE_${runId}`;
    let terminalId: string | undefined;

    const explorer = await runtime.app.open(OpenSumiExplorerView);
    explorer.initFileTreeView(runtime.workspace.workspace.displayName);

    try {
      const root = await executeTool<{ workspaceRoot: string }>('file_get_workspace_root');
      expect(root.success).toBe(true);
      expect(root.result.workspaceRoot).toBe(runtime.workspaceDir);
      const before = await executeTool<{ exists: boolean }>('file_exists', { path: relativeFile });
      expect(before).toMatchObject({ success: true, result: { exists: false } });
      expect(await explorer.getFileStatTreeNodeByPath(relativeFile)).toBeUndefined();

      const createdTerminal = await executeTool<{ id: string; name: string }>('terminal_create');
      expect(createdTerminal.success).toBe(true);
      terminalId = createdTerminal.result.id;
      await executeTool('terminal_show', { id: terminalId });
      await executeTool('terminal_resize', { id: terminalId, cols: 200, rows: 24 });
      await expect
        .poll(
          async () =>
            (
              await executeTool<{ ready: boolean }>('terminal_get_process_info', { id: terminalId })
            ).result.ready,
          {
            timeout: 20_000,
          },
        )
        .toBe(true);

      await executeTool('terminal_run_command', {
        id: terminalId,
        command: `pwd && printf 'TREE_CWD_' && printf '${runId}\\n'`,
      });
      expect(
        await executeTool<{ matched: boolean }>('terminal_wait_for_pattern', {
          id: terminalId,
          pattern: markerCwd,
          timeoutMs: 10_000,
        }),
      ).toMatchObject({ success: true, result: { matched: true } });
      const cwdOutput = await executeTool<{ lines: string[] }>('terminal_read_output', {
        id: terminalId,
        maxLines: 120,
      });
      const normalizedCwdOutput = cwdOutput.result.lines.join('').replace(/\s+/g, '');
      expect(normalizedCwdOutput).toContain(runtime.workspaceDir.replace(/\s+/g, ''));

      await executeTool('terminal_run_command', {
        id: terminalId,
        command: `printf 'created from terminal\\n' > '${relativeFile}' && printf 'TREE_CREATE_' && printf '${runId}\\n'`,
      });
      expect(
        await executeTool<{ matched: boolean }>('terminal_wait_for_pattern', {
          id: terminalId,
          pattern: markerCreate,
          timeoutMs: 10_000,
        }),
      ).toMatchObject({ success: true, result: { matched: true } });
      expect(await executeTool('file_exists', { path: relativeFile })).toMatchObject({
        success: true,
        result: { exists: true },
      });
      await expect
        .poll(async () => Boolean(await explorer.getFileStatTreeNodeByPath(relativeFile)), {
          message: 'Explorer 应自动显示终端创建的文件',
          timeout: 5000,
        })
        .toBe(true);

      await executeTool('terminal_run_command', {
        id: terminalId,
        command: `rm -f '${relativeFile}' && printf 'TREE_DELETE_' && printf '${runId}\\n'`,
      });
      expect(
        await executeTool<{ matched: boolean }>('terminal_wait_for_pattern', {
          id: terminalId,
          pattern: markerDelete,
          timeoutMs: 10_000,
        }),
      ).toMatchObject({ success: true, result: { matched: true } });
      expect(await executeTool('file_exists', { path: relativeFile })).toMatchObject({
        success: true,
        result: { exists: false },
      });
      await expect
        .poll(async () => Boolean(await explorer.getFileStatTreeNodeByPath(relativeFile)), {
          message: 'Explorer 应自动移除终端删除的文件',
          timeout: 5000,
        })
        .toBe(false);

      const proof = await evidence.saveJson(
        '01-terminal-file-tree-refresh',
        {
          workspaceRoot: root.result.workspaceRoot,
          terminalId,
          terminalReady: true,
          cwdMatchesWorkspace: normalizedCwdOutput.includes(runtime.workspaceDir.replace(/\s+/g, '')),
          fileVisibleAfterCreate: true,
          fileHiddenAfterDelete: true,
          manualExplorerRefreshUsed: false,
        },
        '终端默认 cwd、文件存在性与 Explorer watcher 自动增删同步',
      );
      evidence.recordCriticalPoint({
        id: 'CP1',
        requirement: 'WebMCP 创建的终端在工作区根目录启动并完成有界 marker 命令。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      evidence.recordCriticalPoint({
        id: 'CP2',
        requirement: '终端创建/删除文件后 Explorer 在 5 秒内自动增删节点，未调用 Refresh。',
        status: 'pass',
        evidence: [proof].filter(Boolean) as string[],
      });
      await evidence.finalize({
        scenarioVerdict: 'PASS',
        hardeningVerdict: 'CONVERT',
        runtime: {
          url: page.url(),
          viewport: page.viewportSize(),
          browserSurface: 'Playwright Chromium + browser WebMCP',
          fixture: runtime.fixture,
          profile: runtime.profile,
        },
      });
    } finally {
      if (terminalId) {
        const exists = await executeTool<{ exists: boolean }>('file_exists', { path: relativeFile }).catch(
          () => undefined,
        );
        if (exists?.result.exists) {
          await executeTool('terminal_run_command', { id: terminalId, command: `rm -f '${relativeFile}'` }).catch(
            () => undefined,
          );
        }
        await executeTool('terminal_dispose', { id: terminalId }).catch(() => undefined);
      }
    }
  });
});
