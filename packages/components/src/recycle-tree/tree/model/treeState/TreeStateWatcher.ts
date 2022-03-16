import { Event, Emitter, IDisposable, DisposableCollection } from '../../../../utils';

import { TreeStateManager, IPathChange, IExpansionStateChange } from './TreeStateManager';
import { ISerializableState, TreeStateWatcherChangeType as TreeStateChangeType } from './types';

export class TreeStateWatcher implements IDisposable {
  private _disposed = false;
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

  constructor(treeState: TreeStateManager, atSurfaceExpandedDirsOnly = false) {
    this.disposables.push(
      treeState.onChangeScrollOffset((newOffset: number) => {
        this.currentState.scrollPosition = newOffset;
        this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.ScrollOffset);
      }),
    );
    this.disposables.push(
      treeState.onDidChangeRelativePath(({ prevPath, newPath }: IPathChange) => {
        let shouldNotify = false;
        const surfaceSets = new Set(this.currentState.expandedDirectories.atSurface);

        if (surfaceSets.has(prevPath)) {
          surfaceSets.delete(prevPath);
          surfaceSets.add(newPath);
          shouldNotify = true;
        }
        this.currentState.expandedDirectories.atSurface = Array.from(surfaceSets);

        if (atSurfaceExpandedDirsOnly) {
          const buriedSets = new Set(this.currentState.expandedDirectories.buried);
          if (buriedSets.has(prevPath)) {
            surfaceSets.delete(prevPath);
            surfaceSets.add(newPath);
            shouldNotify = true;
          }
          this.currentState.expandedDirectories.buried = Array.from(buriedSets);
        }
        if (shouldNotify) {
          this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.PathsUpdated);
        }
      }),
    );

    this.disposables.push(
      treeState.onDidChangeExpansionState(({ relativePath, isExpanded, isVisibleAtSurface }: IExpansionStateChange) => {
        let shouldNotify = false;
        const surfaceSets = new Set(this.currentState.expandedDirectories.atSurface);
        const buriedSets = new Set(this.currentState.expandedDirectories.buried);
        if (surfaceSets.has(relativePath) && (!isExpanded || !isVisibleAtSurface)) {
          surfaceSets.delete(relativePath);
          // 该目录下的子目录需要变为buried状态
          const restSurfaceArray = Array.from(surfaceSets);
          const pathsShouldBeBuried = restSurfaceArray.filter((rest) => rest.indexOf(relativePath) >= 0);
          for (const path of pathsShouldBeBuried) {
            surfaceSets.delete(path);
            if (!buriedSets.has(path)) {
              buriedSets.add(path);
            }
          }
          shouldNotify = true;
        } else if (isExpanded && isVisibleAtSurface) {
          surfaceSets.add(relativePath);
          shouldNotify = true;
        }
        this.currentState.expandedDirectories.atSurface = Array.from(surfaceSets);

        if (!atSurfaceExpandedDirsOnly) {
          if (buriedSets.has(relativePath) && (!isExpanded || isVisibleAtSurface)) {
            buriedSets.delete(relativePath);
            shouldNotify = true;
          } else if (isExpanded && !isVisibleAtSurface) {
            buriedSets.add(relativePath);
            shouldNotify = true;
          }
          this.currentState.expandedDirectories.buried = Array.from(buriedSets);
        }
        if (shouldNotify) {
          this.onDidTreeStateChangeEmitter.fire(TreeStateChangeType.DirExpansionState);
        }
      }),
    );
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
