import { FileStat } from '@ali/ide-file-service';
import { Emitter, Command, URI, Deferred } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { IWorkspaceService } from '../../common';

@Injectable()
export class MockWorkspaceService implements IWorkspaceService {

  private _roots: FileStat[] = [];

  private _workspace: FileStat | undefined;

  isMultiRootWorkspaceOpened: boolean;

  whenReady: Promise<void>;

  private deferredRoots = new Deferred<FileStat[]>();

  constructor() {
    this.whenReady = this.init();
  }

  async init() {
    await this.setWorkspace();
  }

  async setWorkspace(workspaceStat?: FileStat | undefined) {
    await this.updateWorkspace(workspaceStat);
  }

  async updateWorkspace(workspaceStat?: FileStat | undefined) {
    await this.updateRoots(workspaceStat);
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
      uri: 'file://userhome',
      lastModification: 0,
    };
    this._workspace = root;
    this._roots = [root];
    this.deferredRoots = new Deferred<FileStat[]>();
    this.deferredRoots.resolve(this._roots);
  }

  _onWorkspaceChanged: Emitter<FileStat[]> = new Emitter();
  onWorkspaceChanged = this._onWorkspaceChanged.event;

  _onWorkspaceLocationChanged: Emitter<FileStat | undefined> = new Emitter();
  onWorkspaceLocationChanged = this._onWorkspaceLocationChanged.event;

  async setMostRecentlyUsedWorkspace(): Promise<void> {
    return;
  }
  recentWorkspaces(): Promise<string[]> {
    throw new Error('Method not implemented.');
  }
  recentCommands(): Promise<Command[]> {
    throw new Error('Method not implemented.');
  }
  setRecentCommand(command: Command): Promise<void> {
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
  spliceRoots(start: number, deleteCount?: number | undefined, ...rootsToAdd: URI[]): Promise<URI[]> {
    throw new Error('Method not implemented.');
  }
  asRelativePath(pathOrUri: string | URI, includeWorkspaceFolder?: boolean | undefined): Promise<string | undefined> {
    throw new Error('Method not implemented.');
  }
  getWorkspaceRootUri(uri: URI | undefined): URI | undefined {
    throw new Error('Method not implemented.');
  }
  isMultiRootWorkspaceEnabled: boolean;

}
