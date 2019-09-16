import * as React from 'react';
import { useInjectable, URI } from '@ali/ide-core-browser';
import { WorkbenchEditorService, IResource } from '@ali/ide-editor';
import { WorkspaceService } from '@ali/ide-workspace/lib/browser/workspace-service';
import { Path } from '@ali/ide-core-common/lib/path';
import * as styles from './navigation.module.less';
import { observer } from 'mobx-react-lite';
import { AppConfig } from '@ali/ide-core-browser';

export const  NavigationBar = (() => {

  const service = useInjectable(WorkbenchEditorService) as WorkbenchEditorService;
  const workspace = useInjectable(WorkspaceService) as WorkspaceService;
  // TODO support more
  const topRoot: URI = URI.file((useInjectable(AppConfig) as AppConfig).workspaceDir);
  const currentResource = service.currentResource;

  const [parts, setParts] = React.useState<string[]>((!currentResource ? [ topRoot.displayName ] : getParts(currentResource, topRoot)));

  React.useEffect(() => {
    const disposer = service.onActiveResourceChange((resource) => {
      setParts((!resource ? [ topRoot.displayName ] : getParts(resource, topRoot)));
    });
    return disposer.dispose;
  });

  return <div className={styles.navigation}>
    {
      parts.map((p, i) => {
        return <span className={styles['navigation-part']} key={i}>{p}</span>;
      })
    }
  </div>;
});

function getParts(resource: IResource, root: URI): string[] {
  if (resource.uri.scheme === 'file') {
    const relative = root.relative(resource.uri);
    const parts =  relative ? relative.toString().split(Path.separator) : [ resource.name ];
    parts.unshift(root.displayName);
    return parts;
  } else {
    return [ root.displayName, resource.name ];
  }
}

export interface IPart {
  name: string;
  iconClass: string;
}
