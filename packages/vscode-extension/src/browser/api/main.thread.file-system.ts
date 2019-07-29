import * as vscode from 'vscode';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { FileChangeEvent, FileChange, FileChangeType } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import {
  IMainThreadFileSystem,
  IExtHostFileSystem,
  ExtFileWatcherSubscriber,
  ExtFileSystemWatcherOptions,
} from '@ali/ide-file-service/lib/common/ext-file-system';
import { ExtHostAPIIdentifier } from '../../common/';
import { ParsedPattern, parse, IRelativePattern } from '../../common/glob';
import { RelativePattern } from '../../common/ext-types';

@Injectable()
export class MainThreadFileSystem implements IMainThreadFileSystem {
  private readonly proxy: IExtHostFileSystem;
  private subscriberId: number = -1;

  @Autowired(FileServiceClient)
  protected readonly fileSystem: FileServiceClient;
  private watcherSubscribers = new Map<number, ExtFileWatcherSubscriber>();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostFileSystem);
    this.fileSystem.setExtFileSystemClient(this);
    this.fileSystem.stat('kt: test');

    this.fileSystem.onFilesChanged((event: FileChangeEvent) => {
      event.forEach((event: FileChange) => {
        this.watcherSubscribers.forEach((subscriber: ExtFileWatcherSubscriber, id: number) => {
          if (event.type === FileChangeType.UPDATED &&
              !subscriber.ignoreChangeEvents &&
              this.uriMatches(subscriber, event)) {
            this.proxy.$onFileEvent({id, event});
          }
          if (event.type === FileChangeType.ADDED &&
            !subscriber.ignoreCreateEvents &&
            this.uriMatches(subscriber, event)) {
            this.proxy.$onFileEvent({id, event });
          }
          if (event.type === FileChangeType.DELETED &&
            !subscriber.ignoreDeleteEvents &&
            this.uriMatches(subscriber, event)) {
            this.proxy.$onFileEvent({id, event});
          }
        });
      });
    });
  }

  $subscribeWatcher(options: ExtFileSystemWatcherOptions) {
    const id = ++this.subscriberId;

    let globPatternMatcher: ParsedPattern;
    if (typeof options.globPattern === 'string') {
      globPatternMatcher = parse(options.globPattern);
    } else {
      const relativePattern: IRelativePattern = new RelativePattern(options.globPattern.base, options.globPattern.pattern);
      globPatternMatcher = parse(relativePattern);
    }

    const subscriber: ExtFileWatcherSubscriber = {
      id,
      mather: globPatternMatcher,
      ignoreCreateEvents: options.ignoreCreateEvents === true,
      ignoreChangeEvents: options.ignoreChangeEvents === true,
      ignoreDeleteEvents: options.ignoreDeleteEvents === true,
    };
    this.watcherSubscribers.set(id, subscriber);

    return id;
  }

  $unsubscribeWatcher(id: number) {
    this.watcherSubscribers.delete(id);
  }

  private uriMatches(subscriber: ExtFileWatcherSubscriber, fileChange: FileChange): boolean {
    return subscriber.mather(fileChange.uri);
  }

  // TODO: test
  stat(uri) {
    this.proxy.$stat(uri);
  }
}
