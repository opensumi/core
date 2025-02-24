import React, { memo, useCallback, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';

import { IMCPServerToolComponentProps } from '../../../types';
import { RunCommandHandler } from '../handlers/RunCommand';

import styles from './index.module.less';

function getResult(raw: string) {
  const result: {
    isError?: boolean;
    text?: string;
  } = {};

  try {
    const data: {
      content: { type: string; text: string }[];
      isError?: boolean;
    } = JSON.parse(raw);
    if (data.isError) {
      result.isError = data.isError;
    }

    if (data.content) {
      result.text = data.content.map((item) => item.text).join('\n');
    }

    return result;
  } catch {
    return null;
  }
}

export const TerminalToolComponent = memo((props: IMCPServerToolComponentProps) => {
  const { args, toolCallId } = props;
  const handler = useInjectable<RunCommandHandler>(RunCommandHandler);
  const [disabled, toggleDisabled] = useState(false);

  const handleClick = useCallback((approval: boolean) => {
    if (!toolCallId) {
      return;
    }
    handler.handleApproval(toolCallId, approval);
    toggleDisabled(true);
  }, []);

  const output = useMemo(() => {
    if (props.result) {
      return getResult(props.result);
    }
    return null;
  }, [props]);

  return (
    <div className={styles.run_cmd_tool}>
      {props.state === 'result' && (
        <div>
          <div className={styles.command_title}>
            <Icon icon='terminal' />
            <span>输出</span>
          </div>
          {output ? <div className={styles.command_content}>{output.text}</div> : ''}
        </div>
      )}

      {props.state === 'complete' && args?.require_user_approval && (
        <div>
          <div className={styles.command_title}>
            <Icon icon='terminal' />
            <span>是否允许运行命令?</span>
          </div>
          <p className={styles.command_content}>{args.command}</p>
          <p className={styles.comand_description}>{args.explanation}</p>
          <div className={styles.cmmand_footer}>
            <Button type='link' size='small' disabled={disabled} onClick={() => handleClick(true)}>
              允许
            </Button>
            <Button type='link' size='small' disabled={disabled} onClick={() => handleClick(false)}>
              不允许
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
