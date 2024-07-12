import { Autowired, Injectable, Optional } from '@opensumi/di';
import { IRPCProtocol } from '@opensumi/ide-connection';
import { MergeEditorInputData } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { Disposable, URI, Uri, diffSets, isUndefined } from '@opensumi/ide-core-common';
import {
  DragOverPosition,
  IDiffResource,
  IMergeEditorResource,
  IResource,
  WorkbenchEditorService,
} from '@opensumi/ide-editor';
import { EditorGroup, WorkbenchEditorServiceImpl } from '@opensumi/ide-editor/lib/browser/workbench-editor.service';

import {
  AnyInputDto,
  IEditorTabDto,
  IEditorTabGroupDto,
  IExtHostEditorTabsShape,
  IMainThreadEditorTabsShape,
  TabInputKind,
  TabModelOperationKind,
} from './../../../common/vscode/editor-tabs';
import { ExtHostAPIIdentifier } from './../../../common/vscode/index';

export interface ITabInfo {
  name: string;
  resource: URI;
}

@Injectable({ multiple: true })
export class MainThreadEditorTabsService extends Disposable implements IMainThreadEditorTabsShape {
  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  private readonly proxy: IExtHostEditorTabsShape;

  constructor(@Optional(Symbol()) private rpcProtocol: IRPCProtocol) {
    super();
    this.proxy = this.rpcProtocol.getProxy(ExtHostAPIIdentifier.ExtHostEditorTabs);

    this.addDispose(
      this.workbenchEditorService.onDidEditorGroupsChanged(() => {
        this.updateGroups();
      }),
    );
    this.addDispose(
      this.workbenchEditorService.onActiveResourceChange(() => {
        this.updateGroups();
      }),
    );
    this.workbenchEditorService.contributionsReady.promise.then(() => {
      this.updateGroups();
    });
  }

  $initializeState() {
    this.updateGroups();
  }

  $moveTab(tabId: string, index: number, viewColumn: number, preserveFocus?: boolean | undefined): void {
    const target = this.findEditorTabData(tabId);
    if (target) {
      const { group, resource } = target;
      let targetEditorGroup = group;
      if (!isUndefined(viewColumn)) {
        targetEditorGroup = this.workbenchEditorService.sortedEditorGroups[viewColumn];
      }
      if (targetEditorGroup) {
        targetEditorGroup.dropUri(resource.uri, DragOverPosition.CENTER, group, targetEditorGroup.resources[index]);
      } else {
        group.dropUri(resource.uri, DragOverPosition.RIGHT);
      }
    }
  }

  async $closeTab(tabIds: string[], preserveFocus?: boolean | undefined): Promise<boolean> {
    const res = await Promise.all(
      tabIds.map(async (tabId) => {
        const target = this.findEditorTabData(tabId);
        if (target) {
          return await target.group.close(target.resource.uri);
        }
      }),
    );
    return res.filter((r) => !!r).length > 0;
  }

  async $closeGroup(groupIds: number[], preservceFocus?: boolean | undefined): Promise<boolean> {
    const res = await Promise.all(
      groupIds.map(async (g) => {
        const editorGroup = this.groupDataStore.get(g)?.editorGroup;
        if (editorGroup) {
          try {
            return await editorGroup.closeAll();
          } catch (e) {
            return false;
          }
        }
      }),
    );
    return res.filter((r) => !!r).length > 0;
  }

  private findEditorTabData(tabId: string): EditorTabDtoData | undefined {
    return this.tabStore.all.get(tabId);
  }

  private prevEditorGroups: Set<EditorGroup> = new Set();

  private groupDataStore: Map<number, EditorTabGroupData> = new Map();

  private tabStore: EditorTabDtoDataStore = new EditorTabDtoDataStore();

  getOrCreateGroupData(group: EditorGroup): EditorTabGroupData {
    if (!this.groupDataStore.has(group.groupId)) {
      const data = new EditorTabGroupData(group, this.workbenchEditorService, this.tabStore, this.proxy);
      data.addDispose({
        dispose: () => {
          if (this.groupDataStore.get(group.groupId) === data) {
            this.groupDataStore.delete(group.groupId);
          }
        },
      });
      this.groupDataStore.set(group.groupId, data);
    }
    return this.groupDataStore.get(group.groupId)!;
  }

  private updateGroups() {
    const diff = diffSets(this.prevEditorGroups, new Set(this.workbenchEditorService.editorGroups));
    if (diff.added.length > 0 || diff.removed.length > 0) {
      // 做一次完整更新
      this.proxy.$acceptEditorTabModel(
        this.workbenchEditorService.editorGroups.map((group) => {
          const data = this.getOrCreateGroupData(group);
          return {
            ...data.dto,
            tabs: data.tabs.map((t) => t.dto),
          };
        }),
      );
    } else {
      this.workbenchEditorService.editorGroups.forEach((group) => {
        const data = this.getOrCreateGroupData(group);
        data.tryCheckUpdate();
      });
    }
    this.prevEditorGroups = new Set(this.workbenchEditorService.editorGroups);
  }
}

class EditorTabDtoData {
  private _dto: IEditorTabDto;

  constructor(public readonly group: EditorGroup, public resource: IResource) {
    this.tryUpdate();
  }

  updateResource(resource: IResource) {
    this.resource = resource;
  }
  /**
   * @param updateDto
   */
  tryUpdate(): false | true {
    const updateDto = EditorTabDtoData.from(this.group, this.resource);
    if (this._dto && JSON.stringify(this._dto) !== JSON.stringify(updateDto)) {
      this._dto = updateDto;
      return true;
    } else {
      this._dto = updateDto;
      return false;
    }
  }

  get dto() {
    return this._dto;
  }

  static getTabId(editorGroup: EditorGroup, resource: IResource): string {
    return `${editorGroup.groupId}~${resource.uri.toString()}`;
  }

  get index() {
    return this.group.resources.indexOf(this.resource);
  }

  static from(editorGroup: EditorGroup, resource: IResource): IEditorTabDto {
    const tabId = EditorTabDtoData.getTabId(editorGroup, resource);
    const openType = editorGroup.getLastOpenType(resource);
    let input: AnyInputDto = {
      kind: TabInputKind.UnknownInput,
    };
    if (openType) {
      if (openType.type === 'code') {
        input = {
          kind: TabInputKind.TextInput,
          uri: resource.uri.codeUri,
        };
      } else if (openType.type === 'diff') {
        const { metadata } = resource as IDiffResource;
        if (metadata) {
          input = {
            kind: TabInputKind.TextDiffInput,
            original: metadata!.original.codeUri,
            modified: metadata!.modified.codeUri,
          };
        }
      } else if (openType.type === 'mergeEditor') {
        const { metadata } = resource as IMergeEditorResource;
        if (metadata) {
          const { ancestor, input1, input2, output } = metadata!;
          const input1Data = MergeEditorInputData.from(input1);
          const input2Data = MergeEditorInputData.from(input2);
          input = {
            kind: TabInputKind.TextMergeInput,
            base: Uri.parse(ancestor),
            input1: input1Data.uri.codeUri,
            input2: input2Data.uri.codeUri,
            result: Uri.parse(output),
          };
        }
      } else if (openType.type === 'component') {
        // 区分 webview / customEditor
        const component = editorGroup.editorComponentRegistry.getEditorComponent(openType.componentId!);
        if (component?.metadata?.extWebview) {
          input = {
            kind: TabInputKind.WebviewEditorInput,
            viewType: component?.metadata?.extWebview,
          };
        } else if (component?.metadata?.customEditor) {
          input = {
            kind: TabInputKind.CustomEditorInput,
            viewType: component?.metadata?.customEditor,
            uri: resource.uri.codeUri,
          };
        }
      }
    }
    return {
      id: tabId,
      label: resource.name,
      input,
      isActive: editorGroup.currentResource === resource,
      isPinned: false, // 暂时还没这个功能,
      isPreview: !!editorGroup.previewURI?.isEqual(resource.uri),
      isDirty: !!editorGroup.resourceService.getResourceDecoration(resource.uri)?.dirty,
    };
  }
}

class EditorTabDtoDataStore {
  all: Map<string, EditorTabDtoData> = new Map();

  private mapByUri: Map<string, Map<string, EditorTabDtoData>> = new Map();

  getOrCreateData(group: EditorGroup, resource: IResource): EditorTabDtoData {
    const tabId = EditorTabDtoData.getTabId(group, resource);
    if (!this.all.has(tabId)) {
      const data = new EditorTabDtoData(group, resource);
      const uriString = resource.uri.toString();
      if (!this.mapByUri.has(uriString)) {
        this.mapByUri.set(uriString, new Map());
      }
      this.mapByUri.get(uriString)!.set(tabId, data);
      this.all.set(tabId, data);
    } else {
      this.all.get(tabId)!.updateResource(resource);
    }
    return this.all.get(tabId)!;
  }

  removeData(id: string) {
    const data = this.all.get(id);
    if (data) {
      this.all.delete(id);
      const uriString = data.resource.uri.toString();
      this.mapByUri.get(uriString)?.delete(id);
      if (this.mapByUri.get(uriString)?.size === 0) {
        this.mapByUri.delete(uriString);
      }
    }
  }

  getByResourceUri(uri: URI) {
    return Array.from(this.mapByUri.get(uri.toString())?.values() || []);
  }
}

class EditorTabGroupData extends Disposable {
  public tabs: EditorTabDtoData[] = [];

  constructor(
    public readonly editorGroup: EditorGroup,
    private editorService: WorkbenchEditorService,
    private store: EditorTabDtoDataStore,
    private proxy: IExtHostEditorTabsShape,
  ) {
    super();
    this.editorGroup.addDispose(this);
    this.init();
  }

  init() {
    this.tabs = this.editorGroup.resources.map((r) => this.store.getOrCreateData(this.editorGroup, r));
    this.addDispose(
      this.editorGroup.onDidEditorGroupTabOperation((operation) => {
        const kind = {
          open: TabModelOperationKind.TAB_OPEN,
          close: TabModelOperationKind.TAB_CLOSE,
          move: TabModelOperationKind.TAB_MOVE,
        }[operation.type];
        const tabDtoData = this.store.getOrCreateData(this.editorGroup, operation.resource);
        tabDtoData.tryUpdate();
        this.proxy.$acceptTabOperation({
          kind,
          groupId: this.editorGroup.groupId,
          tabDto: tabDtoData.dto,
          index: operation.index,
          oldIndex: operation.oldIndex,
        });
      }),
    );
    this.addDispose(
      this.editorGroup.onDidEditorGroupBodyChanged(() => {
        this.onTabsMayUpdated();
      }),
    );
    this.addDispose(
      this.editorGroup.onDidEditorGroupTabChanged(() => {
        this.onTabsMayUpdated();
      }),
    );
  }

  onTabsMayUpdated() {
    this.tabs = this.editorGroup.resources.map((r, index) => {
      const data = this.store.getOrCreateData(this.editorGroup, r);
      const isChanged = data.tryUpdate();
      if (isChanged) {
        this.proxy.$acceptTabOperation({
          kind: TabModelOperationKind.TAB_UPDATE,
          tabDto: data.dto,
          index,
          groupId: this.editorGroup.groupId,
        });
      }
      return data;
    });
  }

  public tryCheckUpdate() {
    const oldData = this._data;
    const newData = {
      groupId: this.editorGroup.groupId,
      isActive: this.editorService.currentEditorGroup === this.editorGroup,
      viewColumn: this.editorGroup.index,
    };
    this._data = newData;
    if (oldData) {
      if (oldData.viewColumn !== newData.viewColumn) {
        // changed
        this.proxy.$acceptTabGroupUpdate({
          ...this.dto,
          tabs: [], // update 事件中不会真正消费 tabs
        });
      } else if (!oldData.isActive && newData.isActive) {
        // 只有原来不是 active ，新的是 active 才要发 （和 vscode 行为对齐）
        this.proxy.$acceptTabGroupUpdate({
          ...this.dto,
          tabs: [], // update 事件中不会真正消费 tabs
        });
      }
    }
  }

  private _data: Omit<IEditorTabGroupDto, 'tabs'> | undefined = undefined;

  get dto(): Omit<IEditorTabGroupDto, 'tabs'> {
    if (!this._data) {
      this._data = {
        groupId: this.editorGroup.groupId,
        isActive: this.editorService.currentEditorGroup === this.editorGroup,
        viewColumn: this.editorGroup.index,
      };
    }
    return this._data;
  }
}
