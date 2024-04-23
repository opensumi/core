import React, { FC, useCallback, useEffect, useState } from 'react';

import { IInputBaseProps } from '@opensumi/ide-components';
import { DisposableStore, isMacintosh, strings, useDesignStyles, useInjectable } from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { IContextMenu } from '@opensumi/ide-core-browser/lib/menu/next';
import { useHotKey } from '@opensumi/ide-core-browser/lib/react-hooks/hot-key';
import { CommandService, isFunction } from '@opensumi/ide-core-common';
import { AutoFocusedInput } from '@opensumi/ide-main-layout/lib/browser/input';
import { IIconService } from '@opensumi/ide-theme';

import { ISCMProvider, ISCMRepository, InputValidationType, scmContainerId } from '../../common';

import styles from './scm-resource-input.module.less';

export function convertValidationType(type: InputValidationType) {
  return ['info', 'warning', 'error'][type];
}

function getPlaceholder(repository: ISCMRepository) {
  return strings.format(repository.input.placeholder, isMacintosh ? '⌘Enter' : 'Ctrl+Enter');
}

export const SCMResourceInput: FC<{
  repository: ISCMRepository;
  menus?: IContextMenu;
}> = ({ repository, menus }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const iconService = useInjectable<IIconService>(IIconService);
  const styles_scmMenu = useDesignStyles(styles.scmMenu, 'scmMenu');

  const [commitMsg, setCommitMsg] = useState('');
  const [placeholder, setPlaceholder] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [inputProps, setInputProps] = useState<IInputBaseProps>({});

  const handleValueChange = useCallback(
    (msg: string) => {
      repository.input.value = msg;
    },
    [repository],
  );

  const handleInputProps = useCallback(
    (props: IInputBaseProps) => {
      const { addonAfter, addonBefore } = props;
      const AFC = addonAfter;
      const ABC = addonBefore;

      setInputProps({
        ...props,
        ...(addonAfter
          ? {
              addonAfter: isFunction<React.FunctionComponent>(AFC) ? <AFC /> : addonAfter,
            }
          : {}),
        ...(addonBefore
          ? {
              addonBefore: isFunction<React.FunctionComponent>(ABC) ? <ABC /> : addonBefore,
            }
          : {}),
      });
    },
    [repository.input.props],
  );

  useEffect(() => {
    if (repository.input.props) {
      handleInputProps(repository.input.props);
    }
  }, [repository.input.props]);

  useEffect(() => {
    const disposables = new DisposableStore();

    disposables.add(
      repository.input.onDidChangeProps((props) => {
        handleInputProps(props);
      }),
    );

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

    disposables.add(
      repository.input.onDidChangeEnablement((value) => {
        setEnabled(value);
      }),
    );

    setPlaceholder(getPlaceholder(repository));

    return () => {
      disposables.dispose();
    };
  }, [repository]);

  const handleCommit = useCallback(() => {
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
  const hasInputMenus = repository && repository.provider && menus;

  return (
    <>
      <div className={styles.scmHeader}>
        <AutoFocusedInput
          containerId={scmContainerId}
          className={styles.scmInput}
          placeholder={placeholder}
          value={commitMsg}
          disabled={!enabled}
          onKeyDown={(e) => onKeyDown(e.keyCode)}
          onKeyUp={onKeyUp}
          onValueChange={handleValueChange}
          {...inputProps}
        />
      </div>
      {hasInputMenus && (
        <InlineMenuBar<ISCMProvider, string>
          className={styles_scmMenu}
          context={[repository.provider, commitMsg]}
          type='button'
          moreIcon='down'
          iconService={iconService}
          // limit show one nav menu only
          regroup={(nav, more) => [[nav[0]].filter(Boolean), [...nav.slice(1), ...more]]}
          menus={menus}
        />
      )}
    </>
  );
};

SCMResourceInput.displayName = 'SCMResourceInput';
