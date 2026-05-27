/**
 * WebMCP tool registry for the terminal-next module.
 *
 * Registers browser-side tools on `navigator.modelContext` that allow an external
 * AI agent to interact with the terminal panel — creating terminals, sending commands,
 * listing sessions, and querying terminal state.
 *
 * Tools follow the naming convention: terminal_<action>
 *
 * PHASE 1: Register core terminal operations with hand-crafted schemas.
 * Phase 2: Later, add more granular tools and refine descriptions.
 */
import { Injector, IDisposable } from '@opensumi/di';
import { ensureModelContext } from '@opensumi/ide-core-browser/lib/webmcp-polyfill';

import { ITerminalService } from '../common';
import { ITerminalApiService } from '../common/api';
import { ITerminalController } from '../common/controller';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tryGetService<T>(container: Injector, token: symbol): T | null {
  try {
    return container.get(token) as T;
  } catch {
    return null;
  }
}

function classifyError(err: unknown): string {
  if (typeof err === 'object' && err !== null) {
    const name = (err as Error).name || '';
    if (name.includes('Timeout') || name.includes('timeout')) return 'RPC_TIMEOUT';
    if (name.includes('Injector') || name.includes('DI')) return 'DI_ERROR';
    if (name.includes('Permission') || name.includes('denied')) return 'PERMISSION_DENIED';
    if (name.includes('Abort')) return 'ABORTED';
  }
  return 'EXECUTION_ERROR';
}

function safeErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  return msg
    .replace(/[A-Za-z_]*token[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .replace(/[A-Za-z_]*key[A-Za-z_]*[:=\s]+["']?[A-Za-z0-9+/=]+["']?/gi, '[REDACTED]')
    .substring(0, 200);
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export function registerTerminalWebMCPTools(container: Injector): IDisposable {
  ensureModelContext();

  const ctx = navigator.modelContext!;
  const controller = new AbortController();

  // ----- terminal_list -----
  ctx.registerTool(
    {
      name: 'terminal_list',
      description:
        'List all open terminal sessions. Returns an array of terminal info objects including id, name, isActive, and pid. Use this to discover existing terminals before sending commands.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
        if (!terminalApi) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalApiService not registered in DI container',
          };
        }
        try {
          const terminals = terminalApi.terminals;
          return {
            success: true,
            result: terminals.map((t) => ({
              id: t.id,
              name: t.name,
              isActive: t.isActive,
            })),
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_create -----
  ctx.registerTool(
    {
      name: 'terminal_create',
      description:
        'Create a new terminal session. Optionally specify a shell path or working directory. Returns the terminal id. Use this to open a new terminal for running commands.',
      inputSchema: {
        type: 'object',
        properties: {
          cwd: {
            type: 'string',
            description: 'Working directory for the new terminal. Defaults to workspace root.',
          },
          shellPath: {
            type: 'string',
            description: 'Shell executable path (e.g. "/bin/bash", "/bin/zsh"). Defaults to system default.',
          },
          name: {
            type: 'string',
            description: 'Display name for the terminal.',
          },
        },
      },
      execute: async (args?: { cwd?: string; shellPath?: string; name?: string }) => {
        const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
        if (!terminalController) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalController not registered in DI container',
          };
        }
        try {
          await terminalController.viewReady.promise;
          const client = await terminalController.createTerminal({
            config: args?.shellPath ? { executable: args.shellPath } : undefined,
            cwd: args?.cwd,
          });
          return {
            success: true,
            result: {
              id: client.id,
              name: client.name,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_executeCommand -----
  ctx.registerTool(
    {
      name: 'terminal_executeCommand',
      description:
        'Send a text command to a specific terminal session identified by terminalId. The text is typed into the terminal as-is. To execute the command, include a trailing newline (\\n). Get valid terminalIds from terminal_list.',
      inputSchema: {
        type: 'object',
        properties: {
          terminalId: {
            type: 'string',
            description: 'The terminal session ID. Get valid IDs from terminal_list.',
          },
          command: {
            type: 'string',
            description: 'The text to send to the terminal. Append "\\n" to execute the command.',
          },
        },
        required: ['terminalId', 'command'],
      },
      execute: async (args: { terminalId: string; command: string }) => {
        if (!args.terminalId || !args.command) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'terminalId and command are required',
          };
        }
        const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
        if (!terminalApi) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalApiService not registered in DI container',
          };
        }
        try {
          terminalApi.sendText(args.terminalId, args.command);
          return {
            success: true,
            result: {
              terminalId: args.terminalId,
              commandSent: args.command,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_show -----
  ctx.registerTool(
    {
      name: 'terminal_show',
      description:
        'Show/focus a specific terminal session in the terminal panel. Use this to bring a terminal into view.',
      inputSchema: {
        type: 'object',
        properties: {
          terminalId: {
            type: 'string',
            description: 'The terminal session ID to show. Get valid IDs from terminal_list.',
          },
        },
        required: ['terminalId'],
      },
      execute: async (args: { terminalId: string }) => {
        if (!args.terminalId) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'terminalId is required',
          };
        }
        const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
        if (!terminalApi) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalApiService not registered in DI container',
          };
        }
        try {
          terminalApi.showTerm(args.terminalId);
          return { success: true, result: { terminalId: args.terminalId } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_getProcessId -----
  ctx.registerTool(
    {
      name: 'terminal_getProcessId',
      description:
        'Get the OS process ID (PID) of the shell process running in a terminal session. Returns undefined if the process has exited.',
      inputSchema: {
        type: 'object',
        properties: {
          terminalId: {
            type: 'string',
            description: 'The terminal session ID. Get valid IDs from terminal_list.',
          },
        },
        required: ['terminalId'],
      },
      execute: async (args: { terminalId: string }) => {
        if (!args.terminalId) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'terminalId is required',
          };
        }
        const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
        if (!terminalApi) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalApiService not registered in DI container',
          };
        }
        try {
          const pid = await terminalApi.getProcessId(args.terminalId);
          return {
            success: true,
            result: {
              terminalId: args.terminalId,
              pid: pid ?? null,
            },
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_dispose -----
  ctx.registerTool(
    {
      name: 'terminal_dispose',
      description:
        'Close/kill a terminal session and its underlying shell process. Use this to clean up terminals that are no longer needed.',
      inputSchema: {
        type: 'object',
        properties: {
          terminalId: {
            type: 'string',
            description: 'The terminal session ID to close. Get valid IDs from terminal_list.',
          },
        },
        required: ['terminalId'],
      },
      execute: async (args: { terminalId: string }) => {
        if (!args.terminalId) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'terminalId is required',
          };
        }
        const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
        if (!terminalApi) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalApiService not registered in DI container',
          };
        }
        try {
          terminalApi.removeTerm(args.terminalId);
          return { success: true, result: { terminalId: args.terminalId, status: 'disposed' } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_resize -----
  ctx.registerTool(
    {
      name: 'terminal_resize',
      description:
        'Resize a terminal session to the specified number of columns (width) and rows (height).',
      inputSchema: {
        type: 'object',
        properties: {
          terminalId: {
            type: 'string',
            description: 'The terminal session ID. Get valid IDs from terminal_list.',
          },
          cols: {
            type: 'number',
            description: 'Number of columns (character width) for the terminal.',
          },
          rows: {
            type: 'number',
            description: 'Number of rows (character height) for the terminal.',
          },
        },
        required: ['terminalId', 'cols', 'rows'],
      },
      execute: async (args: { terminalId: string; cols: number; rows: number }) => {
        if (!args.terminalId || !args.cols || !args.rows) {
          return {
            success: false,
            error: 'INVALID_INPUT',
            details: 'terminalId, cols, and rows are required',
          };
        }
        const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
        if (!terminalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalService not registered in DI container',
          };
        }
        try {
          await terminalService.resize(args.terminalId, args.cols, args.rows);
          return { success: true, result: { terminalId: args.terminalId, cols: args.cols, rows: args.rows } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_getOS -----
  ctx.registerTool(
    {
      name: 'terminal_getOS',
      description:
        'Get the operating system type of the terminal backend (e.g. "Linux", "macOS", "Windows"). Useful for writing platform-specific commands.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
        if (!terminalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalService not registered in DI container',
          };
        }
        try {
          const os = await terminalService.getOS();
          return { success: true, result: { os } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_getProfiles -----
  ctx.registerTool(
    {
      name: 'terminal_getProfiles',
      description:
        'Get the list of available terminal shell profiles (e.g. bash, zsh, PowerShell). Use the profile name with terminal_create to open a specific shell.',
      inputSchema: {
        type: 'object',
        properties: {
          autoDetect: {
            type: 'boolean',
            description: 'Whether to auto-detect available shells. Defaults to true.',
          },
        },
      },
      execute: async (args?: { autoDetect?: boolean }) => {
        const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
        if (!terminalService) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalService not registered in DI container',
          };
        }
        try {
          const profiles = await terminalService.getProfiles(args?.autoDetect ?? true);
          return {
            success: true,
            result: profiles.map((p: any) => ({
              profileName: p.profileName,
              path: p.path,
              isAutoDetected: p.isAutoDetected,
            })),
          };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  // ----- terminal_showPanel -----
  ctx.registerTool(
    {
      name: 'terminal_showPanel',
      description:
        'Show/open the terminal panel in the IDE. Use this to ensure the terminal panel is visible before interacting with terminals.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
      execute: async () => {
        const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
        if (!terminalController) {
          return {
            success: false,
            error: 'SERVICE_UNAVAILABLE',
            details: 'ITerminalController not registered in DI container',
          };
        }
        try {
          terminalController.showTerminalPanel();
          return { success: true, result: { status: 'shown' } };
        } catch (err) {
          return {
            success: false,
            error: classifyError(err),
            details: safeErrorMessage(err),
          };
        }
      },
    },
    { signal: controller.signal },
  );

  return { dispose: () => controller.abort() };
}
