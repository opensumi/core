import { IEditorDocumentModelContentProvider } from '@ide-framework/ide-editor/lib/browser';
import { Emitter, Event, URI } from '@ide-framework/ide-core-common';

// 目前只实现了只读模式
export abstract class AbstractSCMDocContentProvider implements IEditorDocumentModelContentProvider {
  protected scheme: string;
  // 简单的前端文件缓存，后续需要接入 indexedb 等
  protected _openedEditorResources = new Map<string, any>();

  handlesScheme(scheme: string) {
    return scheme === this.scheme;
  }

  async provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined) {
    const uriStr = uri.toString();

    if (this._openedEditorResources.has(uriStr)) {
      return this._openedEditorResources.get(uriStr).content;
    }

    const content = await this.fetchContentFromSCM(uri);
    this._openedEditorResources.set(uriStr, { content });
    return content;
  }

  isReadonly(uri: URI) {
    return true;
  }

  // 实际的 SCM 服务应该储存了文件的编码，应按照 SCM 返回的 encoding 处理
  provideEncoding(uri: URI) {
    return 'utf-8';
  }

  onDidDisposeModel(uri: URI) {
    this._openedEditorResources.delete(uri.toString());
  }

  private _onDidChangeTestContent = new Emitter<URI>();
  public onDidChangeContent: Event<URI> = this._onDidChangeTestContent.event;

  /**
   * 从不同的代码服务平台获取内容
   * @param uri URI
   */
  abstract async fetchContentFromSCM(uri: URI): Promise<string>;
}
