import React, { useEffect, useState } from 'react';

import { Button, Dialog, Icon } from '@opensumi/ide-components';

import styles from './permission-dialog.module.less';

import type { PermissionOptionKind, ToolCallLocation } from '../../common/acp-types';

export interface PermissionDialogProps {
  visible: boolean;
  requestId: string;
  title: string;
  kind?: string;
  content?: string;
  locations?: ToolCallLocation[];
  command?: string;
  options: Array<{
    optionId: string;
    name: string;
    kind: PermissionOptionKind;
  }>;
  timeout: number;
  onSelect: (requestId: string, optionId: string, kind: PermissionOptionKind) => void;
  onClose: (requestId: string) => void;
}

export const PermissionDialog: React.FC<PermissionDialogProps> = ({
  visible,
  requestId,
  title,
  kind,
  content,
  locations,
  command,
  options,
  timeout,
  onSelect,
  onClose,
}) => {
  const [remainingTime, setRemainingTime] = useState(timeout);
  // const [theme] = useDesignTheme();

  // Countdown timer
  useEffect(() => {
    if (!visible || remainingTime <= 0) {
      return;
    }

    const interval = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 100) {
          clearInterval(interval);
          onClose(requestId);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [visible, remainingTime, requestId, onClose]);

  const handleOptionSelect = (optionId: string, kind: PermissionOptionKind) => {
    onSelect(requestId, optionId, kind);
  };

  const getIconForKind = (kind?: string) => {
    switch (kind) {
      case 'write':
      case 'edit':
        return 'edit';
      case 'read':
        return 'eye';
      case 'command':
        return 'terminal';
      case 'search':
        return 'search';
      default:
        return 'file';
    }
  };

  // const progressPercent = (remainingTime / timeout) * 100;

  return (
    <Dialog
      visible={visible}
      title={title || 'Permission Request'}
      // icon={getIconForKind(kind)||''}
      onClose={() => onClose(requestId)}
      footer={
        <div className={styles.dialogFooter}>
          {options.map((option) => (
            <Button
              key={option.optionId}
              type={option.kind.includes('reject') ? 'danger' : 'primary'}
              onClick={() => handleOptionSelect(option.optionId, option.kind)}
            >
              {option.name}
            </Button>
          ))}
        </div>
      }
      message={undefined}
    >
      <div className={styles.permissionContent}>
        {/* Permission details */}
        <div className={styles.permissionDetails}>
          {kind && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Operation:</span>
              <span className={styles.detailValue}>
                <Icon icon={getIconForKind(kind)} />
                {kind.charAt(0).toUpperCase() + kind.slice(1)}
              </span>
            </div>
          )}

          {/* Show command if present */}
          {command && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Command:</span>
              <code className={styles.commandCode}>{command}</code>
            </div>
          )}

          {/* Show affected files/paths */}
          {locations && locations.length > 0 && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Affected:</span>
              <div className={styles.locationList}>
                {locations.map((loc, idx) => (
                  <span key={idx} className={styles.locationItem}>
                    <Icon icon='file' />
                    {loc.path}
                    {loc.line && `:${loc.line}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Show diff/content preview if available */}
          {content && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Preview:</span>
              <div className={styles.contentPreview}>
                <pre>
                  {content.substring(0, 500)}
                  {content.length > 500 ? '...' : ''}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Timeout progress */}
        <div className={styles.timeoutSection}>
          <div className={styles.timeoutHeader}>
            <span>Auto-reject in</span>
            <span className={styles.timeoutValue}>{Math.ceil(remainingTime / 1000)}s</span>
          </div>
          {/* <Progress
            value={progressPercent}
            color={remainingTime < 10000 ? '#f5222d' : theme.colorPrimary}
            size='small'
          /> */}
        </div>

        {/* Warning message */}
        <div className={styles.warningMessage}>
          <Icon icon='info' />
          <span>This operation was requested by the AI agent. Please review carefully.</span>
        </div>
      </div>
    </Dialog>
  );
};

export default PermissionDialog;
