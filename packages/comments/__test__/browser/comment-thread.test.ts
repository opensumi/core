import { Injector } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { URI } from '@opensumi/ide-core-common';
import { createBrowserInjector } from '@opensumi/ide-dev-tool/src/injector-helper';
import { MockInjector, mockService } from '@opensumi/ide-dev-tool/src/mock-injector';
import { EditorCollectionService } from '@opensumi/ide-editor';
import { positionToRange } from '@opensumi/ide-monaco';
import { createMockedMonaco } from '@opensumi/ide-monaco/__mocks__/monaco';
import { MockContextKeyService } from '@opensumi/ide-monaco/__mocks__/monaco.context-key.service';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { CommentsModule } from '../../src/browser';
import { CommentMode, ICommentsService } from '../../src/common';

describe('comment service test', () => {
  let injector: MockInjector;
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
  });

  afterEach(() => {
    commentsService.dispose();
  });

  afterAll(() => {
    (global as any).monaco = undefined;
  });

  it('basic props', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: 'User',
          },
          body: 'Comment Text',
        },
      ],
    });
    expect(thread.uri.isEqual(uri));
    expect(thread.range.startLineNumber).toBe(1);
  });

  it('thread and comment data', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1), {
      comments: [
        {
          mode: CommentMode.Editor,
          author: {
            name: 'User',
          },
          body: 'Comment Text',
          data: {
            b: 1,
          },
        },
      ],
      data: {
        a: 1,
      },
    });
    expect(thread.data).toEqual({ a: 1 });
    expect(thread.comments.get()[0].data).toEqual({ b: 1 });
  });

  it('thread add comment', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1));
    thread.addComment(
      {
        mode: CommentMode.Preview,
        author: {
          name: 'User',
        },
        body: 'Comment Text',
      },
      {
        mode: CommentMode.Editor,
        author: {
          name: 'User',
        },
        body: 'Comment Text 2',
      },
    );
    expect(thread.comments.get().length).toBe(2);
    expect(thread.comments.get()[1].mode).toBe(CommentMode.Editor);
  });

  it('thread dispose', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1));
    thread.addComment(
      {
        mode: CommentMode.Preview,
        author: {
          name: 'User',
        },
        body: 'Comment Text',
      },
      {
        mode: CommentMode.Editor,
        author: {
          name: 'User',
        },
        body: 'Comment Text 2',
      },
    );
    thread.dispose();
    expect(thread.comments.get().length).toBe(0);
  });

  it('thread context service', () => {
    const uri = URI.file('/test');
    expect(commentsService.commentsThreads.length).toBe(0);
    const contextValue = 'isDraft';
    const thread = commentsService.createThread(uri, positionToRange(1), {
      contextValue,
    });
    expect(thread.contextKeyService.getContextKeyValue('thread')).toBe(contextValue);
    expect(thread.contextKeyService.getContextKeyValue('threadsLength')).toBe(1);
    commentsService.createThread(uri, positionToRange(2));
    // 同一个 uri 的 threadsLength 会变为 2
    expect(thread.contextKeyService.getContextKeyValue('threadsLength')).toBe(2);
  });
});
