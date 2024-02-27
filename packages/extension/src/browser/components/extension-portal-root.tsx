import cls from 'classnames';
import React from 'react';

import { DisposableCollection, useInjectable } from '@opensumi/ide-core-browser';
import { IThemeService, ThemeType, getThemeTypeSelector } from '@opensumi/ide-theme/lib/common';

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
    disposables.push(
      themeService.onThemeChange((e) => {
        if (e.type && e.type !== themeType) {
          setThemeType(e.type);
        }
      }),
    );
    return disposables.dispose.bind(disposables);
  }, []);

  const OriginalComponent = props.original;

  return (
    <OriginalComponent
      {...props.otherProps}
      className={cls(props.otherProps?.className, getThemeTypeSelector(themeType!))}
      getContainer={() => {
        const portalRoot = extensionService.getPortalShadowRoot(props.extensionId);
        return portalRoot;
      }}
    />
  );
};
