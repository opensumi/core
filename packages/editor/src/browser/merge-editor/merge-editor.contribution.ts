import { Autowired } from '@opensumi/di';
import { Disposable, Domain, IContextKeyService, Schemes, Uri } from '@opensumi/ide-core-browser';

import { ResourceService } from '../../common';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '../types';

import { MergeEditorResourceProvider } from './merge-editor.provider';
import { MergeEditorFloatComponents } from './MergeEditorFloatComponents';

const MERGE_EDITOR_FLOATING_WIDGET = 'merge.editor.floating.widget';

@Domain(BrowserEditorContribution)
export class MergeEditorContribution extends Disposable implements BrowserEditorContribution {
  @Autowired()
  private readonly mergeEditorResourceProvider: MergeEditorResourceProvider;

  @Autowired(IContextKeyService)
  private readonly contextKeyService: IContextKeyService;

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
      component: MergeEditorFloatComponents as any,
      displaysOnResource: (resource) => {
        const { uri } = resource;
        if (uri.scheme !== Schemes.file) {
          return false;
        }

        const mergeChanges = this.contextKeyService.getValue<Uri[]>('git.mergeChanges') || [];
        return mergeChanges.some((value) => value.toString() === uri.toString());
      },
    });
  }
}
