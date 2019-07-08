import { Emitter, URI, Disposable, WithEventBus, OnEvent, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { IResource, IEditorGroup, WorkbenchEditorService } from '@ali/ide-editor';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorGroupOpenEvent } from '@ali/ide-editor/lib/browser';

export type OpenedEditorData = IEditorGroup | IResource;

@Injectable()
export class OpenedEditorTreeDataProvider extends WithEventBus {

  private _onDidChangeTreeData: Emitter<OpenedEditorData | null> = new Emitter();

  public onDidChangeTreeData = this._onDidChangeTreeData.event;

  @Autowired()
  private workbenchEditorService: WorkbenchEditorService;

  constructor() {
    super();
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpenEvent(e: EditorGroupOpenEvent) {
    if (this.workbenchEditorService.editorGroups.length <= 1) {
      this._onDidChangeTreeData.fire(null);
    } else {
      this._onDidChangeTreeData.fire(e.payload.group);
    }
  }

  getTreeItem(element: OpenedEditorData): EditorGroupTreeItem | OpenedResourceTreeItem {
    if (isEditorGroup(element)) {
      return new EditorGroupTreeItem(element);
    } else {
      return new OpenedResourceTreeItem(element);
    }
  }

  getChildren(element?: OpenedEditorData): OpenedEditorData[] {
    if (!element) {
      if (this.workbenchEditorService.editorGroups.length <= 1) {
        return this.workbenchEditorService.editorGroups[0].resources.slice();
      } else {
        return this.workbenchEditorService.editorGroups;
      }
    } else {
      if (isEditorGroup(element)) {
        return element.resources.slice();
      } else {
        return [];
      }
    }
  }
}

export function isEditorGroup(data: OpenedEditorData): data is IEditorGroup {
  return typeof (data as any).resources !== 'undefined';
}

export class OpenedResourceTreeItem {

  constructor(
    private resource: IResource,
  ) {
  }

  get label(): string {
    return this.resource.name;
  }

  get tooltip(): string {
    return `${this.description}`;
  }

  get description(): string {
    return this.resource.uri.path.toString();
  }

  get iconClass(): string {
    return this.resource.icon;
  }

  get command() {
    return {
      command: EDITOR_COMMANDS.OPEN_RESOURCE,
      arguments: [this.resource.uri],
    };
  }

  get collapsibleState() {
    return TreeItemCollapsibleState.None;
  }

  contextValue = 'opened-resource';

}

export class EditorGroupTreeItem {

  constructor(public readonly group: IEditorGroup) {

  }

  get label() {
    return '第' + (this.group.index + 1) + '组';
  }

  get iconClass() {
    return null;
  }

  get collapsibleState() {
    return TreeItemCollapsibleState.Expanded;
  }
}

enum TreeItemCollapsibleState {
  Collapsed = 1,
  Expanded = 2,
  None = 3,
}
