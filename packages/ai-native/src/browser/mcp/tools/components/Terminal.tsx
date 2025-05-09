import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { PreferenceService, useInjectable } from '@opensumi/ide-core-browser';
import { Button, Icon } from '@opensumi/ide-core-browser/lib/components';
import { EnhancePopover } from '@opensumi/ide-core-browser/lib/components/ai-native/popover';
import { Loading } from '@opensumi/ide-core-browser/lib/components/loading';
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

const autoExecutionPolicyLabels: { [k in ETerminalAutoExecutionPolicy]: string } = {
  [ETerminalAutoExecutionPolicy.always]: 'ai.native.terminal.autorun.always',
  [ETerminalAutoExecutionPolicy.auto]: 'ai.native.terminal.autorun.auto',
  [ETerminalAutoExecutionPolicy.off]: 'ai.native.terminal.autorun.off',
};

function getAutoExecutionPolicyLabels(k: ETerminalAutoExecutionPolicy) {
  return localize(autoExecutionPolicyLabels[k]);
}

export const TerminalToolComponent = memo((props: IMCPServerToolComponentProps) => {
  const { args, toolCallId } = props;
  const handler = useInjectable<RunCommandHandler>(RunCommandHandler);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const commandService = useInjectable<CommandService>(CommandService);

  const [running, toggleRunning] = useState(false);

  const terminalAutoExecution = preferenceService.get<ETerminalAutoExecutionPolicy>(
    AINativeSettingSectionsId.TerminalAutoRun,
  );

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

  useEffect(() => {
    if (props.state === 'result') {
      toggleRunning(false);
    } else if (!needApproval) {
      toggleRunning(true);
    }
  }, [props]);

  const openCommandAutoExecutionConfig = useCallback(() => {
    commandService.executeCommand('workbench.action.openSettings', 'ai.native.terminal.autorun');
  }, []);

  const handleClick = useCallback((approval: boolean) => {
    if (!toolCallId) {
      return;
    }
    handler.handleApproval(toolCallId, approval);
    toggleRunning(true);
  }, []);

  const output = useMemo(() => {
    if (props.result) {
      return getResult(props.result);
    }
    return null;
  }, [props]);

  return (
    <div className={styles.run_cmd_tool}>
      <div>
        <div className={styles.command_title}>
          <Icon icon='terminal' />
          <span>
            {needApproval
              ? localize('ai.native.mcp.terminal.allow-question')
              : localize('ai.native.mcp.terminal.command')}
          </span>
        </div>
        <p className={styles.command_content}>
          <code>$ {args?.command}</code>
        </p>
        <p className={styles.comand_description}>{args?.explanation}</p>
        {props.state === 'complete' && needApproval && args && !running && (
          <div className={styles.cmmand_footer}>
            <Button type='link' size='small' onClick={() => handleClick(true)}>
              {localize('ai.native.mcp.terminal.allow')}
            </Button>
            <Button type='link' size='small' onClick={() => handleClick(false)}>
              {localize('ai.native.mcp.terminal.deny')}
            </Button>
          </div>
        )}
        {props.state === 'result' && output && (
          <>
            <div className={styles.command_content}>
              <Icon icon='output' />
              <code dangerouslySetInnerHTML={{ __html: computeAnsiLogString(output.text || '') }} />
            </div>

            <div className={styles.auto_execution_policy}>
              <span className={styles.auto_execution_policy_label}>
                {getAutoExecutionPolicyLabels(terminalAutoExecution || ETerminalAutoExecutionPolicy.auto)}
              </span>
              <EnhancePopover id='policy-config-popover' title={localize('ai.native.terminal.autorun.command')}>
                <Icon size='small' iconClass='codicon codicon-settings-gear' onClick={openCommandAutoExecutionConfig} />
              </EnhancePopover>
            </div>
          </>
        )}
      </div>
      {running && (
        <div className={styles.running}>
          <Loading />
          <span>{localize('ai.native.terminal.autorun.running')}</span>
        </div>
      )}
    </div>
  );
});
