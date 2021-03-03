import * as React from 'react';
import { renderApp } from '@ali/ide-startup/entry/web/render-app';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { BrowserModule, CommandRegistry, CommandService, ILogger } from '@ali/ide-core-browser';
import { QuickPickService, IQuickInputService } from '../src/browser/quick-open.model';
import { QuickOpenModule } from '../src/browser';
import { QUICK_OPEN_COMMANDS } from '../src/common';
import { MonacoModule } from '@ali/ide-monaco/lib/browser';
import { EditorModule } from '@ali/ide-editor/lib/browser';
import { Injectable } from '@ali/common-di';

const QuickOpenDemo = observer(() => {

  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const commandService = useInjectable<CommandService>(CommandService);

  const quickPickService = useInjectable<QuickPickService>(QuickPickService);
  const quickInputService = useInjectable<IQuickInputService>(IQuickInputService);
  const loggerService = useInjectable<ILogger>(ILogger);

  React.useEffect(() => {
    commandRegistry.registerCommand({
      id: 'test1',
      label: 'test1 label',
      category: 'test1 category',
    }, {
      execute() {
        alert('test1');
      },
    });

    commandRegistry.registerCommand({
      id: 'test11',
      label: 'test11 label',
      category: 'test1 category',
    }, {
      execute() {
        alert('test11');
      },
    });

    commandRegistry.registerCommand({
      id: 'test2',
      label: 'test2 label',
      category: 'test2 category',
    }, {
      execute() {
        alert('test2');
      },
    });

  }, []);

  function openQuickOpen() {
    commandService.executeCommand(QUICK_OPEN_COMMANDS.OPEN.id);
  }

  async function openQuickPickString() {
    const value = await quickPickService.show(['LF', 'CRLF']);
    loggerService.log(value);
  }

  async function openQuickPickQuickPickItem() {
    const items = ['LF', 'CRLF'].map((lineEnding) => ({
      label: lineEnding,
      value: {
        value: lineEnding,
      },
      description: 'description',
      detail: 'detail',
      iconClass: 'github',
    }));

    const value = await quickPickService.show(items, {
      placeholder: '请选择',
    });
    loggerService.log(value);
  }

  async function openQuickinput() {

    const value = await quickInputService.open({
      password: true,
    });
    loggerService.log(value);
  }

  return (
    <div>
      <button onClick={openQuickOpen}>Open QuickOpenWidget</button>
      <button onClick={openQuickPickString}>Open QuickPickWidget[string]</button>
      <button onClick={openQuickPickQuickPickItem}>Open QuickPickWidget[QuickPickItem]</button>
      <button onClick={openQuickinput}>Open QuickInput</button>
    </div>
  );
});

@Injectable()
class QuickOpenDemoModule extends BrowserModule {
  component = QuickOpenDemo;
}

renderApp({
  modules: [ QuickOpenDemoModule, EditorModule, MonacoModule, QuickOpenModule ],
});
