import { Autowired } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { Domain, Schemes, localize } from '@opensumi/ide-core-common';
import { BrowserEditorContribution, EditorComponentRegistry, EditorOpenType } from '@opensumi/ide-editor/lib/browser';

import { IMarkdownService } from '../common';

import { MarkdownEditorComponent } from './editor.markdown';

export const MARKDOWN_EDITOR_COMPONENT_ID = 'MARKDOWN_EDITOR_COMPONENT_ID';

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
      scheme: Schemes.file,
    });

    componentRegistry.registerEditorComponentResolver(Schemes.file, (resource, results) => {
      if (resource.uri.path.ext === '.md') {
        results.push({
          type: EditorOpenType.component,
          componentId: MARKDOWN_EDITOR_COMPONENT_ID,
          title: localize('editorOpenType.preview'),
          weight: this.preferenceService.get<boolean>('application.preferMarkdownPreview') ? 10 : -1,
        });
      }
    });
  }
}
