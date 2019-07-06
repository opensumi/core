
import { Injectable, Inject, Autowired } from '@ali/common-di';
import { workspaceServerPath } from '../common';
import { ClientAppContribution, Deferred, IDisposable, Disposable, URI, Emitter, Event } from '@ali/ide-core-browser';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileServiceWatcherClient } from '@ali/ide-file-service/lib/browser/file-service-watcher-client';
import { FileStat } from '@ali/ide-file-service';

@Injectable()
export class WorkspaceService implements ClientAppContribution {

  private _workspace: FileStat | undefined;

  private _roots: FileStat[] = [];
  private deferredRoots = new Deferred<FileStat[]>();

  @Autowired(workspaceServerPath)
  protected readonly workspaceServer;

  @Autowired()
  protected readonly fileSystem: FileServiceClient;

  @Autowired()
  protected readonly watcher: FileServiceWatcherClient;

}
