import { BoxPanel, Widget, BoxLayout } from '@phosphor/widgets';
import { View, AppConfig, ViewContextKeyRegistry, IContextKeyService } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { ActivityPanelToolbar } from '@ali/ide-core-browser/lib/layout/view-container-toolbar';
import { IdeWidget } from '@ali/ide-core-browser/lib/layout/ide-widget.view';

@Injectable({multiple: true})
export class BottomPanelWidget extends BoxPanel {

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired()
  private viewContextKeyRegistry: ViewContextKeyRegistry;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  titleBar: ActivityPanelToolbar;
  container: Widget;

  constructor(
    public readonly containerId: string,
    protected readonly view: View,
    public readonly command: string,
    public inVisible?: boolean,
    options?: BoxPanel.IOptions,
  ) {
    super({direction: 'top-to-bottom', spacing: 0, ...options});
    this.init();
  }

  protected onAfterAttach() {
    this.titleBar.updateToolbar(this.view.id);
  }

  // 第一次不会调用
  protected onBeforeShow() {
    this.titleBar.updateToolbar(this.view.id);
  }

  protected init() {
    this.titleBar = this.injector.get(ActivityPanelToolbar, ['bottom', this.containerId]);
    this.container = this.injector.get(IdeWidget, [this.config, this.view.component, 'bottom']);
    BoxPanel.setStretch(this.titleBar, 0);
    BoxPanel.setStretch(this.container, 1);
    this.addWidget(this.titleBar);
    this.addWidget(this.container);
    this.addClass('bottom-container');
    this.container.addClass('overflow-visible');
    this.container.addClass('bottom-wrap');
    this.titleBar.addClass('overflow-visible');

    this.viewContextKeyRegistry.registerContextKeyService(this.containerId, this.contextKeyService.createScoped()).createKey('view', this.containerId);
    this.viewContextKeyRegistry.registerContextKeyService(this.view.id, this.contextKeyService.createScoped()).createKey('view', this.view.id);
  }
}
