import * as React from 'react';
import { Injectable } from '@ali/common-di';
import { BrowserModule } from '@ali/ide-core-browser';
import { servicePath } from '../common';
import {BrowserDocumentModelManager} from './doc-model';

@Injectable()
export class DocModelModule extends BrowserModule {
  providers = [];
  slotMap = new Map();
  backServices = [{
    servicePath,
    clientToken: BrowserDocumentModelManager,
  }];
}
