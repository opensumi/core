/**
 * API OWNER 墨蛰
 */

declare module 'vscode' {

  export namespace workspace {
    /**
     * Creates a file system watcher.
     *
     * A glob pattern that filters the file events on their absolute path must be provided. Optionally,
     * flags to ignore certain kinds of events can be provided. To stop listening to events the watcher must be disposed.
     *
     * *Note* that only files within the current [workspace folders](#workspace.workspaceFolders) can be watched.
     *
     * @param globPattern A [glob pattern](#GlobPattern) that is applied to the absolute paths of created, changed,
     * and deleted files. Use a [relative pattern](#RelativePattern) to limit events to a certain [workspace folder](#WorkspaceFolder).
     * @param ignoreCreateEvents Ignore when files have been created.
     * @param ignoreChangeEvents Ignore when files have been changed.
     * @param ignoreDeleteEvents Ignore when files have been deleted.
     * @return A new file system watcher instance.
     * @墨蜇
     */
    export function createFileSystemWatcher(globPattern: GlobPattern, ignoreCreateEvents?: boolean, ignoreChangeEvents?: boolean, ignoreDeleteEvents?: boolean): FileSystemWatcher;

    /**
     * Register a filesystem provider for a given scheme, e.g. `ftp`.
     *
     * There can only be one provider per scheme and an error is being thrown when a scheme
     * has been claimed by another provider or when it is reserved.
     *
     * @param scheme The uri-[scheme](#Uri.scheme) the provider registers for.
     * @param provider The filesystem provider.
     * @param options Immutable metadata about the provider.
     * @return A [disposable](#Disposable) that unregisters this provider when being disposed.
     * @墨蛰
     */
    export function registerFileSystemProvider(scheme: string, provider: FileSystemProvider, options?: { isCaseSensitive?: boolean, isReadonly?: boolean }): Disposable;

  }

}
