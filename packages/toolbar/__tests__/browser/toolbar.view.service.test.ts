import { DisposableCollection } from '@ali/ide-core-common/lib/disposable';
import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { ToolBarViewService } from '../../src/browser/toolbar.view.service';
import { IToolBarViewService, IToolBarAction } from '../../lib/browser';
import { ToolbarModule } from '../../src/browser';

describe('toolbar service test suite', () => {

  const injector = createBrowserInjector([ToolbarModule]);

  // injector.addProviders({
  //   token: IToolBarViewService,
  //   useClass: ToolBarViewService,
  // });
  const toTearDown = new DisposableCollection();

  afterEach(() => toTearDown.dispose());

  it('should be register toolbar actions', async (done) => {
    const actions = [{
      type: 'action',
      position: 1,
      click: () => { /** */ },
      iconClass: 'preview',
      title: 'LeftPreview',
    }, {
      type: 'action',
      position: 3,
      click: () => { /** */ },
      iconClass: 'preview',
      title: 'RightPreview',
    }];
    const service: IToolBarViewService = injector.get(ToolBarViewService);
    const handles = actions.map((action) => service.registerToolBarElement(action as IToolBarAction));
    toTearDown.pushAll(handles);

    const leftActions = service.getVisibleElements(1);
    expect(leftActions[0]).toEqual(actions[0]);

    handles[0].setVisible(true);
    expect(handles[0].visible).toBeTruthy();

    const centerActions = service.getVisibleElements(3);
    expect(centerActions[0]).toEqual(actions[1]);

    handles[1].setVisible(false);
    expect(handles[1].visible).toBeFalsy();

    expect(service.getVisibleElements(1)[0].type).toBe('action');

    done();
  });

});
