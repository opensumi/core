// @ts-nocheck
import { autorun, autorunOpts } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/autorun';
import { IObservable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';
import { IDisposable } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/commonFacade/deps';
import { observableFromEvent } from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/utils';

export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/autorun';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/base';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/debugName';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/derived';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/logging';
export * from '@opensumi/monaco-editor-core/esm/vs/base/common/observableInternal/utils';

export function autorunDelta<T>(
  observable: IObservable<T>,
  handler: (args: { lastValue: T | undefined; newValue: T }) => void,
): IDisposable {
  let _lastValue: T | undefined;
  return autorunOpts({ debugReferenceFn: handler }, (reader) => {
    const newValue = observable.read(reader);
    const lastValue = _lastValue;
    _lastValue = newValue;
    handler({ lastValue, newValue });
  });
}

export function debouncedObservable2<T>(observable: IObservable<T>, debounceMs: number): IObservable<T> {
  let hasValue = false;
  let lastValue: T | undefined;

  let timeout: any;

  return observableFromEvent<T, void>(
    (cb) => {
      const d = autorun((reader) => {
        const value = observable.read(reader);

        if (!hasValue) {
          hasValue = true;
          lastValue = value;
        } else {
          if (timeout) {
            clearTimeout(timeout);
          }
          timeout = setTimeout(() => {
            lastValue = value;
            cb();
          }, debounceMs);
        }
      });
      return {
        dispose() {
          d.dispose();
          hasValue = false;
          lastValue = undefined;
        },
      };
    },
    () => {
      if (hasValue) {
        return lastValue!;
      } else {
        return observable.get();
      }
    },
  );
}
