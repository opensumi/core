import { URI, Emitter } from '@ali/ide-core-common';
import { DocumentModelManager } from '@ali/ide-doc-model/lib/browser/doc-manager';
import {
  DocumentModel,
} from '@ali/ide-doc-model/lib/browser/doc-model';
import {
  Version,
  VersionType,
  IDocumentModelContentProvider,
  IDocumentChangedEvent,
  IDocumentModelStatMirror,
  IDocumentModelManager,
} from '@ali/ide-doc-model';
import { Injectable } from '@ali/common-di';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';

@Injectable()
class TestDocumentModelManager extends DocumentModelManager {
  async updateContent(uri: string | URI, content: string): Promise<DocumentModel> {
    const doc = this._modelMap.get(uri.toString());

    if (!doc) {
      throw new Error('Document not found');
    }

    // @ts-ignore
    doc._lines = content.split(doc.eol);

    return doc;
  }
}

class MockRmoteContentProvider implements IDocumentModelContentProvider {

  private _onChanged = new Emitter<any>();
  private watching: Set<string> = new Set();
  public scheme = 'mockfile';
  private _currentVersion = Version.init(VersionType.raw);

  onCreated = () => ({dispose: () => undefined });
  onChanged = this._onChanged.event;
  onRenamed = () => ({dispose: () => undefined });
  onRemoved = () => ({dispose: () => undefined });

  async build(uri: URI) {
    if (uri.scheme === this.scheme) {
      const testString = uri.query || '';
      this.watching.add(uri.toString());
      return {
        uri: uri.toString(),
        encoding: 'utf8',
        eol: '\n',
        language: 'typescript',
        lines: testString.split('\n'),
        base: this._currentVersion,
      };
    } else {
      return null;
    }
  }

  testEdit() {
    Array.from(this.watching.values()).forEach((uri) => {
      this._currentVersion = Version.next(this._currentVersion);
      this._onChanged.fire({
        uri: new URI(uri),
        mirror: {
          uri,
          encoding: 'utf8',
          eol: '\n',
          language: 'typescript',
          lines: 'edited\ncontent\n'.split('\n'),
          base: this._currentVersion,
        },
      } as IDocumentChangedEvent);
    });

  }

  async persist(mirror: IDocumentModelStatMirror) {
    return mirror;
  }

}

class MockEmptyContentProvider extends MockRmoteContentProvider {
  public scheme = 'mockempty';
}

describe('document manager test suite', () => {

  let modelManager: DocumentModelManager;
  const remote = new MockRmoteContentProvider();
  const empty = new MockEmptyContentProvider();

  const injector = createBrowserInjector([]);
  injector.addProviders({
    token: IDocumentModelManager,
    useClass: TestDocumentModelManager,
  });

  beforeAll(() => {
    modelManager = injector.get(IDocumentModelManager);
    modelManager.registerDocModelContentProvider(remote);
    modelManager.registerDocModelContentProvider(empty);
  });

  it('valid provider test', async (done) => {
    const uri = URI.from({
      scheme: remote.scheme,
      path: 'file.txt',
      query: 'test \n strings \n model \n content',
    });
    try {
      await modelManager.createModel(uri);
    } catch { }
    const doc = await modelManager.resolveModel(uri);
    expect(!!doc).toBeTruthy();
    if (doc) {
      expect(doc.uri.toString()).toEqual(uri.toString());
      expect(doc.getText()).toEqual(uri.query);
      expect(doc.language).toEqual('typescript');
      remote.testEdit();
      setTimeout(() => {
        expect(doc.lines.join(doc.eol)).toEqual('edited\ncontent\n');
        done();
      }, 1000);
    }
  });

  it('invalid provider test', async (done) => {
    const uri = URI.from({
      scheme: 'failed',
      path: 'file.txt',
      query: 'test \n strings \n model \n content',
    });
    try {
      await modelManager.createModel(uri);
    } catch { }

    try {
      await modelManager.resolveModel(uri);
    } catch (e) {
      expect(e).toEqual(new Error('Resolve content failed'));
    }

    done();
  });

  it('multiple provider test', async (done) => {
    const uri = URI.from({
      scheme: empty.scheme,
      path: 'file.txt',
      query: 'test2 \n strings \n model \n content',
    });
    try {
      await modelManager.createModel(uri);
    } catch { }
    const doc = await modelManager.resolveModel(uri);
    expect(!!doc).toBeTruthy();
    if (doc) {
      expect(doc.uri.toString()).toEqual(uri.toString());
      expect(doc.getText()).toEqual(uri.query);
      expect(doc.language).toEqual('typescript');
      empty.testEdit();
      setTimeout(() => {
        expect(doc.getText()).toEqual('edited\ncontent\n');
        done();
      }, 1000);
    }
  });

  it('model persist test', async (done) => {
    /**
     * 执行非 dirty 文件保存
     */

    /**
     * 执行 dirty 文件的保存
     */

    /**
     * 执行 dirty 文件的合并保存
     */

    /**
     * 执行文件重命名
     */

    /**
     * 执行文件的删除后重建
     */

    done();
  });

});
