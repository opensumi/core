import { Injectable, Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandContribution,
  CommandRegistry,
  CommandService,
  ComponentContribution,
  ComponentRegistry,
  Domain,
  EDITOR_COMMANDS,
  FileType,
  getIcon,
  localize,
  SlotLocation,
  URI,
} from '@opensumi/ide-core-browser';
import { GoToTestCommand } from '../common/commands';

import { TestingContainerId, TestingViewId } from '../common/testing-view';
import { ITestTreeViewModel, TestTreeViewModelToken } from '../common/tree-view.model';
import { TestingView } from './components/testing.view';
import { IFileServiceClient } from '@opensumi/ide-file-service';

@Injectable()
@Domain(ClientAppContribution, ComponentContribution, CommandContribution)
export class TestingContribution implements ClientAppContribution, ComponentContribution, CommandContribution {
  @Autowired(TestTreeViewModelToken)
  private readonly testTreeViewModel: ITestTreeViewModel;

  @Autowired(IFileServiceClient)
  protected readonly filesystem: IFileServiceClient;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  initialize(): void {
    this.testTreeViewModel.initTreeModel();
  }

  registerComponent(registry: ComponentRegistry): void {
    registry.register(
      TestingViewId,
      [],
      {
        iconClass: getIcon('test'),
        title: localize('test.title'),
        priority: 1,
        containerId: TestingContainerId,
        component: TestingView,
        activateKeyBinding: 'ctrlcmd+shift+t',
      },
      SlotLocation.left,
    );
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(GoToTestCommand, {
      execute: async (extId: string) => {
        const test = this.testTreeViewModel.getTestItem(extId);
        if (!test) {
          return;
        }

        const { range, uri } = test.item;
        if (!uri) {
          return;
        }

        const fileStat = await this.filesystem.getFileStat(uri.toString());

        if (!fileStat) {
          return;
        }

        if (fileStat.type === FileType.Directory) {
          // ** filetree 未实现文件夹的 focus , 只能是将窗口切到资源管理器但无法选中文件夹 **
          this.commandService.executeCommand('revealInExplorer', uri);
          return;
        }

        if (fileStat.type === FileType.File) {
          this.commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, URI.parse(uri.toString()), {
            range,
            focus: true,
          });
        }
      },
      isVisible: () => false,
    });
  }
}
