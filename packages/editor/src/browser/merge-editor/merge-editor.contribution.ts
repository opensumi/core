import { Autowired } from '@opensumi/di';
import { Disposable, Domain, Schemes } from '@opensumi/ide-core-browser';

import { ResourceService } from '../../common';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '../types';

import { MergeEditorResourceProvider } from './merge-editor.provider';
import { MergeEditorFloatComponents } from './MergeEditorFloatComponents';

const MERGE_EDITOR_FLOATING_WIDGET = 'merge.editor.floating.widget';

@Domain(BrowserEditorContribution)
export class MergeEditorContribution extends Disposable implements BrowserEditorContribution {
  @Autowired()
  private readonly mergeEditorResourceProvider: MergeEditorResourceProvider;

  registerResource(resourceService: ResourceService): void {
    resourceService.registerResourceProvider(this.mergeEditorResourceProvider);
  }

  registerEditorComponent(registry: EditorComponentRegistry) {
    registry.registerEditorComponentResolver(EditorOpenType.mergeEditor, (_, results) => {
      results.push({
        type: EditorOpenType.mergeEditor,
      });
    });

    registry.registerEditorSideWidget({
      id: MERGE_EDITOR_FLOATING_WIDGET,
      component: MergeEditorFloatComponents,
      displaysOnResource: (resource) => {
        const { uri } = resource;
        if (uri.scheme !== Schemes.file) {
          return false;
        }
        // 由于存在时序问题，具体是否显示的逻辑由组件内部处理
        return true;
      },
    });
  }
}
