import { Injectable, Autowired } from '@ali/common-di';
import { DisposableStore, URI } from '@ali/ide-core-common';
import { IFileServiceClient, FileChangeType } from '@ali/ide-file-service';
import { IWorkspaceFileService } from '@ali/ide-workspace-edit';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtHostFileSystemEvent, FileSystemEvents } from '../../../common/vscode/file-system';
import { ExtHostAPIIdentifier } from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadFileSystemEvent {
  @Autowired(IFileServiceClient)
  fileService: IFileServiceClient;

  @Autowired(IWorkspaceFileService)
  workspaceFileService: IWorkspaceFileService;

  private readonly _listener = new DisposableStore();

  constructor(
    private readonly rpcProtocol: IRPCProtocol,
  ) {

    const proxy = this.rpcProtocol.getProxy<IExtHostFileSystemEvent>(ExtHostAPIIdentifier.ExtHostFileSystemEvent);

    // file system events - (changes the editor and other make)
    const events: FileSystemEvents = {
      created: [],
      changed: [],
      deleted: [],
    };
    this._listener.add(this.fileService.onFilesChanged((changes) => {
      let hasResult = false;
      for (const change of changes) {
        switch (change.type) {
          case FileChangeType.ADDED:
            events.created.push(new URI(change.uri).codeUri);
            hasResult = true;
            break;
          case FileChangeType.UPDATED:
            events.changed.push(new URI(change.uri).codeUri);
            hasResult = true;
            break;
          case FileChangeType.DELETED:
            events.deleted.push(new URI(change.uri).codeUri);
            hasResult = true;
            break;
        }
      }

      if (hasResult) {
        proxy.$onFileEvent(events);
        events.created = [];
        events.changed = [];
        events.deleted = [];
      }
    }));

    // BEFORE file operation
    this.workspaceFileService.registerFileOperationParticipant({
      participate: (files, operation, progress, timeout, token) => {
        return proxy.$onWillRunFileOperation(operation, files, timeout, token);
      },
    });

    // AFTER file operation
    this._listener.add(this.workspaceFileService.onDidRunWorkspaceFileOperation((e) => proxy.$onDidRunFileOperation(e.operation, e.files)));
  }

  dispose(): void {
    this._listener.dispose();
  }
}
