import { IEditorGroup } from '../../common';
import { observable } from 'mobx';

export class EditorGrid {

  public editorGroup: IGridEditorGroup | null = null;

  @observable.shallow public children: EditorGrid[] = [];

  public splitDirection: SplitDirection | null;

  constructor(private parent?: EditorGrid) {

  }

  setEditorGroup(editorGroup: IGridEditorGroup) {
    this.editorGroup = editorGroup;
    editorGroup.grid = this;
  }

  public split(direction: SplitDirection, editorGroup: IGridEditorGroup, before?: boolean) {

    if (!this.splitDirection) {
      if (this.parent && this.parent.splitDirection === direction) {
        // 没有split过，不过父grid正好是同一个方向，就可以把它放到父grid中
        const index = this.parent.children.indexOf(this);
        const newGrid = new EditorGrid(this.parent);
        newGrid.setEditorGroup(editorGroup);
        if (before) {
          this.parent.children.splice(index, 0, newGrid);
        } else {
          this.parent.children.splice(index + 1, 0, newGrid);
        }
      } else {
        // 没有split过，并且父grid也不是同一个方向,
        // 此时要创建两个child，将原来的editorGroup给第一个child
        this.splitDirection = direction;
        const originalChild = new EditorGrid(this);
        originalChild.setEditorGroup(this.editorGroup!);
        this.editorGroup = null;
        const newGrid = new EditorGrid(this);
        newGrid.setEditorGroup(editorGroup);
        if (before) {
          this.children = [newGrid, originalChild];
        } else {
          this.children = [originalChild, newGrid];
        }
      }
    } else {
      // 应该不会落到这里，由于split永远只会从未分割的含有editorGroup的grid发出
    }
  }

}

export interface IGridChild {
  grid: EditorGrid;
  percentage: number; // 0-100
}

export enum SplitDirection {
  // 水平拆分
  Horizontal = 1,

  // 垂直拆分
  Vertical = 2,
}

export interface IGridEditorGroup extends IEditorGroup {

  grid: EditorGrid;

}
