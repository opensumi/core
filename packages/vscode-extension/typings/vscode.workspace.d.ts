

declare module 'vscode' {

  export namespace workspace {



    /**
     * The location of the workspace file, for example:
     *
     * `file:///Users/name/Development/myProject.code-workspace`
     *
     * or
     *
     * `untitled:1555503116870`
     *
     * for a workspace that is untitled and not yet saved.
     *
     * Depending on the workspace that is opened, the value will be:
     *  * `undefined` when no workspace or  a single folder is opened
     *  * the path of the workspace file as `Uri` otherwise. if the workspace
     * is untitled, the returned URI will use the `untitled:` scheme
     *
     * The location can e.g. be used with the `vscode.openFolder` command to
     * open the workspace again after it has been closed.
     *
     * **Example:**
     * ```typescript
     * vscode.commands.executeCommand('vscode.openFolder', uriOfWorkspace);
     * ```
     *
     * **Note:** it is not advised to use `workspace.workspaceFile` to write
     * configuration data into the file. You can use `workspace.getConfiguration().update()`
     * for that purpose which will work both when a single folder is opened as
     * well as an untitled or saved workspace.
     */
    export const workspaceFile: Uri | undefined;

    /**
     * An event that is emitted when a workspace folder is added or removed.
     */
    export const onDidChangeWorkspaceFolders: Event<WorkspaceFoldersChangeEvent>;

    /**
     * Returns the [workspace folder](#WorkspaceFolder) that contains a given uri.
     * * returns `undefined` when the given uri doesn't match any workspace folder
     * * returns the *input* when the given uri is a workspace folder itself
     *
     * @param uri An uri.
     * @return A workspace folder or `undefined`
     * @墨蜇
     */
    export function getWorkspaceFolder(uri: Uri): WorkspaceFolder | undefined;


    /**
     * ~~The folder that is open in the editor. `undefined` when no folder
     * has been opened.~~
     *
     * @deprecated Use [`workspaceFolders`](#workspace.workspaceFolders) instead.
     */
    export const rootPath: string | undefined;

    /**
     * List of workspace folders or `undefined` when no folder is open.
     * *Note* that the first entry corresponds to the value of `rootPath`.
     */
    export const workspaceFolders: WorkspaceFolder[] | undefined;

  }

}
