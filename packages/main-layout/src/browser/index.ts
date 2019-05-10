import { RenderNameEnum, BrowserModule } from '@ali/ide-core-browser';
import { MainLayout } from './main-layout.view';
import { createMainLayoutAPIProvider } from '../common';
import { MainLayoutAPIImpl } from './main-layout.api';

export const mainLayout: BrowserModule = {
  providers: [
    createMainLayoutAPIProvider(MainLayoutAPIImpl),
  ],
  slotMap: new Map([
    [RenderNameEnum.mainLayout, MainLayout],
  ]),
};
