import { observable } from 'mobx';
import { Injectable, Autowired } from '@ali/common-di';
import {
  WithEventBus,
  OnEvent,
  getSlotLocation,
  AppConfig,
  CommandService,
  FILE_COMMANDS,
} from '@ali/ide-core-browser';
import { ResizeEvent } from '@ali/ide-main-layout';
import { ExplorerOpenedEditorService } from './explorer-opened-editor.service';

const pkgName = require('../../package.json').name;

@Injectable()
export class ExplorerService extends WithEventBus {

  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(CommandService)
  private commandService: CommandService;

  @Autowired(ExplorerOpenedEditorService)
  private explorerOpenedEditorService: ExplorerOpenedEditorService;

  @observable
  layout: any = {
    width: 100,
    height: 100,
  };

  @observable
  keymap = {
    openeditor: '1',
    resource: '2',
    outline: '3',
  };

  @observable
  activeKey: string[] = ['2'];

  private currentLocation: string;

  constructor() {
    super();
    this.currentLocation = getSlotLocation(pkgName, this.config.layoutConfig);
  }

  @OnEvent(ResizeEvent)
  protected onResize(e: ResizeEvent) {
    if (e.payload.slotLocation === this.currentLocation) {
      this.layout = e.payload;
    }
  }

  newFile = () => {
    this.commandService.executeCommand(FILE_COMMANDS.NEW_FILE.id);
  }

  newFolder = () => {
    this.commandService.executeCommand(FILE_COMMANDS.NEW_FOLDER.id);
  }

  collapseAll = () => {
    this.commandService.executeCommand(FILE_COMMANDS.COLLAPSE_ALL.id);
  }

  refresh = () => {
    this.commandService.executeCommand(FILE_COMMANDS.REFRESH_ALL.id);
  }

  updateActiveKey(change: string[]) {
    this.activeKey = change;
  }
}
