import * as React from 'react';
import { BrowserModule, RenderNameEnum } from '@ali/ide-core-browser';
import { Monaco } from './monaco.view';

export class MonacoModule extends BrowserModule {
  providers = [];
  slotMap = new Map([
    [RenderNameEnum.mainLayout, Monaco],
  ]);
}
