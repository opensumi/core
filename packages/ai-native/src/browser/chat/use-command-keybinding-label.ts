import React from 'react';

import { KeybindingRegistry, useInjectable } from '@opensumi/ide-core-browser';
import { isMacintosh } from '@opensumi/ide-core-common';

export function useCommandKeybindingLabel(commandId: string): string {
  const keybindingRegistry = useInjectable<KeybindingRegistry>(KeybindingRegistry);
  const resolveLabel = React.useCallback(() => {
    const keybindings = keybindingRegistry.getKeybindingsForCommand(commandId);
    if (keybindings.length === 0) {
      return '';
    }
    const binding = keybindings.reduce((current, candidate) =>
      (candidate.priority || 0) > (current.priority || 0) ? candidate : current,
    );
    return keybindingRegistry.acceleratorFor(binding, isMacintosh ? '' : '+').join(' ');
  }, [commandId, keybindingRegistry]);
  const [label, setLabel] = React.useState(resolveLabel);

  React.useEffect(() => {
    setLabel(resolveLabel());
    const disposable = keybindingRegistry.onKeybindingsChanged(({ affectsCommands }) => {
      if (affectsCommands.includes(commandId)) {
        setLabel(resolveLabel());
      }
    });
    return () => disposable.dispose();
  }, [commandId, keybindingRegistry, resolveLabel]);

  return label;
}
