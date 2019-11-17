import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@ali/common-di';
import { IEditorActionRegistry, IEditorActionItem } from '../types';
import { IDisposable, URI, BasicEvent, IEventBus, Disposable, IContextKeyService, Emitter, IContextKeyExpr } from '@ali/ide-core-browser';
import { IResource, IEditorGroup } from '../../common';
import { observable, reaction, computed } from 'mobx';
import { AbstractMenuService, ICtxMenuRenderer, MenuId, generateCtxMenu } from '@ali/ide-core-browser/lib/menu/next';

@Injectable()
export class EditorActionRegistryImpl implements IEditorActionRegistry {

  public readonly items: IEditorActionItemData[] = [];

  private _onAddAction = new Emitter<IEditorActionItemData>();

  public onAddAction = this._onAddAction.event;

  private _onRemoveAction = new Emitter<IEditorActionItemData>();

  public onRemoveAction = this._onRemoveAction.event;

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  private visibleActions: Map<IEditorGroup, VisibleEditorActions> = new Map();

  @Autowired(INJECTOR_TOKEN)
  private injector: Injector;

  @Autowired(AbstractMenuService)
  menuService: AbstractMenuService;

  @Autowired(ICtxMenuRenderer)
  ctxMenuRenderer: ICtxMenuRenderer;

  registerEditorAction(actionItem: IEditorActionItem): IDisposable {
    const processed = {
      ...actionItem,
      contextKeyExpr: actionItem.when ? this.contextKeyService.parse(actionItem.when) : undefined,
    };
    this.items.push(processed);
    const disposer = new Disposable();
    disposer.addDispose({
      dispose: () => {
        const index = this.items.indexOf(processed);
        if (index !== -1) {
          this.items.splice(index, 1);
          this._onRemoveAction.fire(processed);
        }
      },
    });
    this._onAddAction.fire(processed);
    return disposer;
  }

  getActions(editorGroup: IEditorGroup) {
    if (!this.visibleActions.has(editorGroup)) {
      const visibleActions = this.injector.get(VisibleEditorActions, [editorGroup, this]);
      this.visibleActions.set(editorGroup, visibleActions);
      ((editorGroup as any) as Disposable).addDispose({
        dispose: () => {
          this.visibleActions.delete(editorGroup);
          visibleActions.dispose();
        },
      });
    }
    return this.visibleActions.get(editorGroup)!.items;
  }

  showMore(x: number, y: number, group: IEditorGroup) {
    const menus = this.menuService.createMenu(MenuId.EditorTitle, this.contextKeyService);
    const result = generateCtxMenu({ menus });
    menus.dispose();

    this.ctxMenuRenderer.show({
      anchor: { x, y },
      // 合并结果
      menuNodes: [...result[0], ...result[1]],
      context: [{group}],
    });
  }

}

interface IEditorActionItemData extends IEditorActionItem {
  contextKeyExpr?: IContextKeyExpr;
}

@Injectable({multiple: true})
export class VisibleEditorActions extends Disposable {

  @Autowired(IContextKeyService)
  private contextKeyService: IContextKeyService;

  @observable.shallow private visibleEditorActions: VisibleAction[] = [];

  private contextKeys: string[] = [];

  constructor(private group: IEditorGroup, registry: EditorActionRegistryImpl) {
    super();
    const disposer = reaction(() => group.currentResource, () => {
      this.update();
    });
    this.addDispose({
      dispose: () => {
        disposer();
      },
    });
    registry.items.forEach((item) => {
      this.addItem(item);
    });
    this.addDispose(registry.onAddAction((item) => {
      this.addItem(item);
    }));
    this.addDispose(registry.onRemoveAction((item) => {
      this.removeItem(item);
    }));
  }

  addItem(item: IEditorActionItemData) {
    this.visibleEditorActions.push(new VisibleAction(item, this.group, this.contextKeyService));
  }

  removeItem(item: IEditorActionItemData) {
    const index = this.visibleEditorActions.findIndex((v) => v.item === item);
    if (index !== -1) {
      this.visibleEditorActions[index].dispose();
      this.visibleEditorActions.splice(index, 1);
    }
  }

  update() {
    this.visibleEditorActions.forEach((action) => {
      action.update();
    });
  }

  @computed
  get items(): IEditorActionItem[] {
    return this.visibleEditorActions.filter((v) => v.visible).map((v) => v.item);
  }

  dispose() {
    super.dispose();
    (this.group as any) = null;
    this.visibleEditorActions.forEach((v) => v.dispose());
    this.visibleEditorActions = [];
  }

}

class VisibleAction extends Disposable {

  @observable visible = false;

  constructor(public readonly item: IEditorActionItemData, private editorGroup: IEditorGroup, private contextKeyService: IContextKeyService) {
    super();
    if (this.item.contextKeyExpr) {
      const set = new Set(this.item.contextKeyExpr.keys());
      this.addDispose(contextKeyService.onDidChangeContext((e) => {
        if (e.payload.affectsSome(set)) {
          this.update();
        }
      }));
    }

    this.addDispose({
      dispose: () => {
        (this as any).editorGroup = null;
        (this as any).contextKeyService = null;
      },
    });
  }

  update() {
    const item = this.item;
    if (item.isVisible) {
      try {
        this.visible = item.isVisible(this.editorGroup.currentResource, this.editorGroup);
      } catch (e) {
        this.visible = false;
      }
    }
    if (item.contextKeyExpr) {
      const context = this.editorGroup.currentEditor ? this.editorGroup.currentEditor.monacoEditor.getDomNode() : undefined;
      this.visible = this.contextKeyService.match(item.contextKeyExpr, context);
    }
  }
}
