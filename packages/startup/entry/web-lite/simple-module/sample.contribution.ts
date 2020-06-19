import { Injectable, Autowired } from '@ali/common-di';
import { Domain } from '@ali/ide-core-common';
import { ResourceService, IResource } from '@ali/ide-editor/lib/common';
import { EditorComponentRegistry, IEditorDocumentModelContentRegistry, BrowserEditorContribution } from '@ali/ide-editor/lib/browser';

import { AoneDocContentProvider } from './content-provider/aone';
import { AntcodeDocContentProvider } from './content-provider/antcode';

import { AoneResourceProvider, AntcodeResourceProvider } from './resource-provider';

@Injectable()
@Domain(BrowserEditorContribution)
export class SampleContribution implements BrowserEditorContribution {
  @Autowired(AntcodeResourceProvider)
  private readonly antcodeResourceProvider: AntcodeResourceProvider;

  @Autowired(AoneResourceProvider)
  private readonly aoneResourceProvider: AoneResourceProvider;

  registerEditorDocumentModelContentProvider(registry: IEditorDocumentModelContentRegistry) {
    // 注册 provider 提供 doc / 文档的内容和 meta 信息
    registry.registerEditorDocumentModelContentProvider(new AntcodeDocContentProvider());
    registry.registerEditorDocumentModelContentProvider(new AoneDocContentProvider());
  }

  registerEditorComponent(editorComponentRegistry: EditorComponentRegistry) {
    // 处理 antcode 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('antcode', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });

    // 处理 aone 协议的 editor component type
    editorComponentRegistry.registerEditorComponentResolver('aonecode', (resource: IResource, results) => {
      results.push({
        type: 'code',
      });
    });
  }

  registerResource(resourceService: ResourceService) {
    resourceService.registerResourceProvider(this.antcodeResourceProvider);
    resourceService.registerResourceProvider(this.aoneResourceProvider);
  }
}
