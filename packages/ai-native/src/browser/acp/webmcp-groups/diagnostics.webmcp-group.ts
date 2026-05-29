/**
 * WebMCP group definition for IDE diagnostics.
 */
import { Injector } from '@opensumi/di';
import { MarkerSeverity, URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IMarkerService } from '@opensumi/ide-markers';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

const DEFAULT_DIAGNOSTIC_RESULTS = 100;
const MAX_DIAGNOSTIC_RESULTS = 500;

function toPositiveCappedNumber(value: unknown, fallback: number, cap: number): number {
  return Math.min(Math.max(Number(value) || fallback, 1), cap);
}

function severityMask(value: unknown): number | undefined {
  if (typeof value !== 'string' || value === 'all') {
    return undefined;
  }
  const normalized = value.toLowerCase();
  if (normalized === 'error') {
    return MarkerSeverity.Error;
  }
  if (normalized === 'warning') {
    return MarkerSeverity.Warning;
  }
  if (normalized === 'info') {
    return MarkerSeverity.Info;
  }
  if (normalized === 'hint') {
    return MarkerSeverity.Hint;
  }
  return undefined;
}

function severityName(severity: MarkerSeverity): string {
  if (severity === MarkerSeverity.Error) {
    return 'error';
  }
  if (severity === MarkerSeverity.Warning) {
    return 'warning';
  }
  if (severity === MarkerSeverity.Info) {
    return 'info';
  }
  return 'hint';
}

function resolveResourceUri(workspaceService: IWorkspaceService | null, pathOrUri: string): string {
  if (pathOrUri.startsWith('file://')) {
    return pathOrUri;
  }
  if (pathOrUri.startsWith('/')) {
    return URI.file(pathOrUri).toString();
  }
  const root = workspaceService?.tryGetRoots()[0];
  if (!root) {
    return URI.file(pathOrUri).toString();
  }
  const rootPath = URI.parse(root.uri).codeUri.fsPath;
  return URI.file(`${rootPath}/${pathOrUri}`.replace(/\/+/g, '/')).toString();
}

export function createDiagnosticsGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'diagnostics',
    description: 'IDE diagnostics and problem navigation',
    defaultLoaded: true,
    tools: [
      {
        name: 'diagnostics_list',
        description:
          'List current IDE diagnostics. Use this after edits or validation commands to inspect errors and warnings.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'Optional file path or file URI to filter diagnostics.',
            },
            severity: {
              type: 'string',
              enum: ['all', 'error', 'warning', 'info', 'hint'],
              description: 'Optional severity filter. Defaults to all.',
            },
            maxResults: {
              type: 'number',
              description: 'Maximum diagnostics to return. Defaults to 100, capped at 500.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const markerService = tryGetService<IMarkerService>(container, IMarkerService);
          if (!markerService) {
            return serviceUnavailableResult('IMarkerService');
          }
          const workspaceService = tryGetService<IWorkspaceService>(container, IWorkspaceService);
          try {
            const maxResults = toPositiveCappedNumber(
              params.maxResults,
              DEFAULT_DIAGNOSTIC_RESULTS,
              MAX_DIAGNOSTIC_RESULTS,
            );
            const resource =
              typeof params.path === 'string' && params.path
                ? resolveResourceUri(workspaceService, params.path)
                : undefined;
            const markers = markerService.getManager().getMarkers({
              resource,
              severities: severityMask(params.severity),
              take: maxResults,
            });
            const diagnostics = markers.map((marker) => ({
              type: marker.type,
              uri: marker.resource,
              path: URI.parse(marker.resource).codeUri.fsPath,
              severity: severityName(marker.severity),
              message: marker.message,
              source: marker.source,
              code: marker.code,
              startLine: marker.startLineNumber,
              startColumn: marker.startColumn,
              endLine: marker.endLineNumber,
              endColumn: marker.endColumn,
            }));
            return successResult({
              diagnostics,
              stats: markerService.getManager().getStats(),
              total: diagnostics.length,
              truncated: markers.length >= maxResults,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'diagnostics_getStats',
        description: 'Get diagnostic counts by severity for the current workspace.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const markerService = tryGetService<IMarkerService>(container, IMarkerService);
          if (!markerService) {
            return serviceUnavailableResult('IMarkerService');
          }
          try {
            return successResult(markerService.getManager().getStats());
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        name: 'diagnostics_open',
        description: 'Open a file and reveal the given diagnostic location.',
        riskLevel: 'ui',
        inputSchema: {
          type: 'object',
          properties: {
            path: {
              type: 'string',
              description: 'File path or file URI to open.',
            },
            line: {
              type: 'number',
              description: 'Line number to reveal, 1-based.',
            },
            column: {
              type: 'number',
              description: 'Column number to reveal, 1-based. Defaults to 1.',
            },
          },
          required: ['path', 'line'],
        },
        execute: async (params: Record<string, unknown>) => {
          const path = typeof params.path === 'string' ? params.path : '';
          const line = Number(params.line);
          if (!path || !line || line < 1) {
            return errorResult('INVALID_INPUT', new Error('path and positive line are required'));
          }
          const workspaceService = tryGetService<IWorkspaceService>(container, IWorkspaceService);
          const editorService = tryGetService<WorkbenchEditorService>(container, WorkbenchEditorService);
          if (!editorService) {
            return serviceUnavailableResult('WorkbenchEditorService');
          }
          try {
            const uri = URI.parse(resolveResourceUri(workspaceService, path));
            const column = Math.max(Number(params.column) || 1, 1);
            await editorService.open(uri, {
              range: {
                startLineNumber: line,
                startColumn: column,
                endLineNumber: line,
                endColumn: column,
              },
              revealRangeInCenter: true,
            });
            return successResult({ path: uri.codeUri.fsPath, line, column, opened: true });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
