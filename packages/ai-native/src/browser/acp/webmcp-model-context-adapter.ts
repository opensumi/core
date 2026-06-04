import { ensureModelContext } from '@opensumi/ide-core-browser/lib/webmcp-polyfill';

import { canExposeWebMcpTool } from '../../common/webmcp-policy';

import type { WebMcpGroupDefinitionOptions, WebMcpGroupRegistry } from './webmcp-group-registry';
import type { WebMCPTool } from '@opensumi/ide-core-browser/lib/webmcp-types';
import type { IDisposable } from '@opensumi/ide-core-common';

export interface WebMcpModelContextAdapterOptions extends WebMcpGroupDefinitionOptions {
  defaultLoadedOnly?: boolean;
}

export interface WebMcpModelContextToolDefinition extends Omit<WebMCPTool, 'execute'> {
  group: string;
}

export function getWebMcpModelContextToolDefinitions(
  registry: WebMcpGroupRegistry,
  options?: WebMcpModelContextAdapterOptions,
): WebMcpModelContextToolDefinition[] {
  const { defaultLoadedOnly = true, includeAllTools = false } = options ?? {};

  const definitions = registry
    .getGroupDefinitions({ ...options, includeAllTools })
    .filter((group) => !defaultLoadedOnly || group.defaultLoaded)
    .flatMap((group) =>
      group.tools
        .filter((tool) => canExposeWebMcpTool(tool, group.profile ?? 'default'))
        .map((tool) => ({
          group: group.name,
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema as WebMCPTool['inputSchema'],
        })),
    );

  const seen = new Set<string>();
  return definitions.filter((definition) => {
    if (seen.has(definition.name)) {
      return false;
    }
    seen.add(definition.name);
    return true;
  });
}

export function registerWebMcpModelContextTools(
  registry: WebMcpGroupRegistry,
  options?: WebMcpModelContextAdapterOptions,
): IDisposable {
  ensureModelContext();

  const registeredToolNames = new Set(navigator.modelContext!.getTools?.().map((tool) => tool.name) ?? []);
  const disposables = getWebMcpModelContextToolDefinitions(registry, options)
    .filter((definition) => {
      if (registeredToolNames.has(definition.name)) {
        return false;
      }
      registeredToolNames.add(definition.name);
      return true;
    })
    .map((definition) =>
      navigator.modelContext!.registerTool({
        name: definition.name,
        description: definition.description,
        inputSchema: definition.inputSchema,
        execute: (args: Record<string, unknown>) => registry.executeTool(definition.group, definition.name, args ?? {}),
      }),
    );

  return {
    dispose: () => {
      disposables.forEach((disposable) => disposable.dispose());
    },
  };
}
