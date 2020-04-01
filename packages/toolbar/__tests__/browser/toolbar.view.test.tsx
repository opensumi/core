import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { Injector } from '@ali/common-di';
import { act, Simulate } from 'react-dom/test-utils';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ToolBarViewService } from '../../src/browser/toolbar.view.service';
import { IToolBarViewService, IToolBarComponent, IToolBarAction } from '../../lib/browser';

import { ToolBarElementContainer } from '../../src/browser/toolbar.view';

describe('toolbar view test suite', () => {
  let container;
  beforeEach(() => {
    container = document.createElement('div');
    container.setAttribute('id', 'app');
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    container = null;
  });

  const injector: Injector = createBrowserInjector([]);

  injector.addProviders({
    token: IToolBarViewService,
    useValue: new ToolBarViewService(),
  });

  function $$(selector: string) {
    return document.querySelector(selector);
  }

  it('should render toolbar component', (done) => {
    const toolbarElement: IToolBarComponent = {
      type: 'component',
      component: () => (<div id='test-component'>test</div>),
      position: 1,
    };
    act(() => {
      ReactDOM.render(
        <ToolBarElementContainer elements={[toolbarElement]} />,
        container,
      );
    });
    expect($$('#test-component')?.textContent).toBe('test');
    done();
  });

  it('should render toolbar action', (done) => {
    const toolbarAction: IToolBarAction = {
      type: 'action',
      click: () => {
        done();
      },
      iconClass: 'preview',
      title: 'Preview',
      position: 1,
    };

    act(() => {
      ReactDOM.render(
        <ToolBarElementContainer elements={[toolbarAction]} />,
        container,
      );
    });
    expect($$('#app > div > div')?.children.item(0)?.getAttribute('title')).toBe('Preview');
    Simulate.click($$('#app > div > div')?.children.item(0)!);
  });
});
