import * as React from 'react';
import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser/lib/react-hooks';
import { BrowserModule, CommandRegistry, CommandService, EffectDomain } from '@ali/ide-core-browser';
import { QuickPickService } from '../src/browser/quick-open.model';
import '@ali/ide-quick-open/lib/browser';
import '@ali/ide-monaco/lib/browser';

const QuickOpenDemo = observer(() => {

  const commandRegistry: CommandRegistry = useInjectable(CommandRegistry);
  const commandService: CommandService = useInjectable(CommandService);

  const quickPickService = useInjectable(QuickPickService);

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
    commandService.executeCommand('quickCommand');
  }

  async function openQuickPickString() {
    const value = await quickPickService.show(['LF', 'CRLF']);
    console.log('选择: ' + value);
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
    console.log(value);
  }

  return (
    <div>
      <button onClick={openQuickOpen}>Open QuickOpenWidget</button>
      <button onClick={openQuickPickString}>Open QuickPickWidget[string]</button>
      <button onClick={openQuickPickQuickPickItem}>Open QuickPickWidget[QuickPickItem]</button>
    </div>
  );
});

@EffectDomain('quick-open-demo')
class QuickOpenTestModule extends BrowserModule {
  component = QuickOpenDemo;
}

const packageName = require('../package.json').name;
const monacoPackageName = '@ali/ide-monaco';

renderApp({
  modules: [ 'quick-open-demo', packageName, monacoPackageName ],
});
