import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';
import { Autowired } from '@opensumi/di';
import { Disposable, CommandContribution, CommandRegistry, Command, localize, PreferenceSchema } from '@opensumi/ide-core-common';
import { ClientAppContribution, getIcon, PreferenceContribution } from '@opensumi/ide-core-browser';
import { Domain } from '@opensumi/ide-core-common/lib/di-helper';
import { ComponentContribution, ComponentRegistry, TabBarToolbarContribution, ToolbarRegistry } from '@opensumi/ide-core-browser/lib/layout';

import { Output, ChannelSelector } from './output.view';
import { OutputService } from './output.service';
import { outputPreferenceSchema } from './output-preference';
import { OutputLinkProvider } from './output-link.provider';

const OUTPUT_CLEAR: Command = {
  id: 'output.channel.clear',
  iconClass: getIcon('clear'),
  label: localize('output.channel.clear', '清理日志'),
};
const OUTPUT_CONTAINER_ID = 'ide-output';
@Domain(CommandContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, ClientAppContribution)
export class OutputContribution extends Disposable implements CommandContribution, ComponentContribution, TabBarToolbarContribution, PreferenceContribution, ClientAppContribution {

  @Autowired()
  private readonly outputService: OutputService;

  @Autowired()
  private readonly outputLinkProvider: OutputLinkProvider;

  schema: PreferenceSchema = outputPreferenceSchema;

  onStart() {
    this.addDispose(
      monaco.languages.registerLinkProvider('log', this.outputLinkProvider),
    );
  }

  registerToolbarItems(registry: ToolbarRegistry) {
    registry.registerItem({
      id: 'output.clear.action',
      command: OUTPUT_CLEAR.id,
      viewId: OUTPUT_CONTAINER_ID,
    });
  }

  registerCommands(commands: CommandRegistry): void {
    commands.registerCommand(OUTPUT_CLEAR, {
      execute: () => this.outputService.selectedChannel.clear(),
      isEnabled: () => !!this.outputService.selectedChannel,
    });
  }

  registerComponent(registry: ComponentRegistry) {
    registry.register('@opensumi/ide-output', {
      id: OUTPUT_CONTAINER_ID,
      component: Output,
    }, {
      title: localize('output.tabbar.title', '输出'),
      priority: 9,
      containerId: OUTPUT_CONTAINER_ID,
      activateKeyBinding: 'ctrlcmd+shift+u',
      titleComponent: ChannelSelector,
    });
  }
}
