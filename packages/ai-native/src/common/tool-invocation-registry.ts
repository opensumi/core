import { ToolExecutionOptions } from 'ai';
import { z } from 'zod';

import { Injectable } from '@opensumi/di';

export const ToolParameterSchema = z.object({
  type: z.enum(['string', 'number', 'boolean', 'object', 'array']),
  description: z.string().optional(),
  enum: z.array(z.any()).optional(),
  items: z.lazy(() => ToolParameterSchema).optional(),
  properties: z.record(z.lazy(() => ToolParameterSchema)).optional(),
  required: z.array(z.string()).optional(),
});

export type ToolParameter = z.infer<typeof ToolParameterSchema>;

export interface ToolRequest {
  id: string;
  name: string;
  parameters?: any;
  description?: string;
  handler: (arg_string: string, options?: ToolExecutionOptions) => Promise<any>;
  providerName?: string;
}

export namespace ToolRequest {
  export function isToolParameter(obj: unknown): obj is ToolParameter {
    return ToolParameterSchema.safeParse(obj).success;
  }
}

export const ToolInvocationRegistry = Symbol('ToolInvocationRegistry');

/**
 * 为 Agent 提供的所有可用函数调用的注册表
 */
export interface ToolInvocationRegistry {
  /**
   * 在注册表中注册一个工具
   *
   * @param tool - 要注册的 `ToolRequest` 对象
   */
  registerTool(tool: ToolRequest): void;

  /**
   * 从注册表中获取特定的 `ToolRequest`
   *
   * @param toolId - 要获取的工具的唯一标识符
   * @returns 对应提供的工具 ID 的 `ToolRequest` 对象，
   *          如果在注册表中找不到该工具，则返回 `undefined`
   */
  getFunction(toolId: string): ToolRequest | undefined;

  /**
   * 从注册表中获取多个 `ToolRequest`
   *
   * @param toolIds - 要获取的工具 ID 列表
   * @returns 指定工具 ID 的 `ToolRequest` 对象数组
   *          如果找不到某个工具 ID，将在返回的数组中跳过该工具
   */
  getFunctions(...toolIds: string[]): ToolRequest[];

  /**
   * 获取当前注册表中的所有 `ToolRequest`
   *
   * @returns 注册表中所有 `ToolRequest` 对象的数组
   */
  getAllFunctions(): ToolRequest[];

  /**
   * 注销特定工具提供者的所有工具
   *
   * @param providerName - 要移除其工具的工具提供者名称（在 `ToolRequest` 中指定）
   */
  unregisterProviderTools(providerName: string): void;
}

export const ToolProvider = Symbol('ToolProvider');
export interface ToolProvider {
  getTool(): ToolRequest;
}

export class ToolInvocationRegistryImpl implements ToolInvocationRegistry {
  private tools: Map<string, ToolRequest> = new Map<string, ToolRequest>();

  unregisterProviderTools(providerName: string): void {
    const toolsToRemove: string[] = [];
    for (const [id, tool] of this.tools.entries()) {
      if (tool.providerName === providerName) {
        toolsToRemove.push(id);
      }
    }
    toolsToRemove.forEach((id) => this.tools.delete(id));
  }

  getAllFunctions(): ToolRequest[] {
    return Array.from(this.tools.values());
  }

  registerTool(tool: ToolRequest): void {
    if (this.tools.has(tool.id)) {
      // TODO: 使用适当的日志机制
      this.tools.set(tool.id, tool);
    } else {
      this.tools.set(tool.id, tool);
    }
  }

  getFunction(toolId: string): ToolRequest | undefined {
    return this.tools.get(toolId);
  }

  getFunctions(...toolIds: string[]): ToolRequest[] {
    const tools: ToolRequest[] = toolIds.map((toolId) => {
      const tool = this.tools.get(toolId);
      if (tool) {
        return tool;
      } else {
        throw new Error(`找不到 ID 为 ${toolId} 的函数`);
      }
    });
    return tools;
  }
}

/**
 * 管理多个 ToolInvocationRegistry 实例的管理器，每个实例与一个 clientId 关联
 */
export interface IToolInvocationRegistryManager {
  /**
   * 获取或创建特定 clientId 的 ToolInvocationRegistry
   */
  getRegistry(clientId: string): ToolInvocationRegistry;

  /**
   * 移除特定 clientId 的 ToolInvocationRegistry
   */
  removeRegistry(clientId: string): void;

  /**
   * 检查特定 clientId 是否存在对应的注册表
   */
  hasRegistry(clientId: string): boolean;
}

export const ToolInvocationRegistryManager = Symbol('ToolInvocationRegistryManager');

@Injectable()
export class ToolInvocationRegistryManagerImpl implements IToolInvocationRegistryManager {
  private registries: Map<string, ToolInvocationRegistry> = new Map();

  getRegistry(clientId: string): ToolInvocationRegistry {
    let registry = this.registries.get(clientId);
    if (!registry) {
      registry = new ToolInvocationRegistryImpl();
      this.registries.set(clientId, registry);
    }
    return registry;
  }

  removeRegistry(clientId: string): void {
    this.registries.delete(clientId);
  }

  hasRegistry(clientId: string): boolean {
    return this.registries.has(clientId);
  }
}
