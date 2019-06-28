import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  WithEventBus,
  OnEvent,
  getSlotLocation,
  AppConfig,
  CommandService,
} from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout';
import { FILETREE_BROWSER_COMMANDS } from '@ali/ide-file-tree';

const pkgName = require('../../package.json').name;

@Injectable()
export class ExplorerService extends WithEventBus {

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(CommandService)
  private commandService: CommandService;

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

  newFile = () => {
    this.commandService.executeCommand(FILETREE_BROWSER_COMMANDS.NEW_FILE.id);
  }

  newFolder = () => {
    this.commandService.executeCommand(FILETREE_BROWSER_COMMANDS.NEW_FOLDER.id);
  }

  collapseAll = () => {
    this.commandService.executeCommand(FILETREE_BROWSER_COMMANDS.COLLAPSE_ALL.id);
  }

  refresh = () => {
    this.commandService.executeCommand(FILETREE_BROWSER_COMMANDS.REFRESH_ALL.id);
  }
}
