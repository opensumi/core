/**
 * WebMCP group definition for editor operations.
 *
 * Provides tools for AI agents to open, close, navigate, and manipulate
 * editor tabs and selections within the IDE.
 *
 * Tools follow the naming convention: _opensumi/editor/{action}
 */
import { Injector } from '@opensumi/di';
import { CommandService, URI } from '@opensumi/ide-core-common';
import { IEditor, IResourceOpenOptions, WorkbenchEditorService } from '@opensumi/ide-editor';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ActiveEditorInfo {
  path: string | null;
  selection: {
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
  } | null;
}

function getActiveEditorInfo(editorService: WorkbenchEditorService): ActiveEditorInfo | null {
  const editor: IEditor | null = editorService.currentEditor;
  if (!editor) {
    return null;
  }
  const uri = editor.currentUri;
  const selections = editor.getSelections();
  const primarySelection = selections && selections.length > 0 ? selections[0] : null;

  return {
    path: uri ? uri.codeUri.fsPath : null,
    selection: primarySelection
      ? {
          startLine: primarySelection.selectionStartLineNumber,
          startCol: primarySelection.selectionStartColumn,
          endLine: primarySelection.positionLineNumber,
          endCol: primarySelection.positionColumn,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// Group definition
// ---------------------------------------------------------------------------

export function createEditorGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'editor',
    description: '编辑器操作（打开、关闭、跳转、格式化等）',
    defaultLoaded: true,
    tools: [
      // ----- _opensumi/editor/open -----
      {
        method: '_opensumi/editor/open',
        description:
          'Open a file in the editor. Optionally specify a line and column to scroll to. Returns the editor info for the opened file.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file to open.',
            },
            line: {
              type: 'number',
              description: 'The line number to scroll to (1-based).',
            },
            column: {
              type: 'number',
              description: 'The column number to scroll to (1-based).',
            },
          },
          required: ['path'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri = URI.file(filePath);
            const options: IResourceOpenOptions = {};
            const line = params.line as number | undefined;
            const column = params.column as number | undefined;
            if (line !== undefined) {
              options.range = {
                startLineNumber: line,
                startColumn: column ?? 1,
                endLineNumber: line,
                endColumn: column ?? 1,
              };
              options.revealRangeInCenter = true;
            }
            await editorService.open(uri, options);
            const info = getActiveEditorInfo(editorService);
            return successResult({ path: filePath, editor: info });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/close -----
      {
        method: '_opensumi/editor/close',
        description: 'Close the editor tab for the given file path.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file to close.',
            },
          },
          required: ['path'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri = URI.file(filePath);
            await editorService.close(uri);
            return successResult({ path: filePath, closed: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/getActive -----
      {
        method: '_opensumi/editor/getActive',
        description: 'Get information about the currently active editor, including file path and selection range.',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const info = getActiveEditorInfo(editorService);
            if (!info) {
              return successResult({ path: null, selection: null, active: false });
            }
            return successResult({ ...info, active: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/setSelection -----
      {
        method: '_opensumi/editor/setSelection',
        description:
          'Set the selection range in the editor. Opens the file first if it is not already open, then sets the selection to the specified line range.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file.',
            },
            startLine: {
              type: 'number',
              description: 'The start line of the selection (1-based).',
            },
            endLine: {
              type: 'number',
              description: 'The end line of the selection (1-based). Defaults to startLine if omitted.',
            },
          },
          required: ['path', 'startLine'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const startLine = params.startLine as number;
          const endLine = (params.endLine as number) ?? startLine;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          if (!startLine || startLine < 1) {
            return errorResult('INVALID_INPUT', new Error('startLine must be a positive number'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri = URI.file(filePath);
            await editorService.open(uri, {
              range: {
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: endLine,
                endColumn: 1,
              },
              revealRangeInCenter: true,
            });
            return successResult({ path: filePath, startLine, endLine });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/format -----
      {
        method: '_opensumi/editor/format',
        description: 'Format the document at the given path using the editor format command.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file to format.',
            },
          },
          required: ['path'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          const commandService = tryGetService<CommandService>(container, CommandService);
          if (!commandService) {
            return serviceUnavailableResult('CommandService');
          }
          try {
            // Open the file first to ensure it is the active editor
            const uri = URI.file(filePath);
            await editorService.open(uri, { focus: true });
            await commandService.executeCommand('editor.action.formatDocument');
            return successResult({ path: filePath, formatted: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/fold -----
      {
        method: '_opensumi/editor/fold',
        description: 'Fold code at the specified line in the editor. Opens the file first if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file.',
            },
            startLine: {
              type: 'number',
              description: 'The line number at which to fold code (1-based).',
            },
          },
          required: ['path', 'startLine'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const startLine = params.startLine as number;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          if (!startLine || startLine < 1) {
            return errorResult('INVALID_INPUT', new Error('startLine must be a positive number'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          const commandService = tryGetService<CommandService>(container, CommandService);
          if (!commandService) {
            return serviceUnavailableResult('CommandService');
          }
          try {
            const uri = URI.file(filePath);
            await editorService.open(uri, { focus: true });
            await commandService.executeCommand('editor.fold', startLine);
            return successResult({ path: filePath, startLine, folded: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/unfold -----
      {
        method: '_opensumi/editor/unfold',
        description: 'Unfold code at the specified line in the editor. Opens the file first if needed.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file.',
            },
            startLine: {
              type: 'number',
              description: 'The line number at which to unfold code (1-based).',
            },
          },
          required: ['path', 'startLine'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          const startLine = params.startLine as number;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          if (!startLine || startLine < 1) {
            return errorResult('INVALID_INPUT', new Error('startLine must be a positive number'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          const commandService = tryGetService<CommandService>(container, CommandService);
          if (!commandService) {
            return serviceUnavailableResult('CommandService');
          }
          try {
            const uri = URI.file(filePath);
            await editorService.open(uri, { focus: true });
            await commandService.executeCommand('editor.unfold', startLine);
            return successResult({ path: filePath, startLine, unfolded: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- _opensumi/editor/save -----
      {
        method: '_opensumi/editor/save',
        description: 'Save the file at the given path.',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'The absolute or workspace-relative path of the file to save.',
            },
          },
          required: ['path'],
        },
        execute: async (params: Record<string, unknown>) => {
          const filePath = params.path as string;
          if (!filePath) {
            return errorResult('INVALID_INPUT', new Error('path is required'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri = URI.file(filePath);
            await editorService.save(uri);
            return successResult({ path: filePath, saved: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
