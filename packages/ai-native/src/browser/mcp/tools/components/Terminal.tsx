import React, { memo, useCallback, useMemo, useState } from 'react';

import { PreferenceService, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';
import { CommandService, localize } from '@opensumi/ide-core-common';
import { AINativeSettingSectionsId } from '@opensumi/ide-core-common/lib/settings';

import { ETerminalAutoExecutionPolicy } from '../../../preferences/schema';
import { IMCPServerToolComponentProps } from '../../../types';
import { RunCommandHandler } from '../handlers/RunCommand';

import { computeAnsiLogString } from './computeAnsiLogString';
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
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const commandService = useInjectable<CommandService>(CommandService);

  const [disabled, toggleDisabled] = useState(false);
  const [showPolicy, toggleShowPolicy] = useState(false);

  const terminalAutoExecution = preferenceService.get(AINativeSettingSectionsId.TerminalAutoRun);

  const needApproval = useMemo(() => {
    // 值为 off 或 auto 且 args.require_user_approval
    if (
      terminalAutoExecution === ETerminalAutoExecutionPolicy.off ||
      (terminalAutoExecution === ETerminalAutoExecutionPolicy.auto && props.args?.require_user_approval)
    ) {
      return true;
    }

    return false;
  }, [props.args]);

  const openCommandAutoExecutionConfig = useCallback(() => {
    commandService.executeCommand('workbench.action.openSettings', 'ai.native.terminal.autorun');
  }, []);

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
                <span>{localize('ai.native.mcp.terminal.command')}:</span>
              </div>
              <p className={styles.command_content}>
                <code>$ {args.command}</code>
              </p>
            </>
          )}
          {output ? (
            <div className={styles.command_content}>
              <Icon icon='output' />
              <code dangerouslySetInnerHTML={{ __html: computeAnsiLogString(output.text || '') }} />
              {needApproval && (
                <div className={styles.auto_execution_policy}>
                  <span className={styles.auto_execution_policy_title} onClick={() => toggleShowPolicy(!showPolicy)}>
                    {showPolicy ? (
                      <Icon iconClass='codicon codicon-chevron-down' />
                    ) : (
                      <Icon iconClass='codicon codicon-chevron-right' />
                    )}
                    {localize('ai.native.terminal.autorun.denied')}
                  </span>
                  {showPolicy && (
                    <>
                      <span>{localize('ai.native.terminal.autorun.question')}</span>
                      <span className={styles.auto_execution_policy_conf} onClick={openCommandAutoExecutionConfig}>
                        {localize('ai.native.terminal.autorun.command')}
                      </span>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            ''
          )}
        </div>
      )}

      {props.state === 'complete' && needApproval && args && (
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
