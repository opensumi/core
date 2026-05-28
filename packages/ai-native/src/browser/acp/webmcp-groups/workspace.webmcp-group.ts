/**
 * WebMCP group definition for workspace-level IDE context.
 */
import { Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { WorkbenchEditorService } from '@opensumi/ide-editor';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { WebMcpGroupRegistration } from '../webmcp-group-registry';
import { classifyError, errorResult, serviceUnavailableResult, successResult, tryGetService } from '../webmcp-utils';

function toFsPath(uri: string): string {
  return URI.parse(uri).codeUri.fsPath;
}

export function createWorkspaceGroup(container: Injector): WebMcpGroupRegistration {
  return {
    name: 'workspace',
    description: 'Workspace context and open editor state',
    defaultLoaded: true,
    tools: [
      {
        method: '_opensumi/workspace/getInfo',
        description:
          'Get workspace metadata, including root folders, workspace name, multi-root state, and the configured workspace directory.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {},
        },
        execute: async () => {
          const workspaceService = tryGetService<IWorkspaceService>(container, IWorkspaceService);
          if (!workspaceService) {
            return serviceUnavailableResult('IWorkspaceService');
          }
          const appConfig = tryGetService<AppConfig>(container, AppConfig);
          try {
            await workspaceService.whenReady;
            const roots = workspaceService.tryGetRoots().map((root) => ({
              uri: root.uri,
              path: toFsPath(root.uri),
              name: workspaceService.getWorkspaceName(URI.parse(root.uri)),
            }));
            return successResult({
              workspaceDir: appConfig?.workspaceDir ?? null,
              roots,
              rootCount: roots.length,
              isMultiRootWorkspaceOpened: workspaceService.isMultiRootWorkspaceOpened,
              isMultiRootWorkspaceEnabled: workspaceService.isMultiRootWorkspaceEnabled,
            });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/workspace/listOpenFiles',
        description:
          'List files currently opened in editor groups. Use this to understand the user visible editing context.',
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
            const activeUri = editorService.currentEditor?.currentUri?.toString();
            const files = editorService.editorGroups.flatMap((group, groupIndex) =>
              group.resources.map((resource) => ({
                uri: resource.uri.toString(),
                path: resource.uri.codeUri.fsPath,
                name: resource.name,
                groupIndex,
                active: resource.uri.toString() === activeUri,
              })),
            );
            return successResult({ files, total: files.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
      {
        method: '_opensumi/workspace/listRecentWorkspaces',
        description: 'List recently used workspaces known to the IDE.',
        riskLevel: 'read',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Maximum number of recent workspaces to return. Defaults to 10, capped at 50.',
            },
          },
        },
        execute: async (params: Record<string, unknown>) => {
          const workspaceService = tryGetService<IWorkspaceService>(container, IWorkspaceService);
          if (!workspaceService) {
            return serviceUnavailableResult('IWorkspaceService');
          }
          try {
            const maxResults = Math.min(Math.max(Number(params.maxResults) || 10, 1), 50);
            const workspaces = await workspaceService.getMostRecentlyUsedWorkspaces();
            return successResult({ workspaces: workspaces.slice(0, maxResults), total: workspaces.length });
          } catch (err) {
            return errorResult(classifyError(err), err);
          }
        },
      },
    ],
  };
}
