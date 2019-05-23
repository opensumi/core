import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { servicePath } from '@ali/ide-doc-model/lib/common';

@Injectable()
export class DocModelModule extends BrowserModule {
  providers = [];
  slotMap = new Map();
  backServices = [{
    servicePath,
  }];
}
