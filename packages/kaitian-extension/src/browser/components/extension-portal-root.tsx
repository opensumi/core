import * as React from 'react';
import * as clx from 'classnames';
import { useInjectable } from '@ali/ide-core-browser';
import { ExtensionService } from '../../common';
import { getThemeTypeSelector, IThemeService, ThemeType } from '@ali/ide-theme/lib/common';
import { DisposableCollection } from '@ali/ide-components/lib/utils/disposable';

interface IPortalRootProps {
  original: React.FC;
  otherProps: any;
  extensionId: string;
}

export const PortalRoot = (props: IPortalRootProps) => {
  const [themeType, setThemeType] = React.useState<null | ThemeType>(null);
  const extensionService = useInjectable<ExtensionService>(ExtensionService);
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
