import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  WithEventBus,
  OnEvent,
  getSlotLocation,
} from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout';
import { AppConfig } from '@ali/ide-core-browser';

const pkgName = require('../../package.json').name;

@Injectable()
export default class ExplorerService extends WithEventBus {

  @Autowired(AppConfig)
  private config: AppConfig;

  @observable
  layout: any = {
    width: 100,
    height: 100,
  };

  private currentLocation: string;

  constructor() {
    super();
    this.currentLocation = getSlotLocation(pkgName, this.config.layoutConfig);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    // TODO 目前只有filetree这里用到了 resize event，考虑重构？
    if (e.payload.slotLocation === this.currentLocation) {
      this.layout = e.payload;
    }
  }
}
