import { Emitter, WithEventBus, OnEvent, EDITOR_COMMANDS, formatLocalize, uuid } from '@ali/ide-core-browser';
import { IResource, IEditorGroup, WorkbenchEditorService, ResourceDecorationChangeEvent, IResourceDecorationChangeEventPayload } from '@ali/ide-editor';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorGroupOpenEvent, EditorGroupCloseEvent, EditorGroupDisposeEvent } from '@ali/ide-editor/lib/browser';
import { TreeNode } from '@ali/ide-core-browser';
import { FileStat } from '@ali/ide-file-service';

export type OpenedEditorData = IEditorGroup | IResource;

export interface IOpenEditorStatus {
  [key: string]: {
    focused?: boolean;
    selected?: boolean;
    dirty?: boolean;
  };
}

@Injectable()
export class OpenedEditorTreeDataProvider extends WithEventBus {

  private _onDidChange: Emitter<OpenedEditorData | null> = new Emitter();
  private _onDidDecorationChange: Emitter<IResourceDecorationChangeEventPayload | null> = new Emitter();

  public onDidChange = this._onDidChange.event;
  public onDidDecorationChange = this._onDidDecorationChange.event;

  private id = 0;

  @Autowired()
  private workbenchEditorService: WorkbenchEditorService;

  constructor() {
    super();
  }

  @OnEvent(EditorGroupOpenEvent)
  onEditorGroupOpenEvent(e: EditorGroupOpenEvent) {
    if (this.workbenchEditorService.editorGroups.length <= 1) {
      this._onDidChange.fire(null);
    } else {
      this._onDidChange.fire(e.payload.group);
    }
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupCloseEvent(e: EditorGroupCloseEvent) {
    if (this.workbenchEditorService.editorGroups.length <= 1) {
      this._onDidChange.fire(null);
    } else {
      this._onDidChange.fire(e.payload.group);
    }
  }

  @OnEvent(EditorGroupDisposeEvent)
  onEditorGroupDisposeEvent(e: EditorGroupDisposeEvent) {
    this._onDidChange.fire(null);
  }

  // 为修改的文件添加dirty装饰
  @OnEvent(ResourceDecorationChangeEvent)
  onResourceDecorationChangeEvent(e: ResourceDecorationChangeEvent) {
    this._onDidDecorationChange.fire(e.payload);
  }

  getTreeItem(element: OpenedEditorData, roots: FileStat[]): EditorGroupTreeItem | OpenedResourceTreeItem {
    if (isEditorGroup(element)) {
      return new EditorGroupTreeItem(element, this.id++, 0);
    } else {
      return new OpenedResourceTreeItem(element, this.id++, 1, roots);
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

export class OpenedResourceTreeItem implements TreeNode<OpenedResourceTreeItem> {
  public id: string;

  constructor(
    private resource: IResource,
    public order: number,
    public depth: number,
    public roots: FileStat[],
  ) {
    this.id = uuid();
  }

  get parent() {
    return undefined;
  }

  get name() {
    return this.resource.name;
  }

  get uri() {
    return this.resource.uri;
  }

  get label(): string {
    return this.resource.name;
  }

  get tooltip(): string {
    return this.resource.uri.path.toString();
  }

  get description(): string {
    const root = this.roots.find((root: FileStat) => {
      return this.resource.uri.toString().indexOf(root.uri) >= 0;
    });
    if (root) {
      return decodeURIComponent(this.resource.uri.toString().replace(root.uri + '/', ''));
    } else {
      return '';
    }
  }

  get icon(): string {
    return this.resource.icon;
  }

  get command() {
    return {
      command: EDITOR_COMMANDS.OPEN_RESOURCE,
      arguments: [this.resource.uri],
    };
  }

}

export class EditorGroupTreeItem {

  public id: number | string;

  constructor(
    public readonly group: IEditorGroup,
    public order: number,
    public depth: number,
  ) {
    this.id = this.group.index;
  }

  get label() {
    return this.name;
  }

  get name() {
    return formatLocalize('open.editors.group.title', this.group.index + 1);
  }

  get icon() {
    return '';
  }

  get tooltip() {
    return this.label;
  }

  get parent() {
    return undefined;
  }

  get expanded() {
    return true;
  }
}
