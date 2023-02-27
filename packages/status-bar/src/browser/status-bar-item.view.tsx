import cls from 'classnames';
import React, { ReactNode } from 'react';

import { Button, Popover, PopoverPosition, PopoverTriggerType } from '@opensumi/ide-components';
import { getExternalIcon, IOpenerService, toMarkdown } from '@opensumi/ide-core-browser';
import { parseLabel, LabelIcon, replaceLocalizePlaceholder } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { StatusBarEntry, StatusBarHoverContent } from '@opensumi/ide-core-browser/lib/services';
import {
  IThemeColor,
  isThemeColor,
  CommandService,
  StatusBarHoverCommand,
  IMarkdownString,
  isString,
} from '@opensumi/ide-core-common';
import { IThemeService } from '@opensumi/ide-theme';

import styles from './status-bar.module.less';
interface StatusBarItemText {
  text: string;
  children: (text: string) => ReactNode;
}

const StatusBaItemText = React.memo(({ text, children }: StatusBarItemText) => {
  return <>
    {parseLabel(text).map((item, key) => {
    if (!(typeof item === 'string') && LabelIcon.is(item)) {
      return (
        <span
          key={key}
          className={cls(
            styles.icon,
            getExternalIcon(item.name, item.owner),
            `${item.animation ? 'iconfont-anim-' + item.animation : ''}`,
          )}
        ></span>
      );
    } else {
      // 22px高度限制用于解决文本超长时文本折叠问题
      return children(item);
    }
  })}
  </>;
});

interface StatusBarPopoverContent {
  contents: StatusBarHoverContent[];
}

const StatusBarPopover = React.memo((props: StatusBarPopoverContent) => {
  const commandService: CommandService = useInjectable(CommandService);
  const { contents } = props;

  const onClickLink = React.useCallback((command: StatusBarHoverCommand) => {
    commandService.executeCommand(command.id, ...(command.arguments || []));
  }, []);

  return (
    <div>
      {contents.map((content) => (
        <div key={content.title} className={styles.popover_content}>
          <span>
            { content.title && <StatusBaItemText text={content.title}>
              {(item) => item}
              </StatusBaItemText>
            }
            {content.name && ` - ${content.name}`}
          </span>
          {content.command && (
            <Button type='link' title={content.command.tooltip} onClick={() => onClickLink(content.command!)}>
              {content.command.title}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
});

export const StatusBarItem = React.memo((props: StatusBarEntry) => {
  const {
    entryId,
    text,
    onClick,
    tooltip,
    command,
    ariaLabel,
    iconClass,
    className,
    role = 'button',
    hoverContents,
    color: propsColor,
    backgroundColor: propsBackgroundColor,
  } = props;

  const themeService = useInjectable<IThemeService>(IThemeService);
  const openerService = useInjectable<IOpenerService>(IOpenerService);

  const disablePopover = React.useMemo(() => !tooltip && !hoverContents, [tooltip, hoverContents]);

  const popoverContent = React.useMemo(() => {
    if (hoverContents) {
      return <StatusBarPopover contents={hoverContents} />;
    }
    if (tooltip && (tooltip as IMarkdownString).value) {
      return toMarkdown((tooltip as IMarkdownString).value, openerService);
    }
    return isString(tooltip) && <div className={styles.popover_tooltip}>
      <StatusBaItemText text={tooltip}>
      {(item) => item}
      </StatusBaItemText>
    </div>
  }, [tooltip]);

  const getColor = (color: string | IThemeColor | undefined): string => {
    if (!color) {
      return '';
    }

    if (isThemeColor(color)) {
      return themeService.getColor(color)?.toString() ?? '';
    }

    return color;
  };
  return (
    <div
      id={entryId}
      className={cls(styles.element, className, {
        [styles.hasCommand]: command || onClick,
      })}
      onClick={onClick}
      style={{
        color: getColor(propsColor),
        backgroundColor: getColor(propsBackgroundColor),
      }}
      aria-label={ariaLabel}
    >
      <Popover
        id={entryId!}
        content={popoverContent}
        trigger={PopoverTriggerType.hover}
        delay={200}
        position={PopoverPosition.top}
        disable={disablePopover}
      >
        <div className={styles.popover_item}>
          {iconClass && <span key={-1} className={cls(styles.icon, iconClass)}></span>}
          { text && <StatusBaItemText text={text}>
            {(item) => (
              // 22px高度限制用于解决文本超长时文本折叠问题
              <span style={{ height: '22px', lineHeight: '22px' }} aria-label={ariaLabel} role={role}>
                {replaceLocalizePlaceholder(item)}
              </span>
            )
          }
          </StatusBaItemText>}
        </div>
      </Popover>
    </div>
  );
});
