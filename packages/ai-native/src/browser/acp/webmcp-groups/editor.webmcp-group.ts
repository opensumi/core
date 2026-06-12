/**
 * WebMCP group definition for editor operations.
 *
 * Provides tools for AI agents to open, close, navigate, and manipulate
 * editor tabs and selections within the IDE.
 *
 * Tools follow the naming convention: editor_{action}
 */
import { Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { CommandService, URI } from '@opensumi/ide-core-common';
import { IEditor, IEditorDocumentModel, IResourceOpenOptions, WorkbenchEditorService } from '@opensumi/ide-editor';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser/doc-model/types';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

import {
  resolveWorkspaceFilePath,
  validateWorkspacePathAccess,
  validateWritableWorkspaceTarget,
} from './file-workspace-path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ActiveEditorInfo {
  path: string | null;
  uri: string | null;
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
    uri: uri ? uri.toString() : null,
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

function resolveEditorUri(container: Injector, pathOrUri: string): URI {
  if (pathOrUri.startsWith('file://')) {
    return URI.parse(pathOrUri);
  }
  if (pathOrUri.startsWith('/')) {
    return URI.file(pathOrUri);
  }
  const appConfig = tryGetService<AppConfig>(container, AppConfig);
  const workspaceDir = appConfig?.workspaceDir;
  return URI.file(workspaceDir ? `${workspaceDir}/${pathOrUri}`.replace(/\/+/g, '/') : pathOrUri);
}

function invalidPathResult(message: string) {
  return errorResult('INVALID_INPUT', new Error(message));
}

async function resolveWorkspaceEditorUri(
  container: Injector,
  filePath: string,
  access: 'read' | 'write',
): Promise<
  | {
      ok: true;
      uri: URI;
      absolutePath: string;
    }
  | {
      ok: false;
      result: ReturnType<typeof errorResult>;
    }
> {
  const appConfig = tryGetService<AppConfig>(container, AppConfig);
  if (!appConfig || !appConfig.workspaceDir) {
    return { ok: false, result: serviceUnavailableResult('AppConfig') };
  }
  const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
  if (!fileService) {
    return { ok: false, result: serviceUnavailableResult('IFileServiceClient') };
  }

  const resolved = resolveWorkspaceFilePath(appConfig.workspaceDir, filePath);
  if (!resolved.ok) {
    return { ok: false, result: invalidPathResult(resolved.message) };
  }
  const validation =
    access === 'write'
      ? await validateWritableWorkspaceTarget(fileService, appConfig.workspaceDir, resolved.value)
      : await validateWorkspacePathAccess(fileService, appConfig.workspaceDir, resolved.value);
  if (!validation.ok) {
    return { ok: false, result: invalidPathResult(validation.message) };
  }

  return {
    ok: true,
    uri: URI.file(resolved.value.absolutePath),
    absolutePath: resolved.value.absolutePath,
  };
}

function toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
  return Math.min(Math.max(Number(value) || fallback, 1), cap);
}

async function withDocumentModel<T>(
  container: Injector,
  uri: URI,
  fn: (model: IEditorDocumentModel) => T | Promise<T>,
): Promise<T | null> {
  const documentModelService = tryGetService<IEditorDocumentModelService>(container, IEditorDocumentModelService);
  if (!documentModelService) {
    return null;
  }
  const existingRef = documentModelService.getModelReference(uri, 'webmcp');
  if (existingRef) {
    try {
      return await fn(existingRef.instance);
    } finally {
      existingRef.dispose();
    }
  }
  const ref = await documentModelService.createModelReference(uri, 'webmcp');
  try {
    return await fn(ref.instance);
  } finally {
    ref.dispose();
  }
}

function createSimpleDiff(original: string, modified: string, maxLines: number): { diff: string; truncated: boolean } {
  const originalLines = original.split(/\r?\n/);
  const modifiedLines = modified.split(/\r?\n/);
  let prefix = 0;
  while (
    prefix < originalLines.length &&
    prefix < modifiedLines.length &&
    originalLines[prefix] === modifiedLines[prefix]
  ) {
    prefix++;
  }
  let suffix = 0;
  while (
    suffix + prefix < originalLines.length &&
    suffix + prefix < modifiedLines.length &&
    originalLines[originalLines.length - 1 - suffix] === modifiedLines[modifiedLines.length - 1 - suffix]
  ) {
    suffix++;
  }
  const removed = originalLines.slice(prefix, originalLines.length - suffix);
  const added = modifiedLines.slice(prefix, modifiedLines.length - suffix);
  const lines = [
    `@@ -${prefix + 1},${removed.length} +${prefix + 1},${added.length} @@`,
    ...removed.map((line) => `-${line}`),
    ...added.map((line) => `+${line}`),
  ];
  return {
    diff: lines.slice(0, maxLines).join('\n'),
    truncated: lines.length > maxLines,
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
      // ----- editor_open -----
      {
        name: 'editor_open',
        description:
          'Open a file in the editor. Optionally specify a line and column to scroll to. Returns the editor info for the opened file.',
        riskLevel: 'ui',
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

      // ----- editor_close -----
      {
        name: 'editor_close',
        description: 'Close the editor tab for the given file path.',
        riskLevel: 'ui',
        profiles: ['interactive', 'full'],
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

      // ----- editor_get_active -----
      {
        name: 'editor_get_active',
        description: 'Get information about the currently active editor, including file path and selection range.',
        riskLevel: 'read',
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

      // ----- editor_list_open_files -----
      {
        name: 'editor_list_open_files',
        description: 'List files currently opened in editor groups, including dirty and active state.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          const documentModelService = tryGetService<IEditorDocumentModelService>(
            container,
            IEditorDocumentModelService,
          );
          try {
            const activeUri = editorService.currentEditor?.currentUri?.toString();
            const files = editorService.editorGroups.flatMap((group, groupIndex) =>
              group.resources.map((resource) => {
                const ref = documentModelService?.getModelReference(resource.uri, 'webmcp');
                try {
                  const model = ref?.instance;
                  return {
                    uri: resource.uri.toString(),
                    path: resource.uri.codeUri.fsPath,
                    name: resource.name,
                    groupIndex,
                    active: resource.uri.toString() === activeUri,
                    dirty: Boolean(model?.dirty),
                    languageId: model?.languageId,
                  };
                } finally {
                  ref?.dispose();
                }
              }),
            );
            return successResult({ files, total: files.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_get_selection -----
      {
        name: 'editor_get_selection',
        description: 'Get the active editor selection range and selected text.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            maxChars: {
              type: 'number',
              description: 'Maximum selected characters to return. Defaults to 20000, capped at 100000.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const editor = editorService.currentEditor;
            const uri = editor?.currentUri;
            const selection = editor?.getSelections()?.[0];
            if (!editor || !uri || !selection) {
              return successResult({ active: false, selection: null, text: '' });
            }
            const maxChars = toPositiveCappedNumber(params.maxChars, 20_000, 100_000);
            const text =
              editor.currentDocumentModel?.getText({
                startLineNumber: selection.selectionStartLineNumber,
                startColumn: selection.selectionStartColumn,
                endLineNumber: selection.positionLineNumber,
                endColumn: selection.positionColumn,
              }) ?? '';
            return successResult({
              active: true,
              uri: uri.toString(),
              path: uri.codeUri.fsPath,
              selection: {
                startLine: selection.selectionStartLineNumber,
                startColumn: selection.selectionStartColumn,
                endLine: selection.positionLineNumber,
                endColumn: selection.positionColumn,
              },
              text: text.slice(0, maxChars),
              truncated: text.length > maxChars,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_read_buffer -----
      {
        name: 'editor_read_buffer',
        description: 'Read an editor buffer, including unsaved content. Defaults to the active editor.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional file path or file URI. Defaults to the active editor.',
            },
            maxChars: {
              type: 'number',
              description: 'Maximum characters to return. Defaults to 100000, capped at 500000.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri =
              typeof params.path === 'string' && params.path
                ? resolveEditorUri(container, params.path)
                : editorService.currentEditor?.currentUri;
            if (!uri) {
              return errorResult('INVALID_INPUT', new Error('path is required when no active editor exists'));
            }
            const maxChars = toPositiveCappedNumber(params.maxChars, 100_000, 500_000);
            const data = await withDocumentModel(container, uri, (model) => {
              const text = model.getText();
              return {
                uri: uri.toString(),
                path: uri.codeUri.fsPath,
                languageId: model.languageId,
                dirty: model.dirty,
                text: text.slice(0, maxChars),
                size: text.length,
                truncated: text.length > maxChars,
              };
            });
            if (!data) {
              return serviceUnavailableResult('IEditorDocumentModelService');
            }
            return successResult(data);
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_read_range_from_buffer -----
      {
        name: 'editor_read_range_from_buffer',
        description: 'Read a line range from an editor buffer, including unsaved content.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional file path or file URI. Defaults to the active editor.',
            },
            startLine: {
              type: 'number',
              description: 'Start line, 1-based.',
            },
            endLine: {
              type: 'number',
              description: 'End line, 1-based. Defaults to startLine.',
            },
            maxChars: {
              type: 'number',
              description: 'Maximum characters to return. Defaults to 50000, capped at 200000.',
            },
          },
          required: ['startLine'],
        },
        execute: async (params: Record<string, unknown>) => {
          const startLine = Number(params.startLine);
          const endLine = Number(params.endLine) || startLine;
          if (!startLine || startLine < 1 || endLine < startLine) {
            return errorResult('INVALID_INPUT', new Error('valid startLine and endLine are required'));
          }
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri =
              typeof params.path === 'string' && params.path
                ? resolveEditorUri(container, params.path)
                : editorService.currentEditor?.currentUri;
            if (!uri) {
              return errorResult('INVALID_INPUT', new Error('path is required when no active editor exists'));
            }
            const maxChars = toPositiveCappedNumber(params.maxChars, 50_000, 200_000);
            const data = await withDocumentModel(container, uri, (model) => {
              const lineCount = model.getMonacoModel().getLineCount();
              if (startLine > lineCount) {
                return {
                  uri: uri.toString(),
                  path: uri.codeUri.fsPath,
                  startLine,
                  endLine: lineCount,
                  lineCount,
                  text: '',
                  truncated: false,
                };
              }
              const safeEndLine = Math.min(endLine, lineCount);
              const text = model.getText({
                startLineNumber: startLine,
                startColumn: 1,
                endLineNumber: safeEndLine,
                endColumn: model.getMonacoModel().getLineMaxColumn(safeEndLine),
              });
              return {
                uri: uri.toString(),
                path: uri.codeUri.fsPath,
                startLine,
                endLine: safeEndLine,
                lineCount,
                text: text.slice(0, maxChars),
                truncated: text.length > maxChars,
              };
            });
            if (!data) {
              return serviceUnavailableResult('IEditorDocumentModelService');
            }
            return successResult(data);
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_list_dirty_files -----
      {
        name: 'editor_list_dirty_files',
        description: 'List unsaved editor buffers.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const documentModelService = tryGetService<IEditorDocumentModelService>(
            container,
            IEditorDocumentModelService,
          );
          if (!documentModelService) {
            return serviceUnavailableResult('IEditorDocumentModelService');
          }
          try {
            const files = documentModelService
              .getAllModels()
              .filter((model) => model.dirty)
              .map((model) => ({
                uri: model.uri.toString(),
                path: model.uri.codeUri.fsPath,
                languageId: model.languageId,
                savable: model.savable,
                readonly: model.readonly,
              }));
            return successResult({ files, total: files.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_get_dirty_diff -----
      {
        name: 'editor_get_dirty_diff',
        description: 'Return a compact diff between disk content and an unsaved editor buffer.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional file path or file URI. Defaults to the active editor.',
            },
            maxLines: {
              type: 'number',
              description: 'Maximum diff lines to return. Defaults to 200, capped at 1000.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          const fileService = tryGetService<IFileServiceClient>(container, IFileServiceClient);
          if (!fileService) {
            return serviceUnavailableResult('IFileServiceClient');
          }
          try {
            const uri =
              typeof params.path === 'string' && params.path
                ? resolveEditorUri(container, params.path)
                : editorService.currentEditor?.currentUri;
            if (!uri) {
              return errorResult('INVALID_INPUT', new Error('path is required when no active editor exists'));
            }
            const maxLines = toPositiveCappedNumber(params.maxLines, 200, 1000);
            const fileStat = await fileService.getFileStat(uri.toString());
            const diskText = fileStat ? (await fileService.readFile(uri.toString())).content.toString() : '';
            const data = await withDocumentModel(container, uri, (model) => {
              const bufferText = model.getText();
              const { diff, truncated } = createSimpleDiff(diskText, bufferText, maxLines);
              return {
                uri: uri.toString(),
                path: uri.codeUri.fsPath,
                dirty: model.dirty,
                diff,
                truncated,
              };
            });
            if (!data) {
              return serviceUnavailableResult('IEditorDocumentModelService');
            }
            return successResult(data);
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_set_selection -----
      {
        name: 'editor_set_selection',
        description:
          'Set the selection range in the editor. Opens the file first if it is not already open, then sets the selection to the specified line range.',
        riskLevel: 'ui',
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

      // ----- editor_format -----
      {
        name: 'editor_format',
        description: 'Format the document at the given path using the editor format command.',
        riskLevel: 'write',
        profiles: ['full'],
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
            const resolved = await resolveWorkspaceEditorUri(container, filePath, 'write');
            if (!resolved.ok) {
              return resolved.result;
            }
            // Open the file first to ensure it is the active editor.
            const uri = resolved.uri;
            await editorService.open(uri, { focus: true });
            await commandService.executeCommand('editor.action.formatDocument');
            return successResult({ path: resolved.absolutePath, formatted: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },

      // ----- editor_fold -----
      {
        name: 'editor_fold',
        description: 'Fold code at the specified line in the editor. Opens the file first if needed.',
        riskLevel: 'ui',
        profiles: ['interactive', 'full'],
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

      // ----- editor_unfold -----
      {
        name: 'editor_unfold',
        description: 'Unfold code at the specified line in the editor. Opens the file first if needed.',
        riskLevel: 'ui',
        profiles: ['interactive', 'full'],
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

      // ----- editor_save -----
      {
        name: 'editor_save',
        description: 'Save the file at the given path.',
        riskLevel: 'write',
        profiles: ['full'],
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
            const resolved = await resolveWorkspaceEditorUri(container, filePath, 'write');
            if (!resolved.ok) {
              return resolved.result;
            }
            const isOpen = editorService.editorGroups.some((group) =>
              group.resources.some((resource) => resource.uri.isEqual(resolved.uri)),
            );
            if (!isOpen) {
              return errorResult('INVALID_INPUT', new Error(`Editor is not open for path: ${filePath}`));
            }
            const savedUri = await editorService.save(resolved.uri);
            if (!savedUri) {
              return errorResult('FILE_NOT_FOUND', new Error(`Editor not found for path: ${filePath}`));
            }
            return successResult({ path: resolved.absolutePath, saved: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
