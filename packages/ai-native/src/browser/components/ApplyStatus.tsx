import React from 'react';

import { Icon, Loading, Popover } from '@opensumi/ide-components';

import { CodeBlockStatus } from '../../common/types';

export const renderStatus = (status: CodeBlockStatus, error?: string) => {
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
          <Icon iconClass='codicon codicon-check-all' />
        </Popover>
      );
    case 'failed':
      return (
        <Popover title={`Failed (${error})`} id={'edit-file-tool-status-failed'}>
          <Icon iconClass='codicon codicon-error' style={{ color: 'var(--debugConsole-errorForeground)' }} />
        </Popover>
      );
    case 'cancelled':
      return (
        <Popover title='Cancelled' id={'edit-file-tool-status-cancelled'}>
          <Icon iconClass='codicon codicon-close' style={{ color: 'var(--input-placeholderForeground)' }} />
        </Popover>
      );
    default:
      return null;
  }
};
