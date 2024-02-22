import React from 'react';

import {
  CommandService,
  FILE_COMMANDS,
  FileUri,
  IWindowService,
  URI,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IMessageService } from '@opensumi/ide-overlay';

import { IWelcomeMetaData } from './common';
import styles from './welcome.module.less';

export const EditorWelcomeComponent: ReactEditorComponent<IWelcomeMetaData> = ({ resource }) => {
  const commandService: CommandService = useInjectable<CommandService>(CommandService);
  const windowService: IWindowService = useInjectable<IWindowService>(IWindowService);
  const fileService: IFileServiceClient = useInjectable<IFileServiceClient>(IFileServiceClient);
  const messageService: IMessageService = useInjectable<IMessageService>(IMessageService);

  return (
    <div className={styles.welcome}>
      <div>
        <h1>{localize('welcome.quickStart')}</h1>
        <div>
          <a
            onClick={() => {
              commandService.executeCommand(FILE_COMMANDS.OPEN_FOLDER.id, { newWindow: false });
            }}
          >
            {localize('file.open.folder')}
          </a>
        </div>
      </div>
      <div>
        <h1>{localize('welcome.recent.workspace')}</h1>
        {resource.metadata?.recentWorkspaces.map((workspace) => {
          let workspacePath = workspace;
          if (workspace.startsWith('file://')) {
            workspacePath = FileUri.fsPath(workspace);
          }
          return (
            <div key={workspace} className={styles.recentRow}>
              <a
                onClick={async () => {
                  const uri = new URI(workspace);
                  const exist = await fileService.getFileStat(uri.toString());
                  if (exist) {
                    windowService.openWorkspace(uri, { newWindow: false });
                  } else {
                    messageService.error(localize('welcome.workspace.noExist'));
                  }
                }}
              >
                {workspacePath}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
};
