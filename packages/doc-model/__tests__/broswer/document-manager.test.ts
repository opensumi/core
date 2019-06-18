import { IDocumentModeContentProvider, IDocumentChangedEvent, IDocumentModelMirror } from '@ali/ide-doc-model/lib/common/doc';
import { URI, Emitter } from '@ali/ide-core-common';
import { DocumentModelManager } from '@ali/ide-doc-model/lib/browser/doc-manager';
import { Version, VersionType } from '@ali/ide-doc-model';

describe('document manager test suite', () => {

  let modelManager: DocumentModelManager;
  let provider: TestDocumentContentProvider;

  beforeAll(() => {
    modelManager = new DocumentModelManager();
    provider = new TestDocumentContentProvider();
    modelManager.registerDocModelContentProvider(provider);
  });

  it('valid provider test', async (done) => {
    const uri = URI.from({
      scheme: 'test',
      path: 'testContent',
      query: 'test \n strings \n model \n content',
    });
    const doc = await modelManager.resolveModel(uri);
    expect(!!doc).toBeTruthy();
    if (doc) {
      expect(doc.uri.toString()).toEqual(uri.toString());
      expect(doc.lines.join(doc.eol)).toEqual(uri.query); // TODO getText接口
      expect(doc.language).toEqual('typescript');
      provider.testEdit();
      setTimeout(() => {
        expect(doc.lines.join(doc.eol)).toEqual('edited\ncontent\n');
        done();
      }, 1000);
    }
  });

  it('invalid provider test', async () => {
    const uri = URI.from({
      scheme: 'test1',
      path: 'testContent',
      query: 'test \n strings \n model \n content',
    });
    const doc = await modelManager.resolveModel(uri);
    expect(!doc).toBeTruthy();
  });

  it('multiple provider test', async (done) => {
    const secondProvider = new TestDocumentContentProvider2();
    modelManager.registerDocModelContentProvider(secondProvider);
    const uri = URI.from({
      scheme: 'test2',
      path: 'testContent',
      query: 'test2 \n strings \n model \n content',
    });
    const doc = await modelManager.resolveModel(uri);
    expect(!!doc).toBeTruthy();
    if (doc) {
      expect(doc.uri.toString()).toEqual(uri.toString());
      expect(doc.lines.join(doc.eol)).toEqual(uri.query); // TODO getText接口
      expect(doc.language).toEqual('typescript');
      secondProvider.testEdit();
      setTimeout(() => {
        expect(doc.lines.join(doc.eol)).toEqual('edited\ncontent\n');
        done();
      }, 1000);
    }
  });

});

class TestDocumentContentProvider implements IDocumentModeContentProvider {

  private _onChanged = new Emitter<any>();

  private watching: Map<number, URI> = new Map();

  private _count = 1;

  protected scheme = 'test';

  onCreated = () => ({dispose: () => undefined });
  onChanged = this._onChanged.event;
  onRenamed = () => ({dispose: () => undefined });
  onRemoved = () => ({dispose: () => undefined });

  async build(uri: URI) {
    if (uri.scheme === this.scheme) {
      const testString = uri.query || '';
      return {
        uri: uri.toString(),
        encoding: 'utf8',
        eol: '\n',
        language: 'typescript',
        lines: testString.split('\n'),
        base: Version.init(VersionType.browser),
      };
    } else {
      return null;
    }
  }

  watch(uri: string | URI) {
    const uriObj = new URI(uri.toString());
    if (uriObj.scheme === this.scheme) {
      const current = this._count++;
      this.watching.set(current, new URI(uri.toString()));
      return Promise.resolve(current);
    } else {
      return Promise.resolve(null);
    }
  }

  unwatch(id: number) {
    this.watching.delete(id);
    return Promise.resolve();
  }

  testEdit() {
    Array.from(this.watching.values()).forEach((uri) => {
      this._onChanged.fire({
        uri,
        mirror: {
          uri: uri.toString(),
          encoding: 'utf8',
          eol: '\n',
          language: 'typescript',
          lines: 'edited\ncontent\n'.split('\n'),
        },
      } as IDocumentChangedEvent);
    });

  }

  async persist(mirror: IDocumentModelMirror) {
    return mirror;
  }

}

class TestDocumentContentProvider2 extends TestDocumentContentProvider {

  protected scheme = 'test2';

}
