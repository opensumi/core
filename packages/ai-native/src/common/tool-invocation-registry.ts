import { Injectable } from '@opensumi/di';

export type ToolRequestParametersProperties = Record<string, { type: string, [key: string]: unknown }>;
export interface ToolRequestParameters {
    type?: 'object';
    properties: ToolRequestParametersProperties
}
export interface ToolRequest {
    id: string;
    name: string;
    parameters?: ToolRequestParameters
    description?: string;
    handler: (arg_string: string) => Promise<unknown>;
    providerName?: string;
}

export namespace ToolRequest {
    export function isToolRequestParametersProperties(obj: unknown): obj is ToolRequestParametersProperties {
        if (!obj || typeof obj !== 'object') { return false; };

        return Object.entries(obj).every(([key, value]) =>
            typeof key === 'string' &&
            value &&
            typeof value === 'object' &&
            'type' in value &&
            typeof value.type === 'string' &&
            Object.keys(value).every(k => typeof k === 'string')
        );
    }
    export function isToolRequestParameters(obj: unknown): obj is ToolRequestParameters {
        return !!obj && typeof obj === 'object' &&
            (!('type' in obj) || obj.type === 'object') &&
            'properties' in obj && isToolRequestParametersProperties(obj.properties);
    }
}


export const ToolInvocationRegistry = Symbol('ToolInvocationRegistry');

/**
 * Registry for all the function calls available to Agents.
 */
export interface ToolInvocationRegistry {
    /**
     * Registers a tool into the registry.
     *
     * @param tool - The `ToolRequest` object representing the tool to be registered.
     */
    registerTool(tool: ToolRequest): void;

    /**
     * Retrieves a specific `ToolRequest` from the registry.
     *
     * @param toolId - The unique identifier of the tool to retrieve.
     * @returns The `ToolRequest` object corresponding to the provided tool ID,
     *          or `undefined` if the tool is not found in the registry.
     */
    getFunction(toolId: string): ToolRequest | undefined;

    /**
     * Retrieves multiple `ToolRequest`s from the registry.
     *
     * @param toolIds - A list of tool IDs to retrieve.
     * @returns An array of `ToolRequest` objects for the specified tool IDs.
     *          If a tool ID is not found, it is skipped in the returned array.
     */
    getFunctions(...toolIds: string[]): ToolRequest[];

    /**
     * Retrieves all `ToolRequest`s currently registered in the registry.
     *
     * @returns An array of all `ToolRequest` objects in the registry.
     */
    getAllFunctions(): ToolRequest[];

    /**
     * Unregisters all tools provided by a specific tool provider.
     *
     * @param providerName - The name of the tool provider whose tools should be removed (as specificed in the `ToolRequest`).
     */
    unregisterAllTools(providerName: string): void;
}

export const ToolProvider = Symbol('ToolProvider');
export interface ToolProvider {
    getTool(): ToolRequest;
}

@Injectable()
export class ToolInvocationRegistryImpl implements ToolInvocationRegistry {

    private tools: Map<string, ToolRequest> = new Map<string, ToolRequest>();

    unregisterAllTools(providerName: string): void {
        const toolsToRemove: string[] = [];
        for (const [id, tool] of this.tools.entries()) {
            if (tool.providerName === providerName) {
                toolsToRemove.push(id);
            }
        }
        toolsToRemove.forEach(id => this.tools.delete(id));
    }
    getAllFunctions(): ToolRequest[] {
        return Array.from(this.tools.values());
    }

    registerTool(tool: ToolRequest): void {
        if (this.tools.has(tool.id)) {
            console.warn(`Function with id ${tool.id} is already registered.`);
        } else {
            this.tools.set(tool.id, tool);
        }
    }

    getFunction(toolId: string): ToolRequest | undefined {
        return this.tools.get(toolId);
    }

    getFunctions(...toolIds: string[]): ToolRequest[] {
        const tools: ToolRequest[] = toolIds.map(toolId => {
            const tool = this.tools.get(toolId);
            if (tool) {
                return tool;
            } else {
                throw new Error(`Function with id ${toolId} does not exist.`);
            }
        });
        return tools;
    }
}

