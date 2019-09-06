import * as React from 'react';
import { IWelcomeMetaData } from './common';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, IElectronNativeDialogService, localize, FileUri, URI } from '@ali/ide-core-browser';
import { IWorkspaceService } from '@ali/ide-workspace';
import * as styles from './welcome.module.less';
import { IWindowService } from '@ali/ide-window';

export const EditorWelcomeComponent: ReactEditorComponent<IWelcomeMetaData> = ({resource}) => {

  const dialogService: IElectronNativeDialogService = useInjectable(IElectronNativeDialogService);
  const windowService: IWindowService = useInjectable(IWindowService);

  return <div className={styles.welcome}>
    <div>
      <h1>开始使用</h1>
      <div>
        <a onClick={() => {
          dialogService.showOpenDialog({
            title: localize('workspace.open-directory'),
            properties: [
              'openDirectory',
            ],
          }).then((paths) => {
            if (paths && paths.length > 0) {
              windowService.openWorkspace(URI.file(paths[0]));
            }
          });
        }}>打开文件夹</a>
      </div>
    </div>
    <div>
      <h1>最近的工作区</h1>
      {resource.metadata!.recentWorkspaces.map((workspace) => {
        let workspacePath = workspace;
        if (workspace.startsWith('file://')) {
          workspacePath = FileUri.fsPath(workspace);
        }
        return <div key={workspace}><a onClick={() => {
          windowService.openWorkspace(new URI(workspace), {newWindow: true});
        }}>{workspacePath}</a></div>;
      })}
    </div>
  </div>;

};
