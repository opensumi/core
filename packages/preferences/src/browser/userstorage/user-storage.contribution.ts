import { Autowired } from '@ali/common-di';
import {
  Domain,
  URI,
  Resource,
  ResourceResolverContribution,
  Emitter, Event, MaybePromise,
  DisposableCollection,
} from '@ali/ide-core-browser';
import { USER_STORAGE_SCHEME, IUserStorageService } from '../../common';

export class UserStorageResource implements Resource {

  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  protected readonly toDispose = new DisposableCollection();
  constructor(
    public uri: URI,
    protected readonly service: IUserStorageService,
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

  async readContents(options?: { encoding?: string }) {
    return await this.service.readContents(this.uri);
  }

  async saveContents(content: string) {
    return await this.service.saveContents(this.uri, content);
  }

  async getFsPath() {
    return await this.service.getFsPath(this.uri);
  }

  get onDidChangeContents(): Event<void> {
    return this.onDidChangeContentsEmitter.event;
  }
}

@Domain(ResourceResolverContribution)
export class UserStorageResolverContribution implements ResourceResolverContribution {
  @Autowired(IUserStorageService)
  private readonly service: IUserStorageService;

  resolve(uri: URI): MaybePromise<UserStorageResource | void> {
    if (uri.scheme !== USER_STORAGE_SCHEME) {
      return;
    }
    return new UserStorageResource(uri, this.service);
  }
}
