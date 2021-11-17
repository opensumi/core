import React from 'react';
import { Provider, Injectable } from '@ide-framework/common-di';
import { BrowserModule } from '@ide-framework/ide-core-browser';
import { HelloWorld } from './hello-world.view';

@Injectable()
export class TemplateUpperNameModule extends BrowserModule {
  providers: Provider[] = [];

  component = HelloWorld;
}
