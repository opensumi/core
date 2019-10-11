import { FileStat } from '@ali/ide-file-service';
import { Emitter, Command, URI } from '@ali/ide-core-common';
import { Injectable } from '@ali/common-di';
import { IWorkspaceService } from '../../common';

@Injectable()
export class MockedWorkspaceService implements IWorkspaceService {

  roots: Promise<FileStat[]>;

  workspace: FileStat | undefined;

  isMultiRootWorkspaceOpened: boolean;

  whenReady: Promise<void>;

  containsSome(paths: string[]): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  tryGetRoots(): FileStat[] {
    throw new Error('Method not implemented.');
  }

  _onWorkspaceChanged: Emitter<FileStat[]> = new Emitter();
  onWorkspaceChanged = this._onWorkspaceChanged.event;

  _onWorkspaceLocationChanged: Emitter<FileStat | undefined> = new Emitter();
  onWorkspaceLocationChanged =  this._onWorkspaceLocationChanged.event;

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
