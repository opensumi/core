import { Injectable, Autowired } from '@opensumi/di';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import {
  URI,
  Uri,
  CancellationTokenSource,
  CancellationToken,
  Disposable,
  IDisposable,
  getDebugLogger,
  AsyncEmitter,
  Event,
  FileStat,
} from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';

import {
  FileOperation,
  FILE_OPERATION_TIMEOUT,
  IWorkspaceFileOperationParticipant,
  IWorkspaceFileService,
  SourceTargetPair,
  WorkspaceFileEvent,
} from '..';

@Injectable()
export class WorkspaceFileOperationParticipant extends Disposable {
  @Autowired(IProgressService)
  progressService: IProgressService;

  participants: IWorkspaceFileOperationParticipant[] = [];

  registerParticipant(participant: IWorkspaceFileOperationParticipant): IDisposable {
    this.participants.push(participant);
    return {
      dispose: () => {
        const index = this.participants.findIndex((item) => item === participant);
        this.participants.splice(index, 1);
      },
    };
  }

  async participate(files: { source?: Uri; target: Uri }[], operation: FileOperation): Promise<void> {
    const cts = new CancellationTokenSource();
    for (const participant of this.participants) {
      if (cts.token.isCancellationRequested) {
        break;
      }

      try {
        await participant.participate(files, operation, undefined, FILE_OPERATION_TIMEOUT, cts.token);
      } catch (err) {
        getDebugLogger().error(err);
      }
    }
  }

  dispose() {
    this.participants.splice(0, this.participants.length);
  }
}

@Injectable()
export class WorkspaceFileService implements IWorkspaceFileService {
  @Autowired(IFileServiceClient)
  private readonly fileService: IFileServiceClient;

  @Autowired(WorkspaceFileOperationParticipant)
  private readonly fileOperationParticipants: WorkspaceFileOperationParticipant;

  private correlationIds = 0;

  private readonly _onWillRunWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  public readonly onWillRunWorkspaceFileOperation: Event<WorkspaceFileEvent> =
    this._onWillRunWorkspaceFileOperation.event;

  private readonly _onDidFailWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  public readonly onDidFailWorkspaceFileOperation: Event<WorkspaceFileEvent> =
    this._onDidFailWorkspaceFileOperation.event;

  private readonly _onDidRunWorkspaceFileOperation = new AsyncEmitter<WorkspaceFileEvent>();
  public readonly onDidRunWorkspaceFileOperation: Event<WorkspaceFileEvent> =
    this._onDidRunWorkspaceFileOperation.event;

  public create(resource: URI, contents?: string, options?: { overwrite?: boolean }) {
    return this.doCreate(resource, true, contents, options);
  }

  public createFolder(resource: URI) {
    return this.doCreate(resource, false);
  }

  public move(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]> {
    return this.doMoveOrCopy(files, true, options);
  }

  public copy(files: Required<SourceTargetPair>[], options?: { overwrite?: boolean }): Promise<FileStat[]> {
    return this.doMoveOrCopy(files, false, options);
  }

  public async delete(resources: URI[], options?: { useTrash?: boolean; recursive?: boolean }): Promise<void> {
    // file operation participant
    const files = resources.map((target) => ({ target: target.codeUri }));
    await this.runOperationParticipant(files, FileOperation.DELETE);

    // before events
    const event = { correlationId: this.correlationIds++, operation: FileOperation.DELETE, files };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);
    // now actually delete from disk
    try {
      for (const resource of resources) {
        // TODO: support recursive option
        await this.fileService.delete(resource.toString(), { moveToTrash: options?.useTrash });
      }
    } catch (error) {
      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);
  }

  public registerFileOperationParticipant(participant: IWorkspaceFileOperationParticipant): IDisposable {
    return this.fileOperationParticipants.registerParticipant(participant);
  }

  private runOperationParticipant(files: SourceTargetPair[], operation: FileOperation) {
    return this.fileOperationParticipants.participate(files, operation);
  }

  private async doMoveOrCopy(
    files: Required<SourceTargetPair>[],
    move: boolean,
    options?: { overwrite?: boolean },
  ): Promise<FileStat[]> {
    const overwrite = options?.overwrite;
    const stats: FileStat[] = [];

    // file operation participant
    await this.runOperationParticipant(files, move ? FileOperation.MOVE : FileOperation.COPY);

    // before event
    const event = {
      correlationId: this.correlationIds++,
      operation: move ? FileOperation.MOVE : FileOperation.COPY,
      files,
    };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    try {
      for (const { source, target } of files) {
        // now we can rename the source to target via file operation
        if (move) {
          stats.push(await this.fileService.move(source.toString(), target.toString(), { overwrite }));
        } else {
          stats.push(await this.fileService.copy(source.toString(), target.toString(), { overwrite }));
        }
      }
    } catch (error) {
      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    return stats;
  }

  private async doCreate(resource: URI, isFile: boolean, content?: string, options?: { overwrite?: boolean }) {
    // file operation participant
    await this.runOperationParticipant([{ target: resource.codeUri }], FileOperation.CREATE);
    // before events
    const event = {
      correlationId: this.correlationIds++,
      operation: FileOperation.CREATE,
      files: [{ target: resource.codeUri }],
    };
    await this._onWillRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    // now actually create on disk
    let stat: FileStat;
    try {
      if (isFile) {
        stat = await this.fileService.createFile(resource.toString(), { overwrite: options?.overwrite, content });
      } else {
        stat = await this.fileService.createFolder(resource.toString());
      }
    } catch (error) {
      // error event
      await this._onDidFailWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

      throw error;
    }

    // after event
    await this._onDidRunWorkspaceFileOperation.fireAsync(event, CancellationToken.None);

    return stat;
  }
}
