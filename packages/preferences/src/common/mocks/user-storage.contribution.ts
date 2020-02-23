import {
  Domain,
  URI,
  Resource,
  ResourceResolverContribution,
  Emitter, Event, MaybePromise,
  DisposableCollection,
} from '@ali/ide-core-browser';
import { USER_STORAGE_SCHEME } from '..';

export class MockUserStorageResource implements Resource {

  protected readonly onDidChangeContentsEmitter = new Emitter<void>();
  protected readonly toDispose = new DisposableCollection();
  constructor(
    public uri: URI,
  ) {

  }

  dispose(): void {
    this.toDispose.dispose();
  }

  async readContents(options?: { encoding?: string }): Promise<string> {
    return '{}';
  }

  async saveContents(content: string): Promise<void> {
    return;
  }

  get onDidChangeContents(): Event<void> {
    return this.onDidChangeContentsEmitter.event;
  }
}

@Domain(ResourceResolverContribution)
export class MockUserStorageResolverContribution implements ResourceResolverContribution {
  resolve(uri: URI): MaybePromise<MockUserStorageResource | void> {
    if (uri.scheme !== USER_STORAGE_SCHEME) {
      return;
    }
    return new MockUserStorageResource(uri);
  }
}
