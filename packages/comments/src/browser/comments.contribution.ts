import { Autowired } from '@opensumi/di';
import {
  Domain,
  ClientAppContribution,
  Disposable,
  localize,
  ContributionProvider,
  Event,
  ToolbarRegistry,
  CommandContribution,
  CommandRegistry,
  getIcon,
  TabBarToolbarContribution,
  IEventBus,
} from '@opensumi/ide-core-browser';
import { IMenuRegistry, MenuId, MenuContribution } from '@opensumi/ide-core-browser/lib/menu/next';
import { IEditor } from '@opensumi/ide-editor';
import { BrowserEditorContribution, IEditorFeatureRegistry } from '@opensumi/ide-editor/lib/browser';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import {
  ICommentsService,
  CommentPanelId,
  CommentsContribution,
  ICommentsFeatureRegistry,
  CollapseId,
  CommentPanelCollapse,
  CloseThreadId,
  ICommentThreadTitle,
  SwitchCommandReaction,
  ICommentsThread,
  CommentReactionPayload,
  CommentReactionClick,
} from '../common';

@Domain(
  ClientAppContribution,
  BrowserEditorContribution,
  CommandContribution,
  TabBarToolbarContribution,
  MenuContribution,
)
export class CommentsBrowserContribution
  extends Disposable
  implements
    ClientAppContribution,
    BrowserEditorContribution,
    CommandContribution,
    TabBarToolbarContribution,
    MenuContribution
{
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
    this.registerCommentsFeature();
    this.listenToCreateCommentsPanel();
    this.commentsService.init();
  }

  get panelBadge() {
    const length = this.commentsService.commentsThreads.length;
    return length ? length + '' : '';
  }

  registerCommands(registry: CommandRegistry) {
    registry.registerCommand(
      {
        id: CollapseId,
        label: '%comments.panel.action.collapse%',
        iconClass: getIcon('collapse-all'),
      },
      {
        execute: () => {
          this.eventBus.fire(new CommentPanelCollapse());
        },
      },
    );

    registry.registerCommand(
      {
        id: CloseThreadId,
        label: '%comments.thread.action.close%',
        iconClass: getIcon('up'),
      },
      {
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
      },
    );

    registry.registerCommand(
      { id: SwitchCommandReaction },
      {
        execute: (payload: CommentReactionPayload) => {
          this.eventBus.fire(new CommentReactionClick(payload));
        },
      },
    );
  }

  registerMenus(registry: IMenuRegistry): void {
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
    this.contributions.getContributions().forEach((contribution, index) => {
      this.addDispose(
        this.commentsService.registerCommentRangeProvider(`contribution_${index}`, {
          getCommentingRanges: (documentModel) => contribution.provideCommentingRanges(documentModel),
        }),
      );
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
    if (this.commentsFeatureRegistry.getCommentsPanelOptions().defaultShow) {
      this.commentsService.registerCommentPanel();
    } else {
      Event.once(this.commentsService.onThreadsCreated)(() => {
        this.commentsService.registerCommentPanel();
      });
    }

    this.addDispose(
      Event.debounce(
        this.commentsService.onThreadsChanged,
        () => {},
        100,
      )(() => {
        const handler = this.layoutService.getTabbarHandler(CommentPanelId);
        handler?.setBadge(this.panelBadge);
      }, this),
    );
  }

  registerEditorFeature(registry: IEditorFeatureRegistry) {
    registry.registerEditorFeatureContribution({
      contribute: (editor: IEditor) => this.commentsService.handleOnCreateEditor(editor),
      provideEditorOptionsForUri: async (uri) => {
        const ranges = await this.commentsService.getContributionRanges(uri);

        // 说明当前 uri 可以评论
        if (ranges.length) {
          return {
            // 让编辑器的 lineDecorationsWidth 宽一点，以便放下评论 icon
            lineDecorationsWidth: 25,
            lineNumbersMinChars: 5,
          };
        } else {
          return {};
        }
      },
    });
  }
}
