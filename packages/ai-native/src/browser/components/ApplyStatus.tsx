import React from 'react';

import { Icon, Loading, Popover } from '@opensumi/ide-components';

import { CodeBlockStatus } from '../../common/types';

import styles from './components.module.less';

export const ApplyStatus = ({ status, error }: { status: CodeBlockStatus; error?: string }) => {
  const renderStatus = () => {
    switch (status) {
      case 'generating':
        return <Loading />;
      case 'pending':
        return (
          <Popover title='Pending' id={'edit-file-tool-status-pending'}>
            <Icon iconClass='codicon codicon-circle-large' />
          </Popover>
        );
      case 'success':
        return (
          <Popover title='Success' id={'edit-file-tool-status-success'}>
            <Icon iconClass='codicon codicon-pass' />
          </Popover>
        );
      case 'failed':
        return (
          <Popover title={`Failed (${error || 'Unknown error'})`} id={'edit-file-tool-status-failed'}>
            <Icon iconClass='codicon codicon-error' />
          </Popover>
        );
      case 'cancelled':
        return (
          <Popover title='Cancelled' id={'edit-file-tool-status-cancelled'}>
            <Icon iconClass='codicon codicon-circle-slash' style={{ color: 'var(--input-placeholderForeground)' }} />
          </Popover>
        );
      default:
        return null;
    }
  };

  return <span className={styles.status}>{renderStatus()}</span>;
};
