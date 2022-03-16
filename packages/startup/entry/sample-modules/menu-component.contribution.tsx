// eslint-disable-next-line no-console
import React from 'react';

import { Domain } from '@opensumi/ide-core-browser';
import {
  MenuContribution,
  IMenuRegistry,
  MenuId,
  IComponentMenuItemProps,
} from '@opensumi/ide-core-browser/lib/menu/next';

const CustomMenuItem: React.FC<IComponentMenuItemProps> = (props) => {
  const handleClick = () => {
    // eslint-disable-next-line no-console
    console.log(props.getExecuteArgs(), 'get exec args here');
  };

  return (
    <div style={{ color: 'red' }} onClick={handleClick}>
      hello world
    </div>
  );
};

@Domain(MenuContribution)
export class CustomReactComponentMenuContribution implements MenuContribution {
  registerMenus(menus: IMenuRegistry): void {
    menus.registerMenuItem(MenuId.EditorTitle, {
      component: CustomMenuItem,
      order: 100,
      when: 'isInDiffEditor',
    });
  }
}
