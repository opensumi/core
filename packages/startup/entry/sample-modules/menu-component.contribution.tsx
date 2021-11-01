// tslint:disable:no-console
import { Domain } from '@ali/ide-core-browser';
import { MenuContribution, IMenuRegistry, MenuId, IComponentMenuItemProps } from '@ali/ide-core-browser/lib/menu/next';
import React from 'react';

const CustomMenuItem: React.FC<IComponentMenuItemProps> = (props) => {
  const handleClick = () => {
    console.log(props.getExecuteArgs(), 'get exec args here');
  };

  return <div style={{color: 'red'}} onClick={handleClick}>hello world</div>;
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
