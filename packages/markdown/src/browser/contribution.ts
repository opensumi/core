import { BrowserEditorContribution, EditorComponentRegistry } from '@opensumi/ide-editor/lib/browser';
import { Domain, localize } from '@opensumi/ide-core-common';
import { Autowired } from '@opensumi/common-di';
import { IMarkdownService } from '../common';
import { MarkdownEditorComponent } from './editor.markdown';
import { PreferenceService } from '@opensumi/ide-core-browser';

export const MARKDOWN_EDITOR_COMPONENT_ID: string = 'MARKDOWN_EDITOR_COMPONENT_ID';

@Domain(BrowserEditorContribution)
export class EmbeddedMarkdownEditorContribution implements BrowserEditorContribution {

  @Autowired(IMarkdownService)
  markdownService: IMarkdownService;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  registerEditorComponent(componentRegistry: EditorComponentRegistry) {
    componentRegistry.registerEditorComponent({
      uid: MARKDOWN_EDITOR_COMPONENT_ID,
      component: MarkdownEditorComponent,
      scheme: 'file',
    });

    componentRegistry.registerEditorComponentResolver('file', (resource, results) => {
      if (resource.uri.path.ext === '.md') {
        results.push({
          type: 'component',
          componentId: MARKDOWN_EDITOR_COMPONENT_ID,
          title: localize('editorOpenType.preview'),
          weight: this.preferenceService.get<boolean>('application.preferMarkdownPreview') ? 10 : -1,
        });
      }
    });
  }

}
