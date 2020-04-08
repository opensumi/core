import { Autowired } from '@ali/common-di';
import { Domain, ClientAppContribution, Disposable, localize, ContributionProvider, Event, ToolbarRegistry, CommandContribution, CommandRegistry, getIcon, TabBarToolbarContribution, IEventBus } from '@ali/ide-core-browser';
import { ICommentsService, CommentPanelId, CommentsContribution, ICommentsFeatureRegistry, CollapseId, CommentPanelCollapse, CloseThreadId, ICommentThreadTitle } from '../common';
import { IEditor } from '@ali/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@ali/ide-editor/lib/browser';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { CommentsPanel } from './comments-panel.view';
import { IMenuRegistry, MenuId, NextMenuContribution } from '@ali/ide-core-browser/lib/menu/next';

@Domain(ClientAppContribution, BrowserEditorContribution, CommandContribution, TabBarToolbarContribution, NextMenuContribution)
export class CommentsBrowserContribution extends Disposable implements ClientAppContribution, BrowserEditorContribution, CommandContribution, TabBarToolbarContribution, NextMenuContribution {

  @Autowired(ICommentsService)
  private readonly commentsService: ICommentsService;

  @Autowired(IMainLayoutService)
  private readonly layoutService: IMainLayoutService;

  @Autowired(ICommentsFeatureRegistry)
  private readonly commentsFeatureRegistry: ICommentsFeatureRegistry;

  @Autowired(CommentsContribution)
  private readonly contributions: ContributionProvider<CommentsContribution>;

  @Autowired(IEventBus)
  private readonly eventBus: IEventBus;

  onStart() {
    this.listenToCreateCommentsPanel();
    this.registerCommentsFeature();
    this.commentsService.init();
  }

  get panelBadge() {
    const length = this.commentsService.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand({
      id: CollapseId,
      label: '%comments.panel.action.collapse%',
      iconClass: getIcon('collapse-all'),
    }, {
      execute: () => {
        this.eventBus.fire(new CommentPanelCollapse());
      },
    });

    registry.registerCommand({
      id: CloseThreadId,
      label: '%comments.thread.action.close%',
      iconClass: getIcon('up'),
    }, {
      execute: (threadTitle: ICommentThreadTitle) => {
        const { thread, widget } = threadTitle;
        if (!thread.comments.length) {
          thread.dispose();
        } else {
          if (widget.isShow) {
            widget.toggle();
          }
        }
      },
    });
  }

  registerNextMenus(registry: IMenuRegistry): void {
    registry.registerMenuItem(MenuId.CommentsCommentThreadTitle, {
      command: CloseThreadId,
      group: 'inline',
      order: Number.MAX_SAFE_INTEGER,
    });
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: CollapseId,
      viewId: CommentPanelId,
      command: CollapseId,
      tooltip: localize('comments.panel.action.collapse'),
    });
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
        badge: this.panelBadge,
        containerId: CommentPanelId,
        title: localize('comments').toUpperCase(),
        hidden: false,
        activateKeyBinding: 'shift+ctrlcmd+c',
        ...this.commentsFeatureRegistry.getCommentsPanelOptions(),
      }, 'bottom');
    });

    this.commentsService.onThreadsChanged(() => {
      const handler = this.layoutService.getTabbarHandler(CommentPanelId);
      handler?.setBadge(this.panelBadge);
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
