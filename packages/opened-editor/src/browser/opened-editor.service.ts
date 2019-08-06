import { Emitter, URI, Disposable, WithEventBus, OnEvent, EDITOR_COMMANDS } from '@ali/ide-core-browser';
import { IResource, IEditorGroup, WorkbenchEditorService } from '@ali/ide-editor';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorGroupOpenEvent } from '@ali/ide-editor/lib/browser';
import { TreeNode, TreeViewActionTypes } from '@ali/ide-core-browser/lib/components';
import { FileStat } from '@ali/ide-file-service';

export type OpenedEditorData = IEditorGroup | IResource;

export interface IOpenEditorStatus {
  [key: string]: {
    focused?: boolean;
    selected?: boolean;
  };
}

@Injectable()
export class OpenedEditorTreeDataProvider extends WithEventBus {

  private _onDidChangeTreeData: Emitter<OpenedEditorData | null> = new Emitter();

  public onDidChangeTreeData = this._onDidChangeTreeData.event;

  private id = 0;

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

  constructor(
    private resource: IResource,
    public order: number,
    public depth: number,
    public roots: FileStat[],
  ) {
  }

  get parent() {
    return undefined;
  }

  get name() {
    return this.resource.name;
  }

  get id() {
    return this.resource.uri.toString();
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
      return this.resource.uri.toString().replace(root.uri + '/', '');
    } else {
      return this.resource.uri.toString();
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

  constructor(
    public readonly group: IEditorGroup,
    public order: number,
    public depth: number,
  ) {

  }

  get label() {
    return 'Group ' + (this.group.index + 1);
  }

  get name() {
    return 'Group ' + (this.group.index + 1);
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
