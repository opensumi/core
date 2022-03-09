import { Injectable } from '@opensumi/di';
import { Emitter, URI, Deferred } from '@opensumi/ide-core-common';
import { FileStat } from '@opensumi/ide-file-service';

import { IWorkspaceService } from '../../common';

@Injectable()
export class MockWorkspaceService implements IWorkspaceService {
  private _roots: FileStat[] = [];

  private _workspace: FileStat | undefined;

  isMultiRootWorkspaceOpened = false;

  whenReady: Promise<void>;

  private deferredRoots = new Deferred<FileStat[]>();

  constructor() {
    this.whenReady = this.init();
  }

  async init() {
    await this.setWorkspace();
  }

  async initFileServiceExclude() {
    // do nothing
  }

  async setWorkspace(workspaceStat?: FileStat | undefined) {
    await this.updateWorkspace(workspaceStat);
  }

  async updateWorkspace(workspaceStat?: FileStat | undefined) {
    await this.updateRoots(workspaceStat);
    this._onWorkspaceChanged.fire(this._roots);
  }

  containsSome(paths: string[]): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  get roots(): Promise<FileStat[]> {
    return this.deferredRoots.promise;
  }

  get workspace(): FileStat | undefined {
    return this._workspace;
  }

  tryGetRoots(): FileStat[] {
    return this._roots;
  }

  protected async updateRoots(workspaceStat?: FileStat | undefined): Promise<void> {
    const root: FileStat = workspaceStat || {
      isDirectory: true,
      uri: 'file://userhome/',
      lastModification: 0,
    };
    this._workspace = root;
    this._roots = [root];
    this.deferredRoots = new Deferred<FileStat[]>();
    this.deferredRoots.resolve(this._roots);
    this._onWorkspaceChanged.fire(this._roots);
  }

  _onWorkspaceChanged: Emitter<FileStat[]> = new Emitter();
  onWorkspaceChanged = this._onWorkspaceChanged.event;

  _onWorkspaceLocationChanged: Emitter<FileStat | undefined> = new Emitter();
  onWorkspaceLocationChanged = this._onWorkspaceLocationChanged.event;

  _onWorkspaceFileExcludeChangeEmitter: Emitter<void> = new Emitter();
  onWorkspaceFileExcludeChanged = this._onWorkspaceFileExcludeChangeEmitter.event;

  async setMostRecentlyUsedWorkspace(): Promise<void> {
    return;
  }
  getMostRecentlyUsedWorkspace(): Promise<string> {
    throw new Error('Method not implemented.');
  }
  getMostRecentlyUsedWorkspaces(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  getMostRecentlyUsedCommands(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  setMostRecentlyUsedCommand(commandId: string): Promise<void> {
    throw new Error('Method not implemented.');
  }
  async setMostRecentlyOpenedFile(uri: string): Promise<void> {
    return;
  }
  getMostRecentlyOpenedFiles(): Promise<string[] | undefined> {
    throw new Error('Method not implemented.');
  }
  setMostRecentlySearchWord(word: string | string[]): Promise<void> {
    throw new Error('Method not implemented.');
  }
  getMostRecentlySearchWord(): Promise<string[] | undefined> {
    throw new Error('Method not implemented.');
  }
  async removeRoots(uri: URI[]) {
    return;
  }
  async spliceRoots(
    start: number,
    deleteCount?: number | undefined,
    workspaceName?: { [key: string]: string },
    ...rootsToAdd: URI[]
  ): Promise<URI[]> {
    this._roots = rootsToAdd.map((root) => ({ isDirectory: true, uri: root.toString(), lastModification: 0 }));
    this.deferredRoots = new Deferred();
    this.deferredRoots.resolve(this._roots);
    return rootsToAdd;
  }
  asRelativePath(pathOrUri: string | URI, includeWorkspaceFolder?: boolean | undefined): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }
  getWorkspaceRootUri(uri: URI | undefined): URI | undefined {
    return new URI(this._roots[0].uri);
  }
  getWorkspaceName(uri: URI): string {
    return '';
  }
  isMultiRootWorkspaceEnabled: boolean;
}
