import { Injectable, Autowired } from '@ali/common-di';
import { IPosition, URI, WithEventBus, OnEvent } from '@ali/ide-core-browser';
import { EditorSelectionChangeEvent, EditorGroupChangeEvent } from '../types';
import { WorkbenchEditorService } from '../../common';

const HistoryPositionLineThreshold = 7;
const HardMaxStateLength = 200; // 超过200个过后，会缩减至100个, 防止反复缩减
const SoftMaxStateLength = 100;

@Injectable()
export class EditorHistoryService extends WithEventBus {

  private currentIndex = -1;

  private stack: EditorHistoryState[] = [];

  start() {
    // do nothing
  }

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    if (e.payload.selections[0]) {
      this.onNewState(new EditorHistoryState(e.payload.resource.uri, {
        lineNumber: e.payload.selections[0]!.selectionStartLineNumber,
        column: e.payload.selections[0]!.selectionStartColumn,
      }, e.payload.group.index));
    }
  }

  @OnEvent(EditorGroupChangeEvent)
  onEditorGroupChangeEvent(e: EditorGroupChangeEvent) {
    if (e.payload.newOpenType && (e.payload.newOpenType.type === 'code' || e.payload.newOpenType.type === 'diff')) {
      const selections = e.payload.group.currentEditor!.getSelections();
      if (selections && selections.length > 0) {
        this.onNewState(new EditorHistoryState(e.payload.newResource!.uri, {
          lineNumber: selections[0].selectionStartLineNumber,
          column: selections[0]!.selectionStartColumn,
        }, e.payload.group.index));
      }
    }
  }

  onNewState(state: EditorHistoryState) {
    console.log(this.currentState, state);
    if (this.currentState) {
      if (this.currentState.isRelevant(state)) {
        return;
      }
    }
    this.doPushState(state);
  }

  get currentState() {
    return this.stack[this.currentIndex];
  }

  doPushState(state: EditorHistoryState) {
    this.stack.splice(this.currentIndex + 1);
    this.stack.push(state);
    if (this.stack.length > HardMaxStateLength) {
      this.stack.splice(0, this.stack.length - SoftMaxStateLength);
    }
    this.currentIndex = this.stack.length - 1;
  }

  forward() {
    if (this.currentIndex < this.stack.length - 1) {
      this.currentIndex ++;
      this.restoreState(this.currentState);
    }
  }

  back() {
    if (this.currentIndex > 0) {
      this.currentIndex --;
      this.restoreState(this.currentState);
    }
  }

  restoreState(state: EditorHistoryState) {
    if (!state) {
      return ;
    }
    const editorGroup = this.editorService.editorGroups[state.groupIndex] || this.editorService.currentEditorGroup;
    editorGroup.open(state.uri, {
      range: {
        startColumn: state.position.column,
        startLineNumber: state.position.lineNumber,
        endColumn: state.position.column,
        endLineNumber: state.position.lineNumber,
      },
      focus: true,
    });
  }
}

export class EditorHistoryState {

  constructor(public readonly uri: URI, public readonly position: IPosition, public groupIndex: number) {

  }

  isRelevant(anotherState: EditorHistoryState): boolean {
    if (this.uri.isEqual(anotherState.uri)) {
      if (anotherState.position.lineNumber < this.position.lineNumber + HistoryPositionLineThreshold && anotherState.position.lineNumber > this.position.lineNumber - HistoryPositionLineThreshold) {
        return true;
      }
    }
    return false;
  }

  isEqual(anotherState: EditorHistoryState) {
    return this.uri.isEqual(anotherState.uri) && this.position.lineNumber === anotherState.position.lineNumber && this.position.column === anotherState.position.column;
  }

}
