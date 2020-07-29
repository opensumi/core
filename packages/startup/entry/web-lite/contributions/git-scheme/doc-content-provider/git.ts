import { Autowired, Injectable } from '@ali/common-di';
import { IEditorDocumentModelContentProvider } from '@ali/ide-editor/lib/browser';
import { URI } from '@ali/ide-core-common';

import { AbstractSCMDocContentProvider } from './base-scm';

import { fromSCMUri } from '../scm-uri';

import { ICodeService } from '../../../modules/code-service/base';

@Injectable()
export class GitDocContentProvider extends AbstractSCMDocContentProvider implements IEditorDocumentModelContentProvider {
  // TODO: 需要增加对文件变更后的监听，以保持文件内容最新
  scheme = 'git';

  @Autowired(ICodeService)
  private readonly codeService: ICodeService;

  fetchContentFromSCM(uri: URI) {
    const info = fromSCMUri(uri);
    return this.codeService.fetchContent(info.repo, info.path, info.ref);
  }
}
