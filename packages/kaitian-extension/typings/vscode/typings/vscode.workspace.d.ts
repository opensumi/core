

declare module 'vscode' {

  export namespace workspace {

    /**
     * Find files across all [workspace folders](#workspace.workspaceFolders) in the workspace.
     *
     * @sample `findFiles('**​/*.js', '**​/node_modules/**', 10)`
     * @param include A [glob pattern](#GlobPattern) that defines the files to search for. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace. Use a [relative pattern](#RelativePattern)
     * to restrict the search results to a [workspace folder](#WorkspaceFolder).
     * @param exclude  A [glob pattern](#GlobPattern) that defines files and folders to exclude. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace. When `undefined` only default excludes will
     * apply, when `null` no excludes will apply.
     * @param maxResults An upper-bound for the result.
     * @param token A token that can be used to signal cancellation to the underlying search engine.
     * @return A thenable that resolves to an array of resource identifiers. Will return no results if no
     * [workspace folders](#workspace.workspaceFolders) are opened.
     * @墨蜇
     */
    export function findFiles(include: GlobPattern, exclude?: GlobPattern | null, maxResults?: number, token?: CancellationToken): Thenable<Uri[]>;


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
  
    /**
		 * Save all dirty files.
		 *
		 * @param includeUntitled Also save files that have been created during this session.
		 * @return A thenable that resolves when the files have been saved.
		 */
		export function saveAll(includeUntitled?: boolean): Thenable<boolean>;
  }

}
