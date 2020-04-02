import { Event, Emitter, IDisposable, DisposableCollection } from '@ali/ide-core-common';
import { TreeStateManager, IPathChange, IExpansionStateChange } from './TreeStateManager';
import { ISerializableState, TreeStateWatcherChangeType as TreeStateChangeType } from './types';

export class TreeStateWatcher implements IDisposable {
  private _disposed: boolean = false;
  private disposables: DisposableCollection = new DisposableCollection();

  private onDidTreeStateChangeEmitter: Emitter<TreeStateChangeType> = new Emitter();

  private currentState: ISerializableState = {
    specVersion: 1,
    scrollPosition: 0,
    expandedDirectories: {
      atSurface: [],
      buried: [],
    },
  };

  constructor(
    treeState: TreeStateManager,
    atSurfaceExpandedDirsOnly: boolean = false,
  ) {
    this.disposables.push(treeState.onChangeScrollOffset((newOffset: number) => {
      this.currentState.scrollPosition = newOffset;
      this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.ScrollOffset);
    }));
    this.disposables.push(treeState.onDidChangeRelativePath(({prevPath, newPath}: IPathChange) => {
      let shouldNotify = false;
      const atSurfaceIdx = this.currentState.expandedDirectories.atSurface.indexOf(prevPath);
      if (atSurfaceIdx > -1) {
        this.currentState.expandedDirectories.atSurface[atSurfaceIdx] = newPath;
        shouldNotify = true;
      }

      if (atSurfaceExpandedDirsOnly) {
        const buriedIdx = this.currentState.expandedDirectories.buried.indexOf(prevPath);
        if (buriedIdx > -1) {
          this.currentState.expandedDirectories.buried[buriedIdx] = newPath;
          shouldNotify = true;
        }
      }
      if (shouldNotify) {
        this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.PathsUpdated);
      }
    }));

    this.disposables.push(treeState.onDidChangeExpansionState(({relativePath, isExpanded, isVisibleAtSurface}: IExpansionStateChange) => {
      let shouldNotify = false;
      const atSurfaceIdx = this.currentState.expandedDirectories.atSurface.indexOf(relativePath);
      if (atSurfaceIdx > -1 && (!isExpanded || !isVisibleAtSurface)) {
        this.currentState.expandedDirectories.atSurface.splice(atSurfaceIdx, 1);
        shouldNotify = true;
      } else if (isExpanded && isVisibleAtSurface) {
        this.currentState.expandedDirectories.atSurface.push(relativePath);
        shouldNotify = true;
      }

      if (!atSurfaceExpandedDirsOnly) {
        const buriedIdx = this.currentState.expandedDirectories.buried.indexOf(relativePath);
        if (buriedIdx > -1 && (!isExpanded || isVisibleAtSurface)) {
          this.currentState.expandedDirectories.buried.splice(buriedIdx, 1);
          shouldNotify = true;
        } else if (isExpanded && !isVisibleAtSurface) {
          this.currentState.expandedDirectories.buried.push(relativePath);
          shouldNotify = true;
        }
      }
      if (shouldNotify) {
        this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.DirExpansionState);
      }
    }));
  }

  get onDidChange(): Event<TreeStateChangeType> {
    return this.onDidTreeStateChangeEmitter.event;
  }

  public dispose() {
    if (this._disposed) {
      return;
    }
    this._disposed = true;
    this.disposables.dispose();
  }

  public snapshot(): ISerializableState {
    return {
      ...this.currentState,
      expandedDirectories: {
        atSurface: this.currentState.expandedDirectories.atSurface.slice(),
        buried: this.currentState.expandedDirectories.buried.slice(),
      },
    };
  }

  public toString() {
    return JSON.stringify(this.currentState);
  }
}
