import cls from 'classnames';
import React from 'react';

import { Button, Popover, PopoverPosition, PopoverTriggerType } from '@opensumi/ide-components';
import { getExternalIcon } from '@opensumi/ide-core-browser';
import { parseLabel, LabelPart, LabelIcon, replaceLocalizePlaceholder } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser/lib/react-hooks';
import { StatusBarEntry, StatusBarHoverContent } from '@opensumi/ide-core-browser/lib/services';
import { IThemeColor, isThemeColor, CommandService, StatusBarHoverCommand } from '@opensumi/ide-core-common';
import { IThemeService } from '@opensumi/ide-theme';

import styles from './status-bar.module.less';


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
            {content.title}
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

  const disablePopover = React.useMemo(
    () => !tooltip && !hoverContents && (!command || !onClick),
    [tooltip, hoverContents, command, onClick],
  );

  const popoverContent = React.useMemo(() => {
    if (hoverContents) {
      return <StatusBarPopover contents={hoverContents} />;
    }
    return <div className={styles.popover_tooltip}>{tooltip}</div>;
  }, []);

  const getColor = (color: string | IThemeColor | undefined): string => {
    if (!color) {
      return '';
    }

    if (isThemeColor(color)) {
      return themeService.getColor(color)?.toString() ?? '';
    }

    return color;
  };

  let items: LabelPart[] = [];
  if (text) {
    items = parseLabel(text);
  }
  let hasIcon = false;
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
          {items.map((item, key) => {
            if (!(typeof item === 'string') && LabelIcon.is(item)) {
              hasIcon = true;
              return (
                <span
                  key={key}
                  className={cls(
                    styles.icon,
                    getExternalIcon(item.name),
                    `${item.animation ? 'iconfont-anim-' + item.animation : ''}`,
                  )}
                ></span>
              );
            } else {
              // 22px高度限制用于解决文本超长时文本折叠问题
              return (
                <span
                  style={{ marginLeft: iconClass || hasIcon ? '2px' : 0, height: '22px', lineHeight: '22px' }}
                  key={key}
                  aria-label={ariaLabel}
                  role={role}
                >
                  {replaceLocalizePlaceholder(item)}
                </span>
              );
            }
          })}
        </div>
      </Popover>
    </div>
  );
});
