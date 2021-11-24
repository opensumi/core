import { Autowired, Injectable } from '@opensumi/common-di';
import { Domain } from '@opensumi/ide-core-common';
import { IResource } from '@opensumi/ide-editor/lib/common';
import { EditorComponentRegistry, IEditorDocumentModelContentRegistry, BrowserEditorContribution, ResourceService } from '@opensumi/ide-editor/lib/browser';

import { GitDocContentProvider } from './doc-content-provider/git';
import { GitResourceProvider } from './resource-provider/git';

@Injectable()
@Domain(BrowserEditorContribution)
export class GitSchemeContribution implements BrowserEditorContribution {
  @Autowired()
  private readonly gitResourceProvider: GitResourceProvider;

  @Autowired()
  private readonly gitDocContentProvider: GitDocContentProvider;

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 git content provider provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(this.gitDocContentProvider);
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    // 处理 git 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('git', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });
  }

  registerResource(resourceService: ResourceService) {
    // 处理 git 协议的 editor tab 展示信息
    resourceService.registerResourceProvider(this.gitResourceProvider);
  }
}
