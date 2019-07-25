/**
 * API OWNER
 */

declare module 'vscode' {

  export namespace workspace {

    /**
     * The name of the workspace. `undefined` when no folder
     * has been opened.
     * @魁梧
     */
    export const name: string | undefined;

    /**
     * Returns a path that is relative to the workspace folder or folders.
     *
     * When there are no [workspace folders](#workspace.workspaceFolders) or when the path
     * is not contained in them, the input is returned.
     *
     * @param pathOrUri A path or uri. When a uri is given its [fsPath](#Uri.fsPath) is used.
     * @param includeWorkspaceFolder When `true` and when the given path is contained inside a
     * workspace folder the name of the workspace is prepended. Defaults to `true` when there are
     * multiple workspace folders and `false` otherwise.
     * @return A path relative to the root or the input.
     * @魁梧
     */
    export function asRelativePath(pathOrUri: string | Uri, includeWorkspaceFolder?: boolean): string;

    /**
     * This method replaces `deleteCount` [workspace folders](#workspace.workspaceFolders) starting at index `start`
     * by an optional set of `workspaceFoldersToAdd` on the `vscode.workspace.workspaceFolders` array. This "splice"
     * behavior can be used to add, remove and change workspace folders in a single operation.
     *
     * If the first workspace folder is added, removed or changed, the currently executing extensions (including the
     * one that called this method) will be terminated and restarted so that the (deprecated) `rootPath` property is
     * updated to point to the first workspace folder.
     *
     * Use the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) event to get notified when the
     * workspace folders have been updated.
     *
     * **Example:** adding a new workspace folder at the end of workspace folders
     * ```typescript
     * workspace.updateWorkspaceFolders(workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, { uri: ...});
     * ```
     *
     * **Example:** removing the first workspace folder
     * ```typescript
     * workspace.updateWorkspaceFolders(0, 1);
     * ```
     *
     * **Example:** replacing an existing workspace folder with a new one
     * ```typescript
     * workspace.updateWorkspaceFolders(0, 1, { uri: ...});
     * ```
     *
     * It is valid to remove an existing workspace folder and add it again with a different name
     * to rename that folder.
     *
     * **Note:** it is not valid to call [updateWorkspaceFolders()](#updateWorkspaceFolders) multiple times
     * without waiting for the [`onDidChangeWorkspaceFolders()`](#onDidChangeWorkspaceFolders) to fire.
     *
     * @param start the zero-based location in the list of currently opened [workspace folders](#WorkspaceFolder)
     * from which to start deleting workspace folders.
     * @param deleteCount the optional number of workspace folders to remove.
     * @param workspaceFoldersToAdd the optional variable set of workspace folders to add in place of the deleted ones.
     * Each workspace is identified with a mandatory URI and an optional name.
     * @return true if the operation was successfully started and false otherwise if arguments were used that would result
     * in invalid workspace folder state (e.g. 2 folders with the same URI).
     * @魁梧
     */
    export function updateWorkspaceFolders(start: number, deleteCount: number | undefined | null, ...workspaceFoldersToAdd: { uri: Uri, name?: string }[]): boolean;
  }

}
