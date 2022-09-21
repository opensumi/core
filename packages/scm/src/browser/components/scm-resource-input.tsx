import React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { strings, isMacintosh, DisposableStore } from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { useHotKey } from '@opensumi/ide-core-browser/lib/react-hooks/hot-key';
import { CommandService } from '@opensumi/ide-core-common';
import { AutoFocusedInput } from '@opensumi/ide-main-layout/lib/browser/input';

import { ISCMRepository, InputValidationType, ISCMProvider, scmContainerId } from '../../common';
import { ViewModelContext } from '../scm-model';

import styles from './scm-resource-input.module.less';

export function convertValidationType(type: InputValidationType) {
  return ['info', 'warning', 'error'][type];
}

function getPlaceholder(repository: ISCMRepository) {
  return strings.format(repository.input.placeholder, isMacintosh ? '⌘Enter' : 'Ctrl+Enter');
}

function hasGitChange(repository: ISCMRepository) {
  for (const change of repository.provider.groups.elements) {
    if (change.elements.length > 0) {
      return true;
    }
  }
  return false;
}

export const SCMResourceInput: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  const [commitMsg, setCommitMsg] = React.useState('');
  const [placeholder, setPlaceholder] = React.useState('');

  const handleValueChange = React.useCallback(
    (msg: string) => {
      repository.input.value = msg;
    },
    [repository],
  );

  React.useEffect(() => {
    const disposables = new DisposableStore();
    // 单向同步 input value
    disposables.add(
      repository.input.onDidChange((value) => {
        setCommitMsg(value);
      }),
    );

    // 单向同步 input placeholder
    disposables.add(
      repository.input.onDidChangePlaceholder(() => {
        setPlaceholder(getPlaceholder(repository));
      }),
    );
    setPlaceholder(getPlaceholder(repository));

    return () => {
      disposables.dispose();
    };
  }, [repository]);

  const handleCommit = React.useCallback(() => {
    if (!repository || !repository.provider.acceptInputCommand) {
      return;
    }

    const { id: commandId, arguments: args = [] } = repository.provider.acceptInputCommand;
    if (!commandId) {
      return;
    }

    commandService.executeCommand(commandId, ...args);
  }, [repository]);

  const { onKeyDown, onKeyUp } = useHotKey([isMacintosh ? 'command' : 'ctrl', 'enter'], handleCommit);

  const inputMenu = React.useMemo(() => {
    const menus = viewModel.menus.getRepositoryMenus(repository.provider);
    if (menus) {
      return menus.inputMenu;
    }
  }, [repository]);

  const hasInlineMenu = repository && repository.provider && inputMenu;

  return (
    <>
      <div className={styles.scmHeader}>
        <AutoFocusedInput
          containerId={scmContainerId}
          className={styles.scmInput}
          placeholder={placeholder}
          value={commitMsg}
          onKeyDown={(e) => onKeyDown(e.keyCode)}
          onKeyUp={onKeyUp}
          onValueChange={handleValueChange}
        />
      </div>
      {hasInlineMenu && (
        <InlineMenuBar<ISCMProvider, string>
          className={styles.scmMenu}
          context={[repository.provider, commitMsg]}
          type='button'
          moreIcon='down'
          // limit show one nav menu only
          regroup={(nav, more) => [[nav[0]].filter(Boolean), [...nav.slice(1), ...more]]}
          menus={inputMenu}
        />
      )}
    </>
  );
};

SCMResourceInput.displayName = 'SCMResourceInput';
