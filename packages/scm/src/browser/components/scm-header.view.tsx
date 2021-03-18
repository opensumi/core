import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { isOSX, CommandService, DisposableStore } from '@ali/ide-core-common';
import { format } from '@ali/ide-core-common/lib/utils/strings';
import { useHotKey } from '@ali/ide-core-browser/lib/react-hooks/hot-key';
import { Input } from '@ali/ide-components';
import { InlineMenuBar } from '@ali/ide-core-browser/lib/components/actions';

import { ISCMRepository, InputValidationType, ISCMProvider } from '../../common';
import { ViewModelContext } from '../scm-model';

import * as styles from './scm-header.module.less';

export function convertValidationType(type: InputValidationType) {
  return ['info', 'warning', 'error'][type];
}

function getPlaceholder(repository: ISCMRepository) {
  return format(repository.input.placeholder, isOSX ? '⌘Enter' : 'Ctrl+Enter');
}

export const SCMHeader: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const viewModel = useInjectable<ViewModelContext>(ViewModelContext);

  const [ commitMsg, setCommitMsg ] = React.useState('');
  const [ placeholder, setPlaceholder] = React.useState('');

  const handleValueChange = React.useCallback((msg: string) => {
    // todo: 校验貌似并不需要
    // repository.input.validateInput(msg, inputRef.current!.selectionStart || 0)
    //   .then((result) => {
    //     if (!result) {
    //       console.log('validation passed');
    //     } else {
    //       console.log('validation failed');
    //       console.log({ content: result.message, type: result.type });
    //     }
    //   });

    // 上层只有存在 repository 时才会渲染 Header 部分
    repository.input.value = msg;
  }, [ repository ]);

  React.useEffect(() => {
    const disposables = new DisposableStore();

    // 单向同步 input value
    disposables.add(repository.input.onDidChange((value) => {
      setCommitMsg(value);
    }));
    // 单向同步 input placeholder
    disposables.add(repository.input.onDidChangePlaceholder(() => {
      setPlaceholder(getPlaceholder(repository));
    }));
    setPlaceholder(getPlaceholder(repository));

    return () => {
      disposables.dispose();
    };
  }, [ repository ]);

  const handleCommit = React.useCallback(() => {
    if (!repository || !repository.provider.acceptInputCommand) {
      return;
    }

    const { id: commandId, arguments: args = [] } = repository.provider.acceptInputCommand;
    if (!commandId) {
      return;
    }

    commandService.executeCommand(commandId, ...args).then(() => {
      setCommitMsg('');
    });
  }, [ repository ]);

  const { onKeyDown, onKeyUp } = useHotKey(
    [ isOSX ? 'command' : 'ctrl', 'enter' ],
    handleCommit,
  );

  const inputMenu = React.useMemo(() => {
    const scmMenuService = viewModel.getSCMMenuService(repository);
    if (scmMenuService) {
      return scmMenuService.getInputMenu();
    }
  }, [ repository ]);

  return (
    <div className={styles.scmHeader}>
      <Input
        className={styles.scmInput}
        placeholder={placeholder}
        value={commitMsg}
        onKeyDown={(e) => onKeyDown(e.keyCode)}
        onKeyUp={onKeyUp}
        onValueChange={handleValueChange}
      />
      {
        repository && repository.provider && inputMenu && (
          <InlineMenuBar<ISCMProvider, string>
            className={styles.scmMenu}
            context={[repository.provider, commitMsg]}
            type='button'
            // limit show one nav menu only
            regroup={(nav, more) => [[nav[0]].filter(Boolean), [...nav.slice(1), ...more]]}
            menus={inputMenu} />
        )
      }
    </div>
  );
};
