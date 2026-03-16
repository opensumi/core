import cls from 'classnames';
import * as React from 'react';

import { useInjectable } from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser/lib/components';

import { ShowPermissionDialogParams } from '../acp';
import { AcpPermissionBridgeService } from '../acp/permission-bridge.service';
import { PermissionDialogManager } from '../acp/permission-dialog-container';

import styles from './permission-dialog-widget.module.less';

export interface PermissionDialogWidgetProps {
  dialogManager: PermissionDialogManager;
  bottom: number;
}

export const PermissionDialogWidget: React.FC<PermissionDialogWidgetProps> = ({ dialogManager, bottom }) => {
  const [dialogs, setDialogs] = React.useState<Array<{ requestId: string; params: ShowPermissionDialogParams }>>([]);
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const permissionBridgeService = useInjectable<AcpPermissionBridgeService>(AcpPermissionBridgeService);

  React.useEffect(() => {
    const unsubscribe = dialogManager.subscribe((newDialogs) => {
      setDialogs(newDialogs);
      setFocusedIndex(0);
    });
    const initialDialogs = dialogManager.getDialogs();
    setDialogs(initialDialogs);
    return unsubscribe;
  }, [dialogManager]);

  React.useEffect(() => {
    if (dialogs.length > 0) {
      window.addEventListener('keydown', handleKeyboard);
      containerRef.current?.focus();
    }
    return () => window.removeEventListener('keydown', handleKeyboard);
  }, [dialogs.length, dialogs]);

  const handleKeyboard = (e: KeyboardEvent) => {
    if (dialogs.length === 0) {
      return;
    }
    const options = dialogs[0].params.options || [];

    if (e.key === 'ArrowDown') {
      e.preventDefault();

      setFocusedIndex((prev) => Math.min(prev + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();

      setFocusedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const option = options[focusedIndex];
      if (option) {
        // 通知 Bridge Service 用户决策
        permissionBridgeService.handleUserDecision(dialogs[0].requestId, option.optionId, option.kind);
        dialogManager.removeDialog(dialogs[0].requestId);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      dialogManager.removeDialog(dialogs[0].requestId);
      // Escape 视为超时/取消
      permissionBridgeService.handleDialogClose(dialogs[0].requestId);
    }
  };

  if (dialogs.length === 0) {
    return null;
  }

  const current = dialogs[0];
  const params = current.params;

  // 智能标题
  let smartTitle = params.title || 'Permission Required';
  if (params.kind === 'edit' || params.kind === 'write') {
    smartTitle = `Make this edit to ${params.locations?.[0]?.path?.split('/').pop() || 'file'}?`;
  } else if (params.kind === 'execute' || params.kind === 'bash') {
    smartTitle = 'Allow this bash command?';
  } else if (params.kind === 'read') {
    smartTitle = `Allow read from ${params.locations?.[0]?.path?.split('/').pop() || 'file'}?`;
  }

  const shouldShowContent = params.content;

  return (
    <div
      ref={containerRef}
      className={styles.permission_dialog_container}
      style={{ bottom: `calc(100% + ${bottom + 8}px)` }}
      tabIndex={0}
    >
      <div className={styles.permission_dialog}>
        {/* 标题栏 */}
        <div className={cls(styles.header, shouldShowContent && styles.has_content)}>
          <div className={styles.title}>
            <span className={styles.warning_icon}>!</span>
            {smartTitle}
          </div>
          <button
            className={styles.close_button}
            onClick={() => {
              permissionBridgeService.handleDialogClose(current.requestId);
              dialogManager.removeDialog(current.requestId);
            }}
          >
            <span className={getIcon('close')} />
          </button>
        </div>

        {/* 内容 */}
        {shouldShowContent && params.content && <div className={styles.content}>{params.content}</div>}

        {/* 选项 */}
        <div className={styles.options}>
          {(params.options || []).map((option, index) => {
            const isFocused = focusedIndex === index;
            return (
              <button
                key={option.optionId}
                className={cls(styles.option_button, isFocused && 'focused')}
                onClick={() => {
                  permissionBridgeService.handleUserDecision(current.requestId, option.optionId, option.kind);
                  dialogManager.removeDialog(current.requestId);
                }}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                <span className={styles.option_key}>{index + 1}</span>
                <span className={styles.option_text}>{option.name || option.optionId}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
