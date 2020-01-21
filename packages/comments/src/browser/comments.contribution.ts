import { Autowired } from '@ali/common-di';
import { Domain, ClientAppContribution, Disposable, localize } from '@ali/ide-core-browser';
import { ICommentsService, CommentPanelId } from '../common';
import { WorkbenchEditorService, IEditor } from '@ali/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { CommentsPanel } from './comments-panel.view';

@Domain(ClientAppContribution, BrowserEditorContribution)
export class CommentsBrowserContribution extends Disposable implements ClientAppContribution, BrowserEditorContribution {

  @Autowired(ICommentsService)
  commentsService: ICommentsService;

  @Autowired(WorkbenchEditorService)
  workbenchEditorService: WorkbenchEditorService;

  @Autowired(IMainLayoutService)
  layoutService: IMainLayoutService;

  onStart() {
    this.commentsService.init();
    this.layoutService.collectTabbarComponent([{
      id: CommentPanelId,
      component: CommentsPanel,
    }], {
      containerId: CommentPanelId,
      title: localize('comments').toUpperCase(),
    }, 'bottom');
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        return this.commentsService.handleOnCreateEditor(editor);
      },
    });
  }

}
