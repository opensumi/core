import React from 'react';

import { FILE_COMMANDS, useInjectable } from '@opensumi/ide-core-browser';
import { CommandService, localize } from '@opensumi/ide-core-common';

import styles from './file-tree.module.less';

export const EmptyTreeView = () => {
  const commandService: CommandService = useInjectable(CommandService);

  const openFolder = () => {
    commandService.executeCommand(FILE_COMMANDS.OPEN_FOLDER.id, { newWindow: false });
  };

  return (
    <div>
      <div className={styles.empty_view}>
        <p>{localize('file.empty.defaultMessage')}</p>
        <a className={styles.empty_button} onClick={openFolder}>
          {localize('file.empty.openFolder')}
        </a>
      </div>
    </div>
  );
};
