import { MainLayoutAPI } from '../common/main-layout.defination';
import { BasicClientAPI, createApiClass } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';

const Parent = createApiClass(
  BasicClientAPI,
  MainLayoutAPI,
  [
  ],
);

@Injectable()
export class MainLayoutAPIImpl extends Parent implements MainLayoutAPI {
  // nothing
}
