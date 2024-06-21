export interface APIExtender<T> {
  /**
   * extend the API
   *
   * it's better not to modify the original API directly, but to return a new API.
   */
  extend(data: T): T;
}

export function applyExtenders<T>(extenders: APIExtender<T>[], _data: T) {
  for (const extender of extenders) {
    _data = extender.extend(_data);
  }

  return _data;
}
