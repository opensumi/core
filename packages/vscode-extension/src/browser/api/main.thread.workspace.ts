import { IRPCProtocol } from '@ali/ide-connection';
import { ExtHostAPIIdentifier, IMainThreadWorkspace } from '../../common';
import { Injectable, Optinal, Autowired } from '@ali/common-di';
import { DisposableCollection } from '@ali/ide-core-common';
import { SerializedDocumentFilter, LanguageSelector } from '../../common/model.api';
import { fromLanguageSelector } from '../../common/coverter';
import { DocumentFilter, testGlob, MonacoModelIdentifier } from 'monaco-languageclient';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { Uri } from '../../common/ext-types';

@Injectable()
export class MainThreadWorkspace implements IMainThreadWorkspace {
  private readonly proxy: any;

  @Autowired(WorkspaceService)
  workspaceService: WorkspaceService;

  constructor(@Optinal(Symbol()) private rpcProtocol: IRPCProtocol) {
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostLanguages);
  }

  dispose() {

  }

  $updateWorkspaceFolders() {

  }

  async $getWorkspaceFolders() {
    return [{
      uri: Uri.file('test://file.com'),
      name: 'test',
      index: 1,
    }];
  }
}
