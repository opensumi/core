import { Injectable, Autowired } from '@opensumi/di';
import { IPosition, URI, WithEventBus, OnEvent } from '@opensumi/ide-core-browser';

import { WorkbenchEditorService } from '../../common';
import { EditorSelectionChangeEvent, EditorGroupChangeEvent, EditorGroupCloseEvent } from '../types';

const HistoryPositionLineThreshold = 7;
const HardMaxStateLength = 200; // 超过200个过后，会缩减至100个, 防止反复缩减
const SoftMaxStateLength = 100;

@Injectable()
export class EditorHistoryService extends WithEventBus {
  private currentIndex = -1;

  private stack: EditorHistoryState[] = [];

  private closedStack: URI[] = [];

  start() {
    // do nothing
  }

  @Autowired(WorkbenchEditorService)
  editorService: WorkbenchEditorService;

  @OnEvent(EditorSelectionChangeEvent)
  onEditorSelectionChangeEvent(e: EditorSelectionChangeEvent) {
    if (e.payload.selections[0]) {
      this.onNewState(
        new EditorHistoryState(
          e.payload.editorUri,
          {
            lineNumber: e.payload.selections[0]!.selectionStartLineNumber,
            column: e.payload.selections[0]!.selectionStartColumn,
          },
          e.payload.group.index,
          false,
        ),
      );
    }
  }

  @OnEvent(EditorGroupChangeEvent)
  onEditorGroupChangeEvent(e: EditorGroupChangeEvent) {
    if (e.payload.newOpenType && (e.payload.newOpenType.type === 'code' || e.payload.newOpenType.type === 'diff')) {
      const selections = e.payload.group.currentEditor!.getSelections();
      if (selections && selections.length > 0) {
        this.onNewState(
          new EditorHistoryState(
            e.payload.newResource!.uri,
            {
              lineNumber: selections[0].selectionStartLineNumber,
              column: selections[0]!.selectionStartColumn,
            },
            e.payload.group.index,
            true,
          ),
        );
      }
    }
  }

  @OnEvent(EditorGroupCloseEvent)
  onEditorGroupCloseEvent(e: EditorGroupCloseEvent) {
    this.pushClosed(e.payload.resource.uri);
  }

  onNewState(state: EditorHistoryState) {
    if (this.currentIndex !== this.stack.length - 1) {
      if (state.isTabChange && this.currentState.isRelevant(state)) {
        //
        return;
      }
      if (this.currentState && this.currentState.isEqual(state)) {
        // 这个状态可能来自 back/forward 被调用产生的行为
        // 如果相同，不做任何行为
        return;
      }
    }
    const isRelevant = this.currentState && this.currentState.isRelevant(state);
    this.doPushState(state, isRelevant);
  }

  get currentState() {
    return this.stack[this.currentIndex];
  }

  doPushState(state: EditorHistoryState, isRelevant: boolean) {
    // 如果和最新的状态关联， 则替换最新的状态
    this.stack.splice(this.currentIndex + (isRelevant ? 0 : 1));
    this.stack.push(state);
    if (this.stack.length > HardMaxStateLength) {
      this.stack.splice(0, this.stack.length - SoftMaxStateLength);
    }
    this.currentIndex = this.stack.length - 1;
  }

  forward() {
    if (this.currentIndex < this.stack.length - 1) {
      this.currentIndex++;
      this.restoreState(this.currentState);
    }
  }

  back() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.restoreState(this.currentState);
    }
  }

  restoreState(state: EditorHistoryState) {
    if (!state) {
      return;
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

  pushClosed(uri: URI) {
    this.closedStack.push(uri);
    if (this.closedStack.length > HardMaxStateLength) {
      this.closedStack.splice(0, this.closedStack.length - SoftMaxStateLength);
    }
  }

  popClosed() {
    const uri = this.closedStack.pop();
    if (uri) {
      this.editorService.open(uri, {
        focus: true,
      });
      this.closedStack = this.closedStack.filter((u) => !uri.isEqual(u));
    }
  }
}

export class EditorHistoryState {
  constructor(
    public readonly uri: URI,
    public readonly position: IPosition,
    public groupIndex: number,
    public isTabChange: boolean,
  ) {}

  isRelevant(anotherState: EditorHistoryState): boolean {
    if (this.uri.isEqual(anotherState.uri)) {
      if (
        anotherState.position.lineNumber < this.position.lineNumber + HistoryPositionLineThreshold &&
        anotherState.position.lineNumber > this.position.lineNumber - HistoryPositionLineThreshold
      ) {
        return true;
      }
      if (this.isTabChange || anotherState.isTabChange) {
        // 如果是 tabChange 类型，我们认为是相关的，这样防止无意义的 0 line 0 column 状态出现
        return true;
      }
    }

    return false;
  }

  isEqual(anotherState: EditorHistoryState) {
    return (
      this.uri.isEqual(anotherState.uri) &&
      this.position.lineNumber === anotherState.position.lineNumber &&
      this.position.column === anotherState.position.column
    );
  }
}
