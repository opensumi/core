import React from 'react';
import { IWelcomeMetaData } from './common';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, localize, FileUri, URI, CommandService, FILE_COMMANDS, IWindowService } from '@ali/ide-core-browser';
import styles from './welcome.module.less';

export const EditorWelcomeComponent: ReactEditorComponent<IWelcomeMetaData> = ({resource}) => {

  const commandService: CommandService = useInjectable(CommandService);
  const windowService: IWindowService = useInjectable(IWindowService);

  return <div className={styles.welcome}>
    <div>
      <h1>{localize('welcome.quckstart')}</h1>
      <div>
        <a onClick={() => {
          commandService.executeCommand(FILE_COMMANDS.OPEN_FOLDER.id, {newWindow: false});
        }}>{localize('file.open.folder')}</a>
      </div>
    </div>
    <div>
      <h1>{localize('welcome.recent.workspace')}</h1>
      {resource.metadata!.recentWorkspaces.map((workspace) => {
        let workspacePath = workspace;
        if (workspace.startsWith('file://')) {
          workspacePath = FileUri.fsPath(workspace);
        }
        return <div key={workspace}><a onClick={() => {
          windowService.openWorkspace(new URI(workspace), {newWindow: false});
        }}>{workspacePath}</a></div>;
      })}
    </div>
  </div>;

};
