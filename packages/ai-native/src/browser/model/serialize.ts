export interface ISerializeState<T> {
  serializeState: () => T;
  restoreSerializedState(state: T): void;
}
