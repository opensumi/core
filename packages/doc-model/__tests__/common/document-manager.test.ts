import { IDocumentModeContentProvider, IDocumentChangedEvent, IDocumentModelMirror } from '@ali/ide-doc-model/lib/common/doc';
import { URI, Emitter } from '@ali/ide-core-common';
import { IDocumentModelManager, DocumentModelManager } from '@ali/ide-doc-model';
import { dispose } from '@ali/ide-core-common/lib/lifecycle';

describe('document manager test suite', () => {

  let modelManager: IDocumentModelManager;
  let provider: TestDocumentContentProvider;

  beforeAll(() => {
    modelManager = new DocumentModelManager();
    provider = new TestDocumentContentProvider();
    const isWatching = false;
    modelManager.registerDocModelContentProvider(provider);
  });

  it('valid provider test', async (done) => {
    const uri = URI.from({
      scheme: 'test',
      path: 'testContent',
      query: 'test \n strings \n model \n content',
    });
    const doc = await modelManager.resolve(uri);
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
    const doc = await modelManager.resolve(uri);
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
    const doc = await modelManager.resolve(uri);
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

  private watching: Set<URI> = new Set();

  protected scheme = 'test';

  onCreated = () => ({dispose: () => undefined });
  onChanged = this._onChanged.event;
  onRenamed = () => ({dispose: () => undefined });
  onRemoved = () => ({dispose: () => undefined });

  async build(uri: URI) {
    if (uri.scheme === this.scheme) {
      const path = uri.path;
      const testString = uri.query || '';
      return {
        uri: uri.toString(),
        encoding: 'utf8',
        eol: '\n',
        language: 'typescript',
        lines: testString.split('\n'),
      };
    } else {
      return null;
    }
  }

  watch(uri: URI) {
    if (uri.scheme === this.scheme) {
      this.watching.add(uri);
      return {
        dispose: () => {
          this.watching.delete(uri);
        },
      };
    }
  }

  testEdit() {
    this.watching.forEach((uri) => {
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
