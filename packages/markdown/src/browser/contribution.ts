import { BrowserEditorContribution, EditorComponentRegistry } from '@ali/ide-editor/lib/browser';
import { Domain, localize } from '@ali/ide-core-common';
import { Autowired } from '@ali/common-di';
import { IMarkdownService } from '../common';
import { MarkdownEditorComponent } from './editor.markdown';

export const MARKDOWN_EDITOR_COMPONENT_ID: string = 'MARKDOWN_EDITOR_COMPONENT_ID';

@Domain(BrowserEditorContribution)
export class EmbeddedMarkdownEditorContribution implements BrowserEditorContribution {

  @Autowired(IMarkdownService)
  markdownService: IMarkdownService;

  registerComponent(componentRegistry: EditorComponentRegistry) {
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
        });
      }
    });
  }

}
