export interface IFileService {

	/**
	 * An event that is fired when a file system provider is added or removed
	 */
  readonly onDidChangeFileSystemProviderRegistrations: Event<IFileSystemProviderRegistrationEvent>;

	/**
	 * An event that is fired when a file system provider is about to be activated. Listeners
	 * can join this event with a long running promise to help in the activation process.
	 */
  readonly onWillActivateFileSystemProvider: Event<IFileSystemProviderActivationEvent>;

	/**
	 * Registers a file system provider for a certain scheme.
	 */
  registerProvider(scheme: string, provider: IFileSystemProvider): IDisposable;

	/**
	 * Tries to activate a provider with the given scheme.
	 */
  activateProvider(scheme: string): Promise<void>;

	/**
	 * Checks if this file service can handle the given resource.
	 */
  canHandleResource(resource: URI): boolean;

	/**
	 * Checks if the provider for the provided resource has the provided file system capability.
	 */
  hasCapability(resource: URI, capability: FileSystemProviderCapabilities): boolean;

	/**
	 * Allows to listen for file changes. The event will fire for every file within the opened workspace
	 * (if any) as well as all files that have been watched explicitly using the #watch() API.
	 */
  readonly onFileChanges: Event<FileChangesEvent>;

	/**
	 * An event that is fired upon successful completion of a certain file operation.
	 */
  readonly onAfterOperation: Event<FileOperationEvent>;

	/**
	 * Resolve the properties of a file/folder identified by the resource.
	 *
	 * If the optional parameter "resolveTo" is specified in options, the stat service is asked
	 * to provide a stat object that should contain the full graph of folders up to all of the
	 * target resources.
	 *
	 * If the optional parameter "resolveSingleChildDescendants" is specified in options,
	 * the stat service is asked to automatically resolve child folders that only
	 * contain a single element.
	 *
	 * If the optional parameter "resolveMetadata" is specified in options,
	 * the stat will contain metadata information such as size, mtime and etag.
	 */
  resolve(resource: URI, options: IResolveMetadataFileOptions): Promise<IFileStatWithMetadata>;
  resolve(resource: URI, options?: IResolveFileOptions): Promise<IFileStat>;

	/**
	 * Same as resolve() but supports resolving multiple resources in parallel.
	 * If one of the resolve targets fails to resolve returns a fake IFileStat instead of making the whole call fail.
	 */
  resolveAll(toResolve: { resource: URI, options: IResolveMetadataFileOptions }[]): Promise<IResolveFileResult[]>;
  resolveAll(toResolve: { resource: URI, options?: IResolveFileOptions }[]): Promise<IResolveFileResult[]>;

	/**
	 * Finds out if a file/folder identified by the resource exists.
	 */
  exists(resource: URI): Promise<boolean>;

	/**
	 * Read the contents of the provided resource unbuffered.
	 */
  readFile(resource: URI, options?: IReadFileOptions): Promise<IFileContent>;

	/**
	 * Read the contents of the provided resource buffered as stream.
	 */
  readFileStream(resource: URI, options?: IReadFileOptions): Promise<IFileStreamContent>;

	/**
	 * Updates the content replacing its previous value.
	 */
  writeFile(resource: URI, bufferOrReadable: VSBuffer | VSBufferReadable, options?: IWriteFileOptions): Promise<IFileStatWithMetadata>;

	/**
	 * Moves the file/folder to a new path identified by the resource.
	 *
	 * The optional parameter overwrite can be set to replace an existing file at the location.
	 */
  move(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;

	/**
	 * Copies the file/folder to a path identified by the resource.
	 *
	 * The optional parameter overwrite can be set to replace an existing file at the location.
	 */
  copy(source: URI, target: URI, overwrite?: boolean): Promise<IFileStatWithMetadata>;

	/**
	 * Creates a new file with the given path and optional contents. The returned promise
	 * will have the stat model object as a result.
	 *
	 * The optional parameter content can be used as value to fill into the new file.
	 */
  createFile(resource: URI, bufferOrReadable?: VSBuffer | VSBufferReadable, options?: ICreateFileOptions): Promise<IFileStatWithMetadata>;

	/**
	 * Creates a new folder with the given path. The returned promise
	 * will have the stat model object as a result.
	 */
  createFolder(resource: URI): Promise<IFileStatWithMetadata>;

	/**
	 * Deletes the provided file. The optional useTrash parameter allows to
	 * move the file to trash. The optional recursive parameter allows to delete
	 * non-empty folders recursively.
	 */
  del(resource: URI, options?: { useTrash?: boolean, recursive?: boolean }): Promise<void>;

	/**
	 * Allows to start a watcher that reports file/folder change events on the provided resource.
	 *
	 * Note: watching a folder does not report events recursively for child folders yet.
	 */
  watch(resource: URI): IDisposable;

	/**
	 * Frees up any resources occupied by this service.
	 */
  dispose(): void;
}
