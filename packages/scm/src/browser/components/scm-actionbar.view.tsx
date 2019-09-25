import * as React from 'react';
import { useMenus } from '@ali/ide-core-browser';
import { TitleActionList } from '@ali/ide-core-browser/lib/components/actions';
import { IMenu } from '@ali/ide-core-browser/lib/menu/next/menu-service';

import { ISCMResource, ISCMResourceGroup } from '../../common';

export const SCMInlineActionBar: React.FC<{
  context: ISCMResourceGroup | ISCMResource;
  menus: IMenu,
}> = ({ menus, context }) => {
  const [menuConfig] = useMenus(menus, 'inline');

  return (
    <TitleActionList nav={menuConfig} context={context} />
  );
};
