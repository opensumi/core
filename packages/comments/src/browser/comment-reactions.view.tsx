import React from 'react';

import { Disposable, IEventBus, getExternalIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Button } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { AbstractMenuService, IMenuRegistry, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { IIconService, IconType } from '@opensumi/ide-theme';

import {
  CommentReaction,
  CommentReactionClick,
  ICommentsThread,
  IThreadComment,
  SwitchCommandReaction,
} from '../common';

import styles from './comments.module.less';

export const CommentReactionSwitcher: React.FC<{
  thread: ICommentsThread;
  comment: IThreadComment;
  className?: string;
}> = ({ thread, comment, className }) => {
  const key = `${thread.providerId}_${thread.id}_${comment.id}`;
  const menuId = `${MenuId.CommentReactionSwitcherMenu}_${key}`;
  const menuRegistry = useInjectable<IMenuRegistry>(IMenuRegistry);
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);

  React.useEffect(() => {
    const disposer = new Disposable();
    const subMenuId = `${MenuId.CommentReactionSwitcherSubmenu}_${key}`;

    disposer.addDispose(
      menuRegistry.registerMenuItem(menuId, {
        submenu: subMenuId,
        // 目前 label 必须要填
        label: subMenuId,
        iconClass: getExternalIcon('reactions'),
        group: 'navigation',
      }),
    );

    disposer.addDispose(
      menuRegistry.registerMenuItems(
        subMenuId,
        comment.reactions!.map((reaction) => ({
          command: {
            id: SwitchCommandReaction,
            label: reaction.label!,
          },
          extraTailArgs: [
            {
              thread,
              comment,
              reaction,
            },
          ],
        })),
      ),
    );
    return () => disposer.dispose();
  }, []);

  const reactionsContext = React.useMemo(() => {
    const menu = menuService.createMenu(menuId);
    return menu;
  }, []);

  return <InlineActionBar className={className} menus={reactionsContext} regroup={(nav) => [nav, []]} type='icon' />;
};

export const CommentReactions: React.FC<{
  thread: ICommentsThread;
  comment: IThreadComment;
}> = ({ thread, comment }) => {
  const eventBus = useInjectable<IEventBus>(IEventBus);
  const iconService = useInjectable<IIconService>(IIconService);
  const handleClickReaction = React.useCallback((reaction: CommentReaction) => {
    eventBus.fire(
      new CommentReactionClick({
        thread,
        comment,
        reaction,
      }),
    );
  }, []);

  return (
    <div className={styles.comment_reactions}>
      {comment.reactions
        ?.filter((reaction) => reaction.count !== 0)
        .map((reaction) => (
          <Button
            key={reaction.label}
            onClick={() => handleClickReaction(reaction)}
            type='secondary'
            size='small'
            title={reaction.label}
            className={styles.comment_reaction}
            iconClass={iconService.fromIcon('', reaction.iconPath.toString(), IconType.Background)}
          >
            &nbsp;{reaction.count}
          </Button>
        ))}
    </div>
  );
};
