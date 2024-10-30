import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React from 'react';

import {
  Button,
  CheckBox,
  IRecycleListHandler,
  RecycleList,
  VALIDATE_TYPE,
  ValidateInput,
} from '@opensumi/ide-components';
import { Key, KeyCode, isUndefined, localize, useDesignStyles, useInjectable } from '@opensumi/ide-core-browser';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ProgressBar } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import {
  HideReason,
  QuickInputButton,
  QuickOpenAction,
  QuickOpenItem,
  QuickOpenMode,
  QuickTitleButton,
} from '@opensumi/ide-core-browser/lib/quick-open';
import { KEY_CODE_MAP } from '@opensumi/ide-monaco/lib/browser/monaco.keycode-map';
import { KeyCode as KeyCodeEnum } from '@opensumi/monaco-editor-core/esm/vs/base/common/keyCodes';

import { HighlightLabel } from './components/highlight-label';
import { KeybindingView } from './components/keybinding';
import { QuickOpenItemService } from './quick-open-item.service';
import { QuickOpenContext } from './quick-open.type';
import { QuickTitleBar } from './quick-title-bar';
import styles from './styles.module.less';

import type { ListOnScrollProps } from 'react-window';

interface IQuickOpenItemProps {
  data: QuickOpenItem;
  index: number;
}

const QuickOpenButton: React.FC<
  {
    button: QuickTitleButton;
  } & React.ButtonHTMLAttributes<HTMLButtonElement>
> = observer(({ button, ...props }) => (
  <Button {...props} key={button.tooltip} type='icon' iconClass={button.iconClass} title={button.tooltip} />
));

export const QuickOpenHeader = observer(() => {
  const quickTitleBar = useInjectable<QuickTitleBar>(QuickTitleBar);
  const titleText = React.useMemo(() => {
    const getSteps = () => {
      if (quickTitleBar.step && quickTitleBar.totalSteps) {
        return `${quickTitleBar.step}/${quickTitleBar.totalSteps}`;
      }
      if (quickTitleBar.step) {
        return String(quickTitleBar.step);
      }
      return '';
    };
    if (quickTitleBar.title && quickTitleBar.step) {
      return `${quickTitleBar.title} (${getSteps()})`;
    }
    if (quickTitleBar.title) {
      return quickTitleBar.title;
    }
    if (quickTitleBar.step) {
      return getSteps();
    }
    return '';
  }, [quickTitleBar.title, quickTitleBar.step, quickTitleBar.totalSteps]);

  const onSelectButton = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, button: QuickTitleButton) => {
      event.stopPropagation();
      quickTitleBar.fireDidTriggerButton(button);
    },
    [quickTitleBar.fireDidTriggerButton],
  );

  return quickTitleBar.isAttached ? (
    <div className={styles.title_bar}>
      <div className={styles.title_bar_button}>
        {quickTitleBar.leftButtons.map((button) => (
          <QuickOpenButton onMouseDown={(event) => onSelectButton(event, button)} button={button} />
        ))}
      </div>
      <div>{titleText}</div>
      <div className={styles.title_bar_button}>
        {quickTitleBar.rightButtons.map((button) => (
          <QuickOpenButton onMouseDown={(event) => onSelectButton(event, button)} button={button} />
        ))}
      </div>
    </div>
  ) : null;
});

export const QuickOpenInput = observer(() => {
  const { widget } = React.useContext(QuickOpenContext);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const onChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      widget.setInputValue(value);
      widget.callbacks.onType(value);
    },
    [widget],
  );

  const type = React.useMemo(() => (widget.isPassword ? 'password' : 'text'), [widget.isPassword]);

  React.useEffect(() => {
    // 当切换 item 时重新获取焦点
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  }, [widget.items]);

  React.useEffect(() => {
    if (widget.inputValue && widget.valueSelection) {
      const [start, end] = widget.valueSelection;
      inputRef.current?.setSelectionRange(start, end);
    }
  }, [widget.valueSelection]);

  const validateMessage = React.useMemo(() => {
    if (!isUndefined(widget.validateType)) {
      return {
        type: widget.validateType,
        message: '',
      };
    }
  }, [widget.validateType]);

  const handleSelectAll = React.useCallback((event) => {
    const selected = event.target.checked;
    for (const item of widget.items) {
      item.checked = selected;
    }
  }, []);

  const handleConfirm = React.useCallback(() => {
    widget.callbacks.onConfirm(widget.items.filter((item) => item.checked));
    widget.hide(HideReason.ELEMENT_SELECTED);
  }, []);

  return (
    <div tabIndex={0} className={styles.input}>
      {widget.canSelectMany && <CheckBox checked={widget.selectAll} wrapTabIndex={0} onChange={handleSelectAll} />}
      <ValidateInput
        validateMessage={validateMessage}
        ref={inputRef}
        type={type}
        aria-label={widget.inputPlaceholder}
        placeholder={widget.inputPlaceholder}
        value={widget.inputValue}
        readOnly={!widget.inputEnable}
        onChange={onChange}
        id={VIEW_CONTAINERS.QUICKPICK_INPUT}
      />
      {widget.canSelectMany && (
        <Button className={styles.input_button} onClick={handleConfirm}>
          {localize('ButtonOK')}
        </Button>
      )}
    </div>
  );
});

const QuickOpenItemView: React.FC<IQuickOpenItemProps> = observer(({ data, index }) => {
  const { widget } = React.useContext(QuickOpenContext);
  const quickOpenItemService = useInjectable<QuickOpenItemService>(QuickOpenItemService);

  const label = React.useMemo(() => data.getLabel(), [data]);

  const description = React.useMemo(() => data.getDescription(), [data]);

  const detail = React.useMemo(() => data.getDetail(), [data]);

  const iconClass = React.useMemo(() => data.getIconClass(), [data]);

  const keybinding = React.useMemo(() => data.getKeybinding(), [data]);

  const groupLabel = React.useMemo(() => data.getGroupLabel(), [data]);

  const showBorder = React.useMemo(() => data.showBorder(), [data]);

  const iconPath = React.useMemo(() => data.getIconPath(), [data]);

  const finalIconClass = React.useMemo(
    () =>
      quickOpenItemService.getIconClass({
        iconPath,
        iconClass,
      }),
    [iconClass, iconPath],
  );

  const buttons = React.useMemo(() => quickOpenItemService.getButtons(data.getButtons()), [data]);

  const [labelHighlights, descriptionHighlights, detailHighlights] = React.useMemo(() => data.getHighlights(), [data]);

  const [mouseOver, setMouseOver] = React.useState(false);

  const actions = React.useMemo(() => {
    const provider = widget.actionProvider;
    if (provider && provider.hasActions(data)) {
      return provider.getActions(data);
    }
  }, [data]);

  const runQuickOpenItem = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      // 如果为多选，则点击 item 为切换选中状态
      if (widget.canSelectMany) {
        data.checked = !data.checked;
        event.stopPropagation();
      } else {
        // 如果为鼠标中键，则为 BACKGROUND 类型
        const hide = event.button === 1 ? data.run(QuickOpenMode.OPEN_IN_BACKGROUND) : data.run(QuickOpenMode.OPEN);
        if (hide) {
          widget.hide(HideReason.ELEMENT_SELECTED);
        }
      }
    },
    [data],
  );

  const runQuickOpenItemAction = React.useCallback(
    (action: QuickOpenAction) => {
      action.run(data);
      widget.hide(HideReason.ELEMENT_SELECTED);
    },
    [data],
  );

  const onSelectButton = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>, button: QuickInputButton) => {
      event.stopPropagation();
      quickOpenItemService.fireDidTriggerItemButton(index, button);
    },
    [data],
  );

  return (
    <div
      id={VIEW_CONTAINERS.QUICKPICK_ITEM}
      tabIndex={0}
      className={cls(
        {
          [styles.item_selected]: widget.selectIndex === index,
          [styles.item_border]: showBorder,
        },
        styles.item,
      )}
      onMouseEnter={() => setMouseOver(true)}
      onMouseLeave={() => setMouseOver(false)}
      aria-label={label}
    >
      {widget.canSelectMany && (
        <CheckBox
          wrapTabIndex={0}
          checked={data.checked}
          onChange={(event) => (data.checked = (event.target as HTMLInputElement).checked)}
        />
      )}
      {/* tabIndex is needed here, pls see https://stackoverflow.com/questions/42764494/blur-event-relatedtarget-returns-null */}
      <div tabIndex={0} className={styles.item_label_container} onMouseDown={runQuickOpenItem}>
        <div className={styles.item_label}>
          {finalIconClass && <span className={cls(styles.item_icon, finalIconClass)}></span>}
          <HighlightLabel
            className={styles.item_label_name}
            labelClassName={styles.label_icon_container}
            labelIconClassName={styles.item_label_name_icon}
            hightLightClassName={cls(styles.item_label_highlight)}
            text={label}
            highlights={labelHighlights}
          />
          {description && (
            <HighlightLabel
              className={styles.item_label_description}
              labelClassName={cls(styles.label_icon_container, styles.item_label_description_label)}
              labelIconClassName={cls(styles.label_has_icon, styles.item_label_description_icon)}
              hightLightClassName={cls(styles.item_label_description_highlight)}
              text={description}
              highlights={descriptionHighlights}
            />
          )}
        </div>
        {detail && (
          <HighlightLabel
            OutElementType='div'
            className={styles.item_label_detail}
            labelClassName={cls(styles.label_icon_container, styles.item_label_description_label)}
            labelIconClassName={cls(styles.label_has_icon, styles.item_label_detail_icon)}
            hightLightClassName={cls(styles.item_label_description_highlight)}
            text={detail}
            highlights={detailHighlights}
          />
        )}
      </div>
      {keybinding && <KeybindingView keybinding={keybinding} />}
      {groupLabel && (
        <span title={groupLabel} className={styles.item_group_label}>
          {groupLabel}
        </span>
      )}
      {actions?.map((action) => (
        <span
          key={action.id}
          onMouseDown={() => runQuickOpenItemAction(action)}
          title={action.tooltip || action.label}
          className={cls(styles.item_action, action.class)}
        ></span>
      ))}
      {(mouseOver || widget.selectIndex === index) &&
        buttons?.map((button) => (
          <QuickOpenButton onMouseDown={(event) => onSelectButton(event, button)} button={button} />
        ))}
    </div>
  );
});

export const QuickOpenList: React.FC<{
  onReady: (api: IRecycleListHandler) => void;
  onScroll: (props: ListOnScrollProps) => void;
}> = observer(({ onReady, onScroll }) => {
  const { widget } = React.useContext(QuickOpenContext);
  const styles_quickopen_list = useDesignStyles(styles.quickopen_list, 'quickopen_list');

  const getSize = React.useCallback(
    (index) => {
      const item = widget.items[index];
      return item?.getDetail() ? 44 : 22;
    },
    [widget.items],
  );

  return widget.items.length > 0 ? (
    <RecycleList
      onReady={onReady}
      onScroll={onScroll}
      className={cls(styles_quickopen_list, {
        [styles.validate_error]: widget.validateType === VALIDATE_TYPE.ERROR,
        [styles.validate_warning]: widget.validateType === VALIDATE_TYPE.WARNING,
      })}
      data={widget.items}
      template={QuickOpenItemView}
      getSize={getSize}
      maxHeight={widget.items.length ? widget.MAX_HEIGHT : 0}
      hiddenHorizontalScrollbar
    />
  ) : null;
});

export const QuickOpenProgress = observer(() => {
  const { widget } = React.useContext(QuickOpenContext);
  const progressService: IProgressService = useInjectable(IProgressService);
  const indicator = progressService.getIndicator(VIEW_CONTAINERS.QUICKPICK_PROGRESS);

  React.useEffect(() => {
    widget.updateProgressStatus(!!widget.busy);
  }, [widget.busy]);

  return (
    <div id={VIEW_CONTAINERS.QUICKPICK_PROGRESS} className={styles.progress_bar}>
      <ProgressBar progressModel={indicator!.progressModel} />
    </div>
  );
});

export const QuickOpenView = observer(() => {
  const { widget } = React.useContext(QuickOpenContext);
  const listApi = React.useRef<IRecycleListHandler>();

  const scrollOffsetBefore = React.useRef(0);

  // https://stackoverflow.com/questions/38019140/react-and-blur-event/38019906#38019906
  const focusInCurrentTarget = React.useCallback(({ relatedTarget, currentTarget }) => {
    if (relatedTarget === null) {
      return false;
    }

    let node = relatedTarget.parentNode;

    while (node !== null) {
      if (node === currentTarget) {
        return true;
      }
      node = node.parentNode;
    }

    return false;
  }, []);

  /**
   * 当你修改这里的 onblur 事件之后，请确认一下几件事情
   * - 按 ctrl+g，输入行号，按回车，看是否转到了对应的行
   * - 按 ctrl+g，输入行号，按 esc，行号没有跳转
   * - 按 ctrl+g，输入行号，鼠标点击 quickOpen 的第一项，看是否转到了对应的行
   * - 按 ctrl+shift+p，输入命令，按回车，看它的功能是否正常
   * - 按 ctrl+shift+p，按 esc，看该框是否取消
   * - 按 ctrl+shift+p，鼠标点击编辑器区域，看该框是否取消
   */
  const onBlur = React.useCallback(
    (event: React.FocusEvent) => {
      if (focusInCurrentTarget(event)) {
        // 判断触发事件的元素是否在父元素内，如果在父元素内就不做处理
        return;
      }
      widget.blur();
    },
    [widget],
  );

  const onListReady = React.useCallback(
    (api: IRecycleListHandler) => {
      listApi.current = api;
    },
    [widget],
  );

  const onListScroll = React.useCallback(
    (props: ListOnScrollProps) => {
      scrollOffsetBefore.current = props.scrollOffset;
    },
    [widget],
  );

  // 执行 autoFocus
  React.useEffect(() => {
    const { items, autoFocus } = widget;

    if (!autoFocus) {
      return;
    }
    // First check for auto focus of prefix matches
    if (autoFocus.autoFocusPrefixMatch) {
      let caseSensitiveMatch: any;
      let caseInsensitiveMatch: any;
      const prefix = autoFocus.autoFocusPrefixMatch;
      const lowerCasePrefix = prefix.toLowerCase();
      for (const item of items) {
        const label = item.getLabel() || '';

        if (!caseSensitiveMatch && label.indexOf(prefix) === 0) {
          caseSensitiveMatch = item;
        } else if (!caseInsensitiveMatch && label.toLowerCase().indexOf(lowerCasePrefix) === 0) {
          caseInsensitiveMatch = item;
        }

        if (caseSensitiveMatch && caseInsensitiveMatch) {
          break;
        }
      }

      const entryToFocus = caseSensitiveMatch || caseInsensitiveMatch;
      if (entryToFocus) {
        const index = items.indexOf(entryToFocus);
        widget.setSelectIndex(index);
        return;
      }
    }

    if (autoFocus.autoFocusFirstEntry) {
      widget.setSelectIndex(0);
    } else if (typeof autoFocus.autoFocusIndex === 'number') {
      if (items.length > autoFocus.autoFocusIndex) {
        widget.setSelectIndex(autoFocus.autoFocusIndex);
      }
    } else if (autoFocus.autoFocusSecondEntry) {
      if (items.length > 1) {
        widget.setSelectIndex(1);
      }
    } else if (autoFocus.autoFocusLastEntry) {
      if (items.length > 1) {
        widget.setSelectIndex(items.length - 1);
      }
    }
  }, [widget.items, widget.autoFocus]);

  React.useEffect(() => {
    if (widget.keepScrollPosition) {
      listApi.current?.scrollTo(scrollOffsetBefore.current);
    } else {
      // smart 效果可以还原 vscode quickopen 上下切换的效果
      listApi.current?.scrollToIndex(widget.selectIndex, 'smart');
    }

    if (widget.items.length === 0) {
      return;
    }
    // 执行 run in background
    const item = widget.items[widget.selectIndex];
    if (!item) {
      return;
    }
    item.run(QuickOpenMode.PREVIEW);
    widget.callbacks.onSelect(item, widget.selectIndex);
  }, [widget.items, widget.selectIndex, widget.keepScrollPosition]);

  const onKeydown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    // 处于 composition 的输入，不做处理，否则在按 enter 后会直接打开选择的第一个文件，并且快捷键完全失效
    if (KEY_CODE_MAP[event.nativeEvent.keyCode] === KeyCodeEnum.KEY_IN_COMPOSITION) {
      return;
    }
    const { key } = KeyCode.createKeyCode(event.nativeEvent);
    if (!key) {
      return;
    }
    const length = widget.items.length;
    switch (key.keyCode) {
      case Key.ARROW_UP.keyCode: {
        event.preventDefault();
        event.stopPropagation();
        const selectIndex = widget.selectIndex - 1;
        widget.setSelectIndex((length + (selectIndex % length)) % length);
        break;
      }
      case Key.ARROW_DOWN.keyCode: {
        event.preventDefault();
        event.stopPropagation();
        const selectIndex = widget.selectIndex + 1;
        widget.setSelectIndex(selectIndex % length);
        break;
      }
      case Key.ESCAPE.keyCode: {
        event.preventDefault();
        event.stopPropagation();
        widget.hide(HideReason.CANCELED);
        break;
      }
      case Key.ENTER.keyCode: {
        event.preventDefault();
        event.stopPropagation();
        const item = widget.items[widget.selectIndex];
        if (!item) {
          return;
        }
        const hide = item.run(QuickOpenMode.OPEN);
        if (hide) {
          widget.hide(HideReason.ELEMENT_SELECTED);
        }
        break;
      }
      case Key.TAB.keyCode: {
        if (widget.toggleTab) {
          event.preventDefault();
          event.stopPropagation();
          widget.toggleTab();
        }
        break;
      }
    }
  }, []);

  return widget.isShow ? (
    <div id={VIEW_CONTAINERS.QUICKPICK} tabIndex={0} className={styles.container} onKeyDown={onKeydown} onBlur={onBlur}>
      <QuickOpenHeader />
      <QuickOpenInput />
      <QuickOpenProgress />
      {widget.renderTab?.()}
      <QuickOpenList onReady={onListReady} onScroll={onListScroll} />
    </div>
  ) : null;
});
