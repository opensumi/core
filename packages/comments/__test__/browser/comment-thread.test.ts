import { Injector } from '@opensumi/di';
import { IContextKeyService } from '@opensumi/ide-core-browser';
import { URI, positionToRange } from '@opensumi/ide-core-common';
import { IIconService } from '@opensumi/ide-theme';
import { IconService } from '@opensumi/ide-theme/lib/browser';

import { createBrowserInjector } from '../../../../tools/dev-tool/src/injector-helper';
import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { createMockedMonaco } from '../../../monaco/__mocks__/monaco';
import { MockContextKeyService } from '../../../monaco/__mocks__/monaco.context-key.service';
import { CommentsModule } from '../../src/browser';
import { ICommentsService, CommentMode } from '../../src/common';

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
            name: '蛋总',
          },
          body: '评论内容1',
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
            name: '蛋总',
          },
          body: '评论内容1',
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
    expect(thread.comments[0].data).toEqual({ b: 1 });
  });

  it('thread add comment', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1));
    thread.addComment(
      {
        mode: CommentMode.Preview,
        author: {
          name: '蛋总',
        },
        body: '评论内容1',
      },
      {
        mode: CommentMode.Editor,
        author: {
          name: '蛋总',
        },
        body: '评论内容2',
      },
    );
    expect(thread.comments.length).toBe(2);
    expect(thread.comments[1].mode).toBe(CommentMode.Editor);
  });

  it('thread dispose', () => {
    const uri = URI.file('/test');
    const thread = commentsService.createThread(uri, positionToRange(1));
    thread.addComment(
      {
        mode: CommentMode.Preview,
        author: {
          name: '蛋总',
        },
        body: '评论内容1',
      },
      {
        mode: CommentMode.Editor,
        author: {
          name: '蛋总',
        },
        body: '评论内容2',
      },
    );
    thread.dispose();
    expect(thread.comments.length).toBe(0);
  });

  it('thread context service', () => {
    const uri = URI.file('/test');
    expect(commentsService.commentsThreads.length).toBe(0);
    const thread = commentsService.createThread(uri, positionToRange(1), {
      contextValue: 'aaa',
    });
    expect(thread.contextKeyService.getContextValue('thread')).toBe('aaa');
    expect(thread.contextKeyService.getContextValue('threadsLength')).toBe(1);
    commentsService.createThread(uri, positionToRange(2));
    // 同一个 uri 的 threadsLength 会变为 2
    expect(thread.contextKeyService.getContextValue('threadsLength')).toBe(2);
  });
});
