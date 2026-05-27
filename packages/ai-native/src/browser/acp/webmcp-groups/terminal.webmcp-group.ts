/**
 * Terminal WebMCP group definition for the ACP channel.
 *
 * Mirrors the terminal_* WebMCP tools from packages/terminal-next/src/browser/webmcp-tools.registry.ts
 * but wrapped in the WebMcpGroupRegistration interface used by the group-based ACP tool system.
 *
 * Tools follow the naming convention: _opensumi/terminal/{action}
 */
import { Injector } from '@opensumi/di';
import { ITerminalService } from '@opensumi/ide-terminal-next/lib/common';
import { ITerminalApiService } from '@opensumi/ide-terminal-next/lib/common/api';
import { ITerminalController } from '@opensumi/ide-terminal-next/lib/common/controller';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

export function createTerminalGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'terminal',
    description: '终端操作',
    defaultLoaded: true,
    tools: [
      // ----- _opensumi/terminal/list -----
      {
        method: '_opensumi/terminal/list',
        description:
          'List all open terminal sessions. Returns an array of terminal info objects including id, name, and isActive. Use this to discover existing terminals before sending commands.',
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

      // ----- _opensumi/terminal/create -----
      {
        method: '_opensumi/terminal/create',
        description:
          'Create a new terminal session. Optionally specify a shell path or working directory. Returns the terminal id. Use this to open a new terminal for running commands.',
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

      // ----- _opensumi/terminal/executeCommand -----
      {
        method: '_opensumi/terminal/executeCommand',
        description:
          'Send a text command to a specific terminal session identified by id. The text is typed into the terminal as-is. To execute the command, include a trailing newline (\\n). Get valid ids from _opensumi/terminal/list.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID. Get valid IDs from _opensumi/terminal/list.',
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
              commandSent: command,
            });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- _opensumi/terminal/show -----
      {
        method: '_opensumi/terminal/show',
        description:
          'Show/focus a specific terminal session in the terminal panel. Use this to bring a terminal into view.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID to show. Get valid IDs from _opensumi/terminal/list.',
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

      // ----- _opensumi/terminal/getProcessId -----
      {
        method: '_opensumi/terminal/getProcessId',
        description:
          'Get the OS process ID (PID) of the shell process running in a terminal session. Returns null if the process has exited.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID. Get valid IDs from _opensumi/terminal/list.',
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

      // ----- _opensumi/terminal/dispose -----
      {
        method: '_opensumi/terminal/dispose',
        description:
          'Close/kill a terminal session and its underlying shell process. Use this to clean up terminals that are no longer needed.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID to close. Get valid IDs from _opensumi/terminal/list.',
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
            terminalApi.removeTerm(id);
            return successResult({ terminalId: id, status: 'disposed' });
          } catch (err) {
            return errorResult('EXECUTION_ERROR', err);
          }
        },
      },

      // ----- _opensumi/terminal/resize -----
      {
        method: '_opensumi/terminal/resize',
        description: 'Resize a terminal session to the specified number of columns (width) and rows (height).',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'The terminal session ID. Get valid IDs from _opensumi/terminal/list.',
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

      // ----- _opensumi/terminal/getOS -----
      {
        method: '_opensumi/terminal/getOS',
        description:
          'Get the operating system type of the terminal backend (e.g. "Linux", "macOS", "Windows"). Useful for writing platform-specific commands.',
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

      // ----- _opensumi/terminal/getProfiles -----
      {
        method: '_opensumi/terminal/getProfiles',
        description:
          'Get the list of available terminal shell profiles (e.g. bash, zsh, PowerShell). Use the profile name with _opensumi/terminal/create to open a specific shell.',
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

      // ----- _opensumi/terminal/showPanel -----
      {
        method: '_opensumi/terminal/showPanel',
        description:
          'Show/open the terminal panel in the IDE. Use this to ensure the terminal panel is visible before interacting with terminals.',
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
