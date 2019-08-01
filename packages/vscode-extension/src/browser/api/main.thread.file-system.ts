import { URI, Schemas } from '@ali/ide-core-common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { IRPCProtocol } from '@ali/ide-connection';
import { FileChangeEvent, FileChange, FileChangeType } from '@ali/ide-file-service';
import { FileServiceClient } from '@ali/ide-file-service/lib/browser/file-service-client';
import { FileServiceExtClient } from '@ali/ide-file-service/lib/browser/file-service-ext-client';
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
  private subscriberId: number = 0;

  @Autowired(FileServiceClient)
  protected readonly fileSystemClient: FileServiceClient;
  @Autowired(FileServiceExtClient)
  protected readonly fileSeystemExtClient: FileServiceExtClient;
  private watcherSubscribers = new Map<number, ExtFileWatcherSubscriber>();

  constructor(@Optinal(IRPCProtocol) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostFileSystem);
    this.fileSeystemExtClient.setExtFileSystemClient(this);
    this.fileSystemClient.onFilesChanged((event: FileChangeEvent) => {
      event.forEach((event: FileChange) => {
        const _uri = new URI(event.uri);
        if (_uri.scheme !== Schemas.file) {
          // Only support files and folders on disk
          return;
        }
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
    const id = this.subscriberId++;

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

  $fireProvidersFilesChange(e: FileChangeEvent) {
    this.fileSystemClient.fireFilesChange(e);
  }

  async watchFileWithProvider(uri: string, options: { recursive: boolean; excludes: string[] }): Promise<number> {
    return await this.proxy.$watchFileWithProvider(uri, options);
  }

  async unWatchFileWithProvider(id: number) {
    return await this.proxy.$unWatchFileWithProvider(id);
  }

  async haveProvider(scheme: string): Promise<boolean> {
    return await this.proxy.$haveProvider(scheme);
  }

  async runProviderMethod(
    scheme: string,
    funName: string,
    args: any[],
  ) {
    return await this.proxy.$runProviderMethod(scheme, funName, args);
  }

  private uriMatches(subscriber: ExtFileWatcherSubscriber, fileChange: FileChange): boolean {
    return subscriber.mather(fileChange.uri);
  }
}
