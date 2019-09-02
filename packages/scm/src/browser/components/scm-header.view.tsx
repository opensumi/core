import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import { isOSX, CommandService } from '@ali/ide-core-common';
import { format } from '@ali/ide-core-common/lib/utils/strings';
import TextareaAutosize from 'react-autosize-textarea';
import Hotkeys from '@ali/ide-core-browser/src/components/hotkeys';
import { FilterEvent } from 'hotkeys-js';

import { ISCMRepository, InputValidationType } from '../../common';
import * as styles from './scm-header.module.less';

export function convertValidationType(type: InputValidationType) {
  return ['info', 'warning', 'error'][type];
}

export const SCMHeader: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);

  const [ commitMsg, setCommitMsg ] = React.useState('');
  const [ placeholder, setPlaceholder] = React.useState('');
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  const handleChange = React.useCallback((msg: string) => {
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
    // 单向同步 input value
    repository.input.onDidChange((value) => {
      setCommitMsg(value);
    });
  }, []);

  React.useEffect(() => {
    // 单向同步 input placeholder
    repository.input.onDidChangePlaceholder(() => {
      const placeholder = format(repository.input.placeholder, isOSX ? '⌘Enter' : 'Ctrl+Enter');
      setPlaceholder(placeholder);
    });
  }, []);

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

  return (
    <Hotkeys
      keyName={isOSX ? 'command+enter' : 'ctrl+enter'}
      filter={(event: FilterEvent) => {
        const target = (event.target as HTMLElement) || event.srcElement;
        const tagName = target.tagName;
        return tagName === 'TEXTAREA';
      }}
      onKeyUp={handleCommit}>
      <div className={styles.scmInput}>
        <TextareaAutosize
          ref={inputRef}
          placeholder={placeholder}
          autoFocus={true}
          tabIndex={1}
          value={commitMsg}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange(e.target.value)}
          rows={1}
          maxRows={6} /* from VS Code */
        />
      </div>
    </Hotkeys>
  );
};
