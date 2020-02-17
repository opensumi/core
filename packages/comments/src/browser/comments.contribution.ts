import { Autowired } from '@ali/common-di';
import { Domain, ClientAppContribution, Disposable, localize, ContributionProvider, Event } from '@ali/ide-core-browser';
import { ICommentsService, CommentPanelId, CommentsContribution, ICommentsFeatureRegistry } from '../common';
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

  @Autowired(ICommentsFeatureRegistry)
  commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(CommentsContribution)
  private readonly contributions: ContributionProvider<CommentsContribution>;

  onStart() {
    this.listenToCreateCommentsPanel();
    this.registerCommentsFeature();
    this.commentsService.init();
  }

  private registerCommentsFeature() {
    this.contributions.getContributions().forEach((contribution) => {
      if (contribution.registerCommentsFeature) {
        contribution.registerCommentsFeature(this.commentsFeatureRegistry);
      }
    });
  }
  /**
   * 因为大多数情况下没有评论，所以默认先不注册底部面板
   * 在第一次创建 thread 的时候再创建底部面板
   * @memberof CommentsBrowserContribution
   */
  private listenToCreateCommentsPanel() {
    Event.once(this.commentsService.onThreadsCreated)(() => {
      this.layoutService.collectTabbarComponent([{
        id: CommentPanelId,
        component: CommentsPanel,
      }], {
        containerId: CommentPanelId,
        title: localize('comments').toUpperCase(),
        hidden: false,
        ...this.commentsFeatureRegistry.getCommentsPanelOptions(),
      }, 'bottom');
    });
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => {
        return this.commentsService.handleOnCreateEditor(editor);
      },
    });
  }

}
