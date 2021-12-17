import { Autowired, Injectable } from '@opensumi/di';
import { IEditorDocumentModelContentProvider } from '@opensumi/ide-editor/lib/browser';
import { URI } from '@opensumi/ide-core-common';

import { AbstractSCMDocContentProvider } from './base-scm';

import { ICodeService } from '../../../services/code-service/base';
import { fromSCMUri } from '../../../utils/scm-uri';

@Injectable()
export class GitDocContentProvider
  extends AbstractSCMDocContentProvider
  implements IEditorDocumentModelContentProvider {
  scheme = 'git';

  @Autowired(ICodeService)
  private readonly codeService: ICodeService;

  fetchContentFromSCM(uri: URI) {
    const info = fromSCMUri(uri);
    return this.codeService.fetchContent(info.repo, info.path, info.ref);
  }
}
