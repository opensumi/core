import { ElementHandle, Page } from '@playwright/test';

import { OpenSumiApp } from './app';

export abstract class OpenSumiViewBase {
  constructor(public app: OpenSumiApp) {}

  get page(): Page {
    return this.app.page;
  }
}
