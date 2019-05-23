import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { servicePath } from '../common';

@Injectable()
export class DocModelModule extends BrowserModule {
  providers = [];
  slotMap = new Map();
  backServices = [{
    servicePath,
  }];
}
