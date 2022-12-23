import { Injector } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { CommentsModule } from '../../src/browser';
import { ICommentsService, ICommentsFeatureRegistry } from '../../src/common';

describe('comment service test', () => {
  let injector: MockInjector;
  let commentsFeatureRegistry: ICommentsFeatureRegistry;
  beforeAll(() => {
    (global as any).monaco = createMockedMonaco() as any;
    injector = createBrowserInjector(
      [CommentsModule],
      new Injector([
        {
          token: IContextKeyService,
          useClass: MockContextKeyService,
        },
        {
          token: IIconService,
          useClass: IconService,
        },
      ]),
    );
    commentsFeatureRegistry = injector.get<ICommentsFeatureRegistry>(ICommentsFeatureRegistry);
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  it('registerPanelOptions', () => {
    const options = {
      iconClass: 'iconClass',
      priority: 1,
      title: 'title',
      hidden: false,
      badge: 'badge',
      initialProps: { a: 1 },
    };
    commentsFeatureRegistry.registerPanelOptions(options);
    const registryOptions = commentsFeatureRegistry.getCommentsPanelOptions();

    expect(registryOptions).toEqual(options);
  });

  it('registerPanelOptions', () => {
    const options = {
      iconClass: 'iconClass',
      priority: 1,
      title: 'title',
      hidden: false,
      badge: 'badge',
      initialProps: { a: 1 },
    };
    commentsFeatureRegistry.registerPanelOptions(options);
    const registryOptions = commentsFeatureRegistry.getCommentsPanelOptions();

    expect(registryOptions).toEqual(options);
  });
});
