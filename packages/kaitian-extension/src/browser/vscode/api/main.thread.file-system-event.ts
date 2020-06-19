import { Injectable, Autowired } from '@ali/common-di';
import { DisposableStore, URI } from '@ali/ide-core-common';
import { IFileServiceClient, FileChangeType } from '@ali/ide-file-service';
import { IRPCProtocol } from '@ali/ide-connection';
import { IExtHostFileSystemEvent, FileSystemEvents } from '../../../common/vscode/file-system';
import { ExtHostAPIIdentifier } from '../../../common/vscode';

@Injectable({ multiple: true })
export class MainThreadFileSystemEvent {
  @Autowired(IFileServiceClient)
  fileService: IFileServiceClient;

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
      for (const change of changes) {
        switch (change.type) {
          case FileChangeType.ADDED:
            events.created.push(new URI(change.uri).codeUri);
            break;
          case FileChangeType.UPDATED:
            events.changed.push(new URI(change.uri).codeUri);
            break;
          case FileChangeType.DELETED:
            events.deleted.push(new URI(change.uri).codeUri);
            break;
        }
      }

      proxy.$onFileEvent(events);
      events.created.length = 0;
      events.changed.length = 0;
      events.deleted.length = 0;
    }));
    // TODO: 部分不通过fs-client的文件读写也要发事件
  }

  dispose(): void {
    this._listener.dispose();
  }
}
