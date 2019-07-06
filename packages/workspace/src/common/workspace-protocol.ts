export const workspaceServerPath = '/services/workspace';

export const WorkspaceServer = Symbol('WorkspaceServer');
/**
 * JSON-RPC workspace 接口.
 */
export interface WorkspaceServer {

    /**
     * 返回最近打开的工作区，仅一个
     * @returns {(Promise<string | undefined>)}
     * @memberof WorkspaceServer
     */
    getMostRecentlyUsedWorkspace(): Promise<string | undefined>;

    /**
     * 设置最近打开的工作区
     * @param {string} uri
     * @returns {Promise<void>}
     * @memberof WorkspaceServer
     */
    setMostRecentlyUsedWorkspace(uri: string): Promise<void>;

    /**
     * 返回最近打开的工作区列表
     * @returns {Promise<string[]>}
     * @memberof WorkspaceServer
     */
    getRecentWorkspaces(): Promise<string[]>;
}
