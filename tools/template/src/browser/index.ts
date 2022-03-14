import React from 'react';

import { Provider, Injectable } from '@opensumi/di';
import { BrowserModule } from '@opensumi/ide-core-browser';

import { HelloWorld } from './hello-world.view';

@Injectable()
export class TemplateUpperNameModule extends BrowserModule {
  providers: Provider[] = [];

  component = HelloWorld;
}
