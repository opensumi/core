import { Injector } from '@opensumi/di';
import { CommentContentNode, CommentRoot } from '@opensumi/ide-comments/lib/browser/tree/tree-node.defined';
import { IContextKeyService, URI } from '@opensumi/ide-core-browser';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { positionToRange } from '@opensumi/ide-monaco';
import { createMockedMonaco } from '@opensumi/ide-monaco/__mocks__/monaco';
import { MockContextKeyService } from '@opensumi/ide-monaco/__mocks__/monaco.context-key.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { CommentsModule } from '../../src/browser';
import { CommentMode, ICommentsFeatureRegistry, ICommentsService } from '../../src/common';

describe('comment service test', () => {
  let injector: MockInjector;
  let commentsFeatureRegistry: ICommentsFeatureRegistry;
  let commentsService: ICommentsService;
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
        {
          token: EditorCollectionService,
          useValue: mockService({
            listEditors: () => [],
          }),
        },
      ]),
    );
    commentsService = injector.get<ICommentsService>(ICommentsService);
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

  it('registerPanelTreeNodeHandler', async () => {
    const override = {
      label: 'test',
      description: 'This is a description',
    };
    // 先绑定 node 节点处理函数
    commentsFeatureRegistry.registerPanelTreeNodeHandler((nodes) =>
      nodes.map((node) => {
        node.label = override.label;
        node.description = override.description;
        node.onSelect = () => {};
        return node;
      }),
    );
    const uri = new URI('/root/test.js');
    commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: 'OpenSumi',
          },
          body: 'This is a comment',
        },
      ],
    });
    const roots = await commentsService.resolveChildren();
    const root = roots?.[0];
    // The root should not be effected.
    if (!root) {
      return;
    }
    const nodes = await commentsService.resolveChildren(root as CommentRoot);
    const node = nodes?.[0];
    if (!node) {
      return;
    }
    expect((node as CommentContentNode).renderedLabel).toBe(override.label);
    expect((node as CommentContentNode).renderedDescription).toBe(override.description);
    expect(typeof (node as CommentContentNode).onSelect === 'function').toBeTruthy();
  });
});
