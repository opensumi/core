export interface ISerializableState {
  specVersion: number;
  scrollPosition: number;
  expandedDirectories: {
    atSurface: string[];
    buried: string[];
  };
}

export enum TreeStateEvent {
  DidChangeScrollOffset = 1,
  DidChangeDirExpansionState,
  DidChangeRelativePath,
  DidChange,
  DidLoadState,
}

export enum TreeStateWatcherChangeType {
  ScrollOffset = 1,
  DirExpansionState,
  PathsUpdated,
}
