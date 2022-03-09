import React from 'react';

import { localize } from '@opensumi/ide-core-common';

import {
  IExtensionOwnedEnvironmentVariableMutator,
  IMergedEnvironmentVariableCollectionDiff,
  mutatorTypeLabel,
} from '../../common/environmentVariable';

import styles from './variable.module.less';

interface ITerminalVariableProps {
  diff: IMergedEnvironmentVariableCollectionDiff;
}

function mergeChanges(
  source: ReadonlyMap<string, IExtensionOwnedEnvironmentVariableMutator[]>,
  target: Set<string>,
): void {
  source.forEach((mutators, variable) => {
    mutators.forEach((mutator) => {
      target.add(mutatorTypeLabel(mutator.type, mutator.value, variable));
    });
  });
}

export const TerminalVariable = ({ diff }: ITerminalVariableProps) => {
  const addsAndChanges: string[] = React.useMemo(() => {
    const result: Set<string> = new Set();
    if (diff?.added && diff?.added.size > 0) {
      mergeChanges(diff.added, result);
    }

    if (diff?.changed && diff.changed.size > 0) {
      mergeChanges(diff.changed, result);
    }
    return Array.from(result.values());
  }, [diff]);

  const removals: string[] = React.useMemo(() => {
    if (!diff?.removed || diff?.removed.size === 0) {
      return [];
    }
    const result: Set<string> = new Set();
    mergeChanges(diff.removed, result);

    return Array.from(result.values());
  }, [diff]);

  return (
    <div className={styles.variable_container}>
      {addsAndChanges.length > 0 && (
        <>
          <h3>{localize('terminal.environment.changes')}</h3>
          {addsAndChanges.map((c, idx) => (
            <p key={c + idx} className={styles.variable_change}>
              {c}
            </p>
          ))}
        </>
      )}
      {removals.length > 0 && (
        <>
          <h3>{localize('terminal.environment.removal')}</h3>
          {removals.map((c, idx) => (
            <p key={c + idx} className={styles.variable_change}>
              {c}
            </p>
          ))}
        </>
      )}
    </div>
  );
};
