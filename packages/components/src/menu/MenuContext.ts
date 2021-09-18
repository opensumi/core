import { createContext } from 'react';

export type MenuTheme = 'light' | 'dark';

export interface MenuContextProps {
  inlineCollapsed: boolean;
}

const MenuContext = createContext<MenuContextProps>({
  inlineCollapsed: false,
});

export default MenuContext;
