import { Injectable, Autowired } from '@ali/common-di';
import { observable, runInAction, action } from 'mobx';
import { URI } from '@ali/ide-core-browser';
import { OpenedEditorTreeDataProvider, EditorGroupTreeItem, OpenedResourceTreeItem } from '@ali/ide-opened-editor/lib/browser/opened-editor.service';
import { IResource } from '@ali/ide-editor';

@Injectable()
export class ExplorerOpenedEditorService {
  @Autowired(OpenedEditorTreeDataProvider)
  openEditorTreeDataProvider: OpenedEditorTreeDataProvider;

  @observable.shallow
  treeData: any;

  constructor() {
    this.init();
  }

  init() {
    this.getTreeDatas();
    this.openEditorTreeDataProvider.onDidChangeTreeData((element) => {
      this.getTreeDatas();
    });
  }

  @action
  getTreeDatas() {
    const allTreeData = this.openEditorTreeDataProvider.getChildren();
    this.treeData = allTreeData.map((element) => {
      const treeitem = this.openEditorTreeDataProvider.getTreeItem(element);
      if (treeitem instanceof EditorGroupTreeItem) {
        const editorGroupTreeItem = treeitem as EditorGroupTreeItem;
        return {
          label: editorGroupTreeItem.label,
          iconClass: editorGroupTreeItem.iconClass,
          collapsibleState: editorGroupTreeItem.collapsibleState,
          childrens: editorGroupTreeItem.group.resources.map((resource: IResource) => {
            return {
              label: resource.name,
              tooltip: resource.uri,
              description: resource.uri.toString(),
              iconClass: resource.icon,
            };
          }),
        };
      } else if (treeitem instanceof OpenedResourceTreeItem) {
        const openedResourceTreeItem = treeitem as OpenedResourceTreeItem;
        return {
          label: openedResourceTreeItem.label,
          tooltip: openedResourceTreeItem.tooltip,
          description: openedResourceTreeItem.description,
          iconClass: openedResourceTreeItem.iconClass,
          command: openedResourceTreeItem.command,
          collapsibleState: openedResourceTreeItem.collapsibleState,
        };
      }
    });
  }
}
