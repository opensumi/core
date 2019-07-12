import { observer } from 'mobx-react-lite';
import * as React from 'react';
import * as styles from './header.module.less';
import { useInjectable, IEventBus, MaybeNull } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { WorkbenchEditorService, IResource } from '@ali/ide-editor';

export const ElectronHeaderBar = observer(() => {

  const uiService = useInjectable(IElectronMainUIService) as IElectronMainUIService;
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorService;

  const [currentResource, setCurrentResource] = React.useState<MaybeNull<IResource>>(undefined);

  React.useEffect(() => {
    return editorService.onActiveResourceChange((resource) => {
      setCurrentResource(resource);
    }).dispose;
  }, []);

  return <div className={styles.header} onDoubleClick={() => {
    uiService.maximize((global as any).currentWindowId);
  }}>
    { currentResource ? currentResource.name + ' -- ' : null}
    Electron IDE
  </div>;

});
