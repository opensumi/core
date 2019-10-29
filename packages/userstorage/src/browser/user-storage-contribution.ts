import { Autowired } from '@ali/common-di';
import {
  Domain,
  URI,
  Resource,
  ResourceResolverContribution,
  Emitter, Event, MaybePromise,
  DisposableCollection,
} from '@ali/ide-core-browser';
import { UserStorageService } from './user-storage-service';
import { UserStorageUri } from '../common';

export class UserStorageResource implements Resource {

  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  protected readonly toDispose = new DisposableCollection();
  constructor(
    public uri: URI,
    protected readonly service: UserStorageService,
  ) {
    this.toDispose.push(this.service.onUserStorageChanged((e) => {
      for (const changedUri of e.uris) {
        if (changedUri.toString() === this.uri.toString()) {
          this.onDidChangeContentsEmitter.fire(undefined);
        }
      }
    }));

    this.toDispose.push(this.onDidChangeContentsEmitter);
  }

  dispose(): void {
    this.toDispose.dispose();
  }

  readContents(options?: { encoding?: string }): Promise<string> {
    return this.service.readContents(this.uri);
  }

  saveContents(content: string): Promise<void> {
    return this.service.saveContents(this.uri, content);
  }

  get onDidChangeContents(): Event<void> {
    return this.onDidChangeContentsEmitter.event;
  }
}

@Domain(ResourceResolverContribution)
export class UserStorageResolver implements ResourceResolverContribution {
  @Autowired(UserStorageService)
  private readonly service: UserStorageService;

  resolve(uri: URI): MaybePromise<UserStorageResource | void> {
    if (uri.scheme !== UserStorageUri.SCHEME) {
      return;
    }
    return new UserStorageResource(uri, this.service);
  }
}
