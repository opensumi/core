import { IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';
import { Emitter, Event, IEditorDocumentChange, IEditorDocumentModelSaveResult, URI } from '@ali/ide-core-common';
// import * as md5 from 'md5';

import { fromSCMUri } from '../modules/uri';
import { AbstractSCMDocContentProvider } from '../modules/scm-doc-provider';

export class FileDocContentProvider implements IEditorDocumentModelContentProvider {
  private _openedEditorUris = new Set<string>();

  handlesScheme(scheme: string) {
    // TODO: 加上文件是否存在的判断
    return scheme === 'file';
  }

  provideEditorDocumentModelContent(uri: URI, encoding?: string | undefined) {
    const content = uri.toString() + ' mock content provider';
    this._openedEditorUris.add(uri.toString());
    return content;
  }

  isReadonly(uri: URI) {
    return false;
  }

  async saveDocumentModel(uri: URI, content: string, baseContent: string, changes: IEditorDocumentChange[], encoding: string, ignoreDiff: boolean = false): Promise<IEditorDocumentModelSaveResult> {
    // const baseMd5 = md5(baseContent);
    if (content.length > 1000000) {
      // save by changes
    } else {
      // save by content
    }

    return '' as any;
  }

  provideEncoding(uri: URI) {
    // TODO: 按照数据存储去查询
    return 'utf-8';
  }

  onDidDisposeModel(uri: URI) {
    this._openedEditorUris.delete(uri.toString());
  }

  private _onDidChangeTestContent = new Emitter<URI>();
  public onDidChangeContent: Event<URI> = this._onDidChangeTestContent.event;
}

export class AntcodeDocContentProvider extends AbstractSCMDocContentProvider implements IEditorDocumentModelContentProvider {
  static base64ToUnicode(str: string) {
    return decodeURIComponent(
      atob(str)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''),
      );
  }

  // TODO: 需要增加对文件变更后的监听，以保持文件内容最新

  scheme = 'antcode';

  async fetchContentFromSCM(uri: URI) {
    const info = fromSCMUri(uri);
    return await fetch(
      `/code-service/v4/projects/${encodeURIComponent(info.repo)}/repository/files/${encodeURIComponent(info.path.slice(1))}?ref=${info.ref}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    )
      .then((res) => res.json())
      .then((ret) => {
        if (ret.encoding === 'base64') {
          ret.content = AntcodeDocContentProvider.base64ToUnicode(ret.content);
        }
        return ret.content;
      });
  }
}
