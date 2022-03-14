import clx from 'classnames';
import React from 'react';

import { IBasicTreeMenu } from './types';

export const BasicMenuItem: React.FC<
  IBasicTreeMenu & {
    focusMode: boolean;
    onClick: (id: string) => void;
  }
> = ({ id, label, type, focusMode, onClick }) => {
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);

  const handleMenuItemClick = React.useCallback(() => {
    if (focusMode) {
      setMenuOpen(true);
    } else {
      setMenuOpen((r) => !r);
    }
    onClick(id);
  }, [id]);

  const handleMouseOver = React.useCallback(() => {}, [id, focusMode]);

  if (type === 'divider') {
    return <div className='basic_menu_item_divider'></div>;
  }
  return (
    <div
      className={clx('basic_menu_item', { ['menu-open']: menuOpen })}
      onMouseOver={handleMouseOver}
      onClick={handleMenuItemClick}
    >
      {label}
    </div>
  );
};
