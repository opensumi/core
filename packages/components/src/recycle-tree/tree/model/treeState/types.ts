export interface ISerializableState {
  /**
   * Future proofing
   *
   * Lib consumers are likely to store the `ISerilizableState` somewhere to let users resume where they left of last time. But that "last time" could be years!!
   * Given that, should things move around in internal/external API/behaviour (like path resolution, encoding method etc.) this will allow us to provide backwards compatibilty.
   */
  specVersion: number;
  scrollPosition: number;
  expandedDirectories: {
    atSurface: string[],
    buried: string[],
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
