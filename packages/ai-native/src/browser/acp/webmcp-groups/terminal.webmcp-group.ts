/**
 * Terminal WebMCP group definition for the ACP channel.
 *
 * Defines terminal_* capabilities once for both navigator.modelContext and
 * the Node-side MCP server.
 *
 * Tools follow the naming convention: terminal_{action}
 */
import { Injector } from '@opensumi/di';
import { ITerminalClient, ITerminalService } from '@opensumi/ide-terminal-next/lib/common';
import { ITerminalApiService } from '@opensumi/ide-terminal-next/lib/common/api';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common/controller';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

const DEFAULT_TERMINAL_LINES = 120;
const MAX_TERMINAL_LINES = 1000;
const MAX_WAIT_TIMEOUT_MS = 60_000;

function toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
  return Math.min(Math.max(Number(value) || fallback, 1), cap);
}

function stripAnsi(value: string): string {
  return value.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

function getTerminalClient(controller: ITerminalController, id?: string): ITerminalClient | undefined {
  if (id) {
    return controller.clients.get(id);
  }
  return controller.activeClient ?? Array.from(controller.clients.values()).find((client) => client.id);
}

function readTerminalBuffer(
  client: ITerminalClient,
  options: { cursor?: unknown; maxLines?: unknown; stripAnsi?: unknown },
): { terminalId: string; cursor: string; lines: string[]; totalBufferLines: number; truncated: boolean } {
  const maxLines = toPositiveCappedNumber(options.maxLines, DEFAULT_TERMINAL_LINES, MAX_TERMINAL_LINES);
  const buffer = client.term.buffer.active;
  const totalBufferLines = buffer.length;
  const parsedCursor = typeof options.cursor === 'string' ? Number(options.cursor) : Number(options.cursor);
  const start = Number.isFinite(parsedCursor)
    ? Math.min(Math.max(parsedCursor, 0), totalBufferLines)
    : Math.max(totalBufferLines - maxLines, 0);
  const end = Math.min(start + maxLines, totalBufferLines);
  const shouldStripAnsi = options.stripAnsi !== false;
  const lines: string[] = [];
  for (let index = start; index < end; index++) {
    const text = buffer.getLine(index)?.translateToString(true) ?? '';
    lines.push(shouldStripAnsi ? stripAnsi(text) : text);
  }
  return {
    terminalId: client.id,
    cursor: String(end),
    lines,
    totalBufferLines,
    truncated: end < totalBufferLines,
  };
}

function controlSequence(key: string): string | undefined {
  const normalized = key.toLowerCase();
  const sequences: Record<string, string> = {
    enter: '\r',
    'ctrl-c': '\x03',
    'ctrl-d': '\x04',
    escape: '\x1b',
    tab: '\t',
    up: '\x1b[A',
    down: '\x1b[B',
    right: '\x1b[C',
    left: '\x1b[D',
  };
  return sequences[normalized];
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createTerminalGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'terminal',
    description: '终端操作',
    defaultLoaded: true,
    tools: [
      // ----- terminal_list -----
      {
        name: 'terminal_list',
        description:
          'List all open terminal sessions. Returns an array of terminal info objects including id, name, and isActive. Use this to discover existing terminals before sending commands.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            const terminals = terminalApi.terminals;
            return successResult(
              terminals.map((t) => ({
                id: t.id,
                name: t.name,
                isActive: t.isActive,
              })),
            );
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_get_active -----
      {
        name: 'terminal_get_active',
        description: 'Get the active IDE terminal session.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            const client = getTerminalClient(terminalController);
            if (!client) {
              return successResult({ active: false, terminal: null });
            }
            return successResult({
              active: true,
              terminal: {
                id: client.id,
                name: client.name,
                ready: client.ready,
                cwd: client.launchConfig.cwd,
              },
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_read_output -----
      {
        name: 'terminal_read_output',
        description: 'Read recent output lines from an IDE terminal.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Optional terminal session ID. Defaults to the active terminal.',
            },
            maxLines: {
              type: 'number',
              description: 'Maximum lines to return. Defaults to 120, capped at 1000.',
            },
            stripAnsi: {
              type: 'boolean',
              description: 'Whether to strip ANSI escape sequences. Defaults to true.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            const client = getTerminalClient(terminalController, params.id as string | undefined);
            if (!client) {
              return errorResult('INVALID_INPUT', new Error('terminal not found'));
            }
            return successResult(
              readTerminalBuffer(client, { maxLines: params.maxLines, stripAnsi: params.stripAnsi }),
            );
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_tail -----
      {
        name: 'terminal_tail',
        description: 'Read output lines after a cursor from an IDE terminal.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Terminal session ID.',
            },
            cursor: {
              type: 'string',
              description: 'Cursor returned by readOutput or tail.',
            },
            maxLines: {
              type: 'number',
              description: 'Maximum lines to return. Defaults to 120, capped at 1000.',
            },
            stripAnsi: {
              type: 'boolean',
              description: 'Whether to strip ANSI escape sequences. Defaults to true.',
            },
          },
          required: ['id'],
        },
        execute: async (params: Record<string, unknown>) => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            const client = getTerminalClient(terminalController, params.id as string);
            if (!client) {
              return errorResult('INVALID_INPUT', new Error('terminal not found'));
            }
            return successResult(
              readTerminalBuffer(client, {
                cursor: params.cursor,
                maxLines: params.maxLines,
                stripAnsi: params.stripAnsi,
              }),
            );
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_get_process_info -----
      {
        name: 'terminal_get_process_info',
        description: 'Get process metadata for an IDE terminal.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Optional terminal session ID. Defaults to the active terminal.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            const client = getTerminalClient(terminalController, params.id as string | undefined);
            if (!client) {
              return errorResult('INVALID_INPUT', new Error('terminal not found'));
            }
            const pid = await terminalApi.getProcessId(client.id);
            return successResult({
              terminalId: client.id,
              name: client.name,
              pid: pid ?? null,
              cwd: client.launchConfig.cwd,
              executable: client.launchConfig.executable,
              ready: client.ready,
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_create -----
      {
        name: 'terminal_create',
        description:
          'Create a new terminal session. Optionally specify a shell path or working directory. Returns the terminal id. Use this to open a new terminal for running commands.',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Display name for the terminal.',
            },
            cwd: {
              type: 'string',
              description: 'Working directory for the new terminal. Defaults to workspace root.',
            },
            shellPath: {
              type: 'string',
              description: 'Shell executable path (e.g. "/bin/bash", "/bin/zsh"). Defaults to system default.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            await terminalController.viewReady.promise;
            const client = await terminalController.createTerminal({
              config: params.shellPath ? { executable: params.shellPath as string } : undefined,
              cwd: params.cwd as string | undefined,
            });
            return successResult({
              id: client.id,
              name: client.name,
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_execute_command -----
      {
        name: 'terminal_execute_command',
        description:
          'Send a text command to a specific terminal session identified by id. The text is typed into the terminal as-is. To execute the command, include a trailing newline (\\n). Get valid ids from terminal_list.',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID. Get valid IDs from terminal_list.',
            },
            command: {
              type: 'string',
              description: 'The text to send to the terminal. Append "\\n" to execute the command.',
            },
          },
          required: ['id', 'command'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const command = params.command as string;
          if (!id || !command) {
            return errorResult('EXECUTION_ERROR', new Error('id and command are required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            terminalApi.sendText(id, command);
            return successResult({
              terminalId: id,
              commandLength: command.length,
              sent: true,
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_send_text -----
      {
        name: 'terminal_send_text',
        description: 'Type text into an IDE terminal without pressing Enter.',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Terminal session ID.',
            },
            text: {
              type: 'string',
              description: 'Text to type. It is not logged or returned.',
            },
          },
          required: ['id', 'text'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const text = params.text as string;
          if (!id || typeof text !== 'string') {
            return errorResult('INVALID_INPUT', new Error('id and text are required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            terminalApi.sendText(id, text, false);
            return successResult({ terminalId: id, charCount: text.length, sent: true });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_send_control -----
      {
        name: 'terminal_send_control',
        description: 'Send an allowlisted control key to an IDE terminal.',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Terminal session ID.',
            },
            key: {
              type: 'string',
              enum: ['enter', 'ctrl-c', 'ctrl-d', 'escape', 'tab', 'up', 'down', 'left', 'right'],
              description: 'Control key to send.',
            },
          },
          required: ['id', 'key'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const key = params.key as string;
          const sequence = typeof key === 'string' ? controlSequence(key) : undefined;
          if (!id || !sequence) {
            return errorResult('INVALID_INPUT', new Error('valid id and key are required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            terminalApi.sendText(id, sequence, false);
            return successResult({ terminalId: id, key, sent: true });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_run_command -----
      {
        name: 'terminal_run_command',
        description: 'Type a command into an IDE terminal and press Enter.',
        riskLevel: 'shell',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Terminal session ID.',
            },
            command: {
              type: 'string',
              description: 'Command text. It is not logged or returned.',
            },
          },
          required: ['id', 'command'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const command = params.command as string;
          if (!id || !command) {
            return errorResult('INVALID_INPUT', new Error('id and command are required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            terminalApi.sendText(id, command, true);
            return successResult({ terminalId: id, commandLength: command.length, sent: true });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_wait_for_pattern -----
      {
        name: 'terminal_wait_for_pattern',
        description: 'Wait until terminal output contains a string or regular expression.',
        riskLevel: 'read',
        profiles: ['default', 'interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Terminal session ID.',
            },
            pattern: {
              type: 'string',
              description: 'String or regular expression to wait for.',
            },
            useRegExp: {
              type: 'boolean',
              description: 'Whether pattern is a regular expression.',
            },
            timeoutMs: {
              type: 'number',
              description: 'Timeout in milliseconds. Defaults to 10000, capped at 60000.',
            },
            pollIntervalMs: {
              type: 'number',
              description: 'Polling interval in milliseconds. Defaults to 500.',
            },
          },
          required: ['id', 'pattern'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const pattern = params.pattern as string;
          if (!id || !pattern) {
            return errorResult('INVALID_INPUT', new Error('id and pattern are required'));
          }
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            const client = getTerminalClient(terminalController, id);
            if (!client) {
              return errorResult('INVALID_INPUT', new Error('terminal not found'));
            }
            const timeoutMs = toPositiveCappedNumber(params.timeoutMs, 10_000, MAX_WAIT_TIMEOUT_MS);
            const pollIntervalMs = toPositiveCappedNumber(params.pollIntervalMs, 500, 5_000);
            const matcher = params.useRegExp ? new RegExp(pattern) : null;
            const startedAt = Date.now();
            while (Date.now() - startedAt < timeoutMs) {
              const output = readTerminalBuffer(client, { maxLines: DEFAULT_TERMINAL_LINES }).lines.join('\n');
              const matched = matcher ? matcher.test(output) : output.includes(pattern);
              if (matched) {
                return successResult({ terminalId: id, matched: true, elapsedMs: Date.now() - startedAt });
              }
              await wait(pollIntervalMs);
            }
            return successResult({ terminalId: id, matched: false, timedOut: true, elapsedMs: Date.now() - startedAt });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_show -----
      {
        name: 'terminal_show',
        description:
          'Show/focus a specific terminal session in the terminal panel. Use this to bring a terminal into view.',
        riskLevel: 'ui',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID to show. Get valid IDs from terminal_list.',
            },
          },
          required: ['id'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          if (!id) {
            return errorResult('EXECUTION_ERROR', new Error('id is required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            terminalApi.showTerm(id);
            return successResult({ terminalId: id });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_get_process_id -----
      {
        name: 'terminal_get_process_id',
        description:
          'Get the OS process ID (PID) of the shell process running in a terminal session. Returns null if the process has exited.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID. Get valid IDs from terminal_list.',
            },
          },
          required: ['id'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          if (!id) {
            return errorResult('EXECUTION_ERROR', new Error('id is required'));
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            const pid = await terminalApi.getProcessId(id);
            return successResult({
              terminalId: id,
              pid: pid ?? null,
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_dispose -----
      {
        name: 'terminal_dispose',
        description:
          'Close/kill a terminal session and its underlying shell process. Use this to clean up terminals that are no longer needed.',
        riskLevel: 'destructive',
        profiles: ['full'],
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID to close. Get valid IDs from terminal_list.',
            },
          },
          required: ['id'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          if (!id) {
            return errorResult('INVALID_INPUT', new Error('id is required'));
          }
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          const terminalApi = tryGetService<ITerminalApiService>(container, ITerminalApiService);
          if (!terminalApi) {
            return serviceUnavailableResult('ITerminalApiService');
          }
          try {
            const client = getTerminalClient(terminalController, id);
            if (!client) {
              return errorResult('INVALID_INPUT', new Error('terminal not found'));
            }
            terminalApi.removeTerm(id);
            return successResult({ terminalId: id, disposed: true });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_resize -----
      {
        name: 'terminal_resize',
        description: 'Resize a terminal session to the specified number of columns (width) and rows (height).',
        riskLevel: 'ui',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
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
          required: ['id', 'cols', 'rows'],
        },
        execute: async (params: Record<string, unknown>) => {
          const id = params.id as string;
          const cols = params.cols as number;
          const rows = params.rows as number;
          if (!id || !cols || !rows) {
            return errorResult('EXECUTION_ERROR', new Error('id, cols, and rows are required'));
          }
          const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
          if (!terminalService) {
            return serviceUnavailableResult('ITerminalService');
          }
          try {
            await terminalService.resize(id, cols, rows);
            return successResult({ terminalId: id, cols, rows });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_get_os -----
      {
        name: 'terminal_get_os',
        description:
          'Get the operating system type of the terminal backend (e.g. "Linux", "macOS", "Windows"). Useful for writing platform-specific commands.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
          if (!terminalService) {
            return serviceUnavailableResult('ITerminalService');
          }
          try {
            const os = await terminalService.getOS();
            return successResult({ os });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_get_profiles -----
      {
        name: 'terminal_get_profiles',
        description:
          'Get the list of available terminal shell profiles (e.g. bash, zsh, PowerShell). Use the profile name with terminal_create to open a specific shell.',
        riskLevel: 'read',
        profiles: ['interactive', 'full'],
        inputSchema: {
          type: 'object',
          properties: {
            autoDetect: {
              type: 'boolean',
              description: 'Whether to auto-detect available shells. Defaults to true.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const terminalService = tryGetService<ITerminalService>(container, ITerminalService);
          if (!terminalService) {
            return serviceUnavailableResult('ITerminalService');
          }
          try {
            const autoDetect = (params.autoDetect ?? true) as boolean;
            const profiles = await terminalService.getProfiles(autoDetect);
            return successResult(
              profiles.map((p: any) => ({
                profileName: p.profileName,
                path: p.path,
                isAutoDetected: p.isAutoDetected,
              })),
            );
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- terminal_show_panel -----
      {
        name: 'terminal_show_panel',
        description:
          'Show/open the terminal panel in the IDE. Use this to ensure the terminal panel is visible before interacting with terminals.',
        riskLevel: 'ui',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const terminalController = tryGetService<ITerminalController>(container, ITerminalController);
          if (!terminalController) {
            return serviceUnavailableResult('ITerminalController');
          }
          try {
            terminalController.showTerminalPanel();
            return successResult({ status: 'shown' });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },
    ],
  };
}
