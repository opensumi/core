import React, { memo, useCallback, useMemo, useState } from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';
import { localize } from '@opensumi/ide-core-common';
import { stripAnsi } from '@opensumi/ide-utils/lib/ansi';

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
          {args && (
            <>
              <div className={styles.command_title}>
                <Icon icon='terminal' />
                <span>{localize('ai.native.mcp.terminal.command')}</span>
              </div>
              <p className={styles.command_content}>
                <code>$ {args.command}</code>
              </p>
            </>
          )}
          <div className={styles.command_title}>
            <span>{localize('ai.native.mcp.terminal.output')}</span>
          </div>
          {output ? (
            <div className={styles.command_content}>
              <code>{stripAnsi(output.text)}</code>
            </div>
          ) : (
            ''
          )}
        </div>
      )}

      {props.state === 'complete' && args?.require_user_approval && (
        <div>
          <div className={styles.command_title}>
            <Icon icon='terminal' />
            <span>{localize('ai.native.mcp.terminal.allow-question')}</span>
          </div>
          <p className={styles.command_content}>
            <code>$ {args.command}</code>
          </p>
          <p className={styles.comand_description}>{args.explanation}</p>
          <div className={styles.cmmand_footer}>
            <Button type='link' size='small' disabled={disabled} onClick={() => handleClick(true)}>
              {localize('ai.native.mcp.terminal.allow')}
            </Button>
            <Button type='link' size='small' disabled={disabled} onClick={() => handleClick(false)}>
              {localize('ai.native.mcp.terminal.deny')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
