import * as React from 'react';
import * as clx from 'classnames';
import { useInjectable } from '@ali/ide-core-browser';
import { getThemeTypeSelector, IThemeService, ThemeType } from '@ali/ide-theme/lib/common';
import { DisposableCollection } from '@ali/ide-components/lib/utils/disposable';
import { AbstractViewExtProcessService } from '../../common/extension.service';

interface IPortalRootProps {
  original: React.FC;
  otherProps: any;
  extensionId: string;
}

export const PortalRoot = (props: IPortalRootProps) => {
  const [themeType, setThemeType] = React.useState<null | ThemeType>(null);
  const extensionService = useInjectable<AbstractViewExtProcessService>(AbstractViewExtProcessService);
  const themeService = useInjectable<IThemeService>(IThemeService);

  React.useEffect(() => {
    const disposables = new DisposableCollection();
    themeService.getCurrentTheme().then((res) => setThemeType(res.type));
    disposables.push(themeService.onThemeChange((e) => {
      if (e.type && e.type !== themeType) {
        setThemeType(e.type);
      }
    }));
    return disposables.dispose.bind(disposables);
  }, []);

  const OriginalComponent = props.original;

  return (<OriginalComponent
    {...props.otherProps}
    className={clx(props.otherProps?.className, getThemeTypeSelector(themeType!))}
    getContainer={() => {
      const portalRoot = extensionService.getPortalShadowRoot(props.extensionId);
      return portalRoot;
    }}
  />);
};
