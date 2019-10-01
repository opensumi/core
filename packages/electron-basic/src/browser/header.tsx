import { observer } from 'mobx-react-lite';
import * as React from 'react';
import * as styles from './header.module.less';
import { useInjectable, IEventBus, MaybeNull, isWindows, SlotRenderer, ComponentRegistry, Disposable, DomListener } from '@ali/ide-core-browser';
import { IElectronMainUIService } from '@ali/ide-core-common/lib/electron';
import { WorkbenchEditorService, IResource } from '@ali/ide-editor';
import { IWindowService } from '@ali/ide-window';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export const ElectronHeaderBar = observer(() => {

  const uiService = useInjectable(IElectronMainUIService) as IElectronMainUIService;
  const windowService: IWindowService = useInjectable(IWindowService);
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);

  return <div className={styles.header} onDoubleClick={() => {
    uiService.maximize((global as any).currentWindowId);
  }}>
    {
      (isWindows) ? <SlotRenderer Component={componentRegistry.getComponentRegistryInfo('@ali/ide-menu-bar')!.views[0].component!}/> : null
    }
    <TitleInfo />
    {
      (isWindows) ? <div className={styles.windowActions}>
        <div className={getIcon('windows_mini')} onClick= {() => {
          windowService.minimize();
        }} />
        <div className={getIcon('windows_recover')} onClick= {() => {
          windowService.maximize();
        }}/>
        <div className={getIcon('windows_quit')} onClick= {() => {
          windowService.close();
        }}/>
      </div> : undefined
    }
  </div>;

});

declare const ResizeObserver: any;

export const TitleInfo = observer(() => {

  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorService;
  const [currentResource, setCurrentResource] = React.useState<MaybeNull<IResource>>(undefined);
  const ref = React.useRef<HTMLDivElement>();

  React.useEffect(() => {
    setPosition();
    const disposer = new Disposable();
    disposer.addDispose(editorService.onActiveResourceChange((resource) => {
      setCurrentResource(resource);
    }));
    disposer.addDispose(new DomListener(window, 'resize', () => {
      setPosition();
    }));
    if (ref.current && ref.current.previousElementSibling) {
      const resizeObserver = new ResizeObserver(setPosition);
      resizeObserver.observe(ref.current.previousElementSibling);
      disposer.addDispose({
        dispose : () => {
          resizeObserver.disconnect();
        },
      });
    }
    return disposer.dispose.bind(disposer);
  }, []);

  function setPosition() {
    if (ref.current) {
      const windowWidth = window.innerWidth;
      let prevWidth = 0;
      let node = ref.current.previousElementSibling;
      while (node) {
        prevWidth += (node as HTMLElement).offsetWidth;
        node = node.previousElementSibling;
      }
      const left = Math.max(0, windowWidth * 0.5 - prevWidth);
      ref.current.style.paddingLeft = left + 'px';
    }
  }

  return <div className={styles.title_info} ref={ref as any}><span>{ currentResource ? currentResource.name + ' -- ' : null} Electron IDE</span></div>;
});
