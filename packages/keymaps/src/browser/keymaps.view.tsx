import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useCallback } from 'react';

import { Input, ValidateInput, VALIDATE_TYPE, ValidateMessage } from '@opensumi/ide-components';
import { RecycleList } from '@opensumi/ide-components';
import {
  localize,
  useInjectable,
  KeybindingScope,
  NO_KEYBINDING_NAME,
  KeyCode,
  Key,
  formatLocalize,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser';

import { IKeymapService, KeybindingItem } from '../common';

import styles from './keymaps.module.less';
import { KeymapService } from './keymaps.service';


export const KeymapsView: ReactEditorComponent<null> = observer(() => {
  const {
    keybindings,
    searchKeybindings,
    validateKeybinding,
    detectKeybindings,
    setKeybinding,
    resetKeybinding,
    getRaw,
    getScope,
    covert,
    clearCovert,
    fixed,
  }: KeymapService = useInjectable(IKeymapService);
  const [activeKeyboardSearch, setActiveKeyboardSearch] = React.useState<boolean>(false);

  const [search, setSearch] = React.useState<string>('');

  const template = ({ data, index }) => {
    const { id, command, when, source, keybinding }: KeybindingItem = data;
    const [isEditing, setIsEditing] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<string>(keybinding || '');
    const [isDirty, setIsDirty] = React.useState<boolean>(false);
    const [validateMessage, setValidateMessage] = React.useState<ValidateMessage>();
    const [detectiveKeybindings, setDetectiveKeybindings] = React.useState<KeybindingItem[]>([]);
    const clickHandler = () => {
      // 修改时固定设置页面
      if (!isDirty) {
        fixed();
        setIsDirty(true);
      }
      clearCovert();
      // 每次keybinding编辑的时候还原快捷键文本
      setValue(getRaw(keybinding));
      setIsEditing(true);
    };

    const updateKeybinding = (value: string) => {
      const validateMessage = validateKeybinding(data, value);
      if (validateMessage) {
        // ' ' 表示快捷键未修改
        if (validateMessage !== ' ') {
          setValidateMessage({
            message: validateMessage,
            type: VALIDATE_TYPE.ERROR,
          });
        } else {
          setIsEditing(false);
        }
      } else {
        setKeybinding({
          command: getRaw(id),
          when: getRaw(when) || '',
          keybinding: value,
        });
        setIsEditing(false);
        clearCovert();
      }
    };

    const blurHandler = (event) => {
      setIsEditing(false);
    };

    const keydownHandler = (event: React.KeyboardEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const { key } = KeyCode.createKeyCode(event.nativeEvent);
      const hasModifyKey =
        event.nativeEvent.shiftKey ||
        event.nativeEvent.metaKey ||
        event.nativeEvent.altKey ||
        event.nativeEvent.ctrlKey;
      if (key && Key.ENTER.keyCode === key.keyCode && !hasModifyKey) {
        if (value) {
          updateKeybinding(value);
        }
      } else {
        setValue(covert(event.nativeEvent));
      }
    };

    const renderOptionalActions = () => {
      const clear = () => {
        setValidateMessage(undefined);
        setValue('');
        clearCovert();
      };
      const preventMouseDown = (event) => {
        event.stopPropagation();
        event.preventDefault();
      };
      return (
        <div className={styles.keybinding_optional_actions} onMouseDown={preventMouseDown}>
          <span
            className={cls(getIcon('close-circle-fill'), styles.keybinding_optional_action)}
            onClick={clear}
            title={localize('keymaps.action.clear')}
          ></span>
        </div>
      );
    };

    const renderPlaceholder = () => <div className={styles.keybinding_key_input_placeholder}>⏎</div>;

    const renderReset = (source?: string) => {
      // 修改时固定设置页面
      if (!isDirty) {
        fixed();
        setIsDirty(true);
      }
      const reset = (event) => {
        event.preventDefault();
        resetKeybinding({
          command: getRaw(id),
          when: getRaw(when) || '',
          keybinding: value,
        });
      };
      // 重置快捷键作用域
      if (source && getRaw(source) === getScope(KeybindingScope.USER)) {
        return (
          <span
            className={cls(getIcon('rollback'), styles.keybinding_inline_action)}
            onClick={reset}
            title={localize('keymaps.action.reset')}
          ></span>
        );
      }
    };

    const renderDetectiveKeybindings = () => {
      if (!validateMessage && detectiveKeybindings.length > 0) {
        return (
          <div className={styles.keybinding_detective_messages}>
            <div className={styles.keybinding_detective_messages_label}>
              {formatLocalize('keymaps.keybinding.duplicate', detectiveKeybindings.length)}
            </div>
            <ul className={styles.keybinding_detective_messages_container}>
              {detectiveKeybindings.map((keybinding: KeybindingItem, index: number) => (
                <li
                  className={styles.keybinding_detective_messages_item}
                  key={`${keybinding.id}_${index}`}
                  title={`${keybinding.command}-${keybinding.when}`}
                >
                  <div className={styles.title}>
                    {localize('keymaps.header.command.title')}: {keybinding.command}
                  </div>
                  <div className={styles.description}>
                    <div style={{ marginRight: 4 }}>
                      {localize('keymaps.header.source.title')}: {getRaw(keybinding.source) || '-'}
                    </div>
                    <div>
                      {localize('keymaps.header.when.title')}: {keybinding.when || '—'}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      }
    };

    const renderKeybinding = () => {
      if (isEditing) {
        return (
          <div className={styles.keybinding_key_input_container}>
            {renderOptionalActions()}
            <ValidateInput
              placeholder={localize('keymaps.edit.placeholder')}
              validateMessage={validateMessage}
              className={styles.keybinding_key_input}
              size='small'
              autoFocus={true}
              name={NO_KEYBINDING_NAME}
              value={value}
              onKeyDown={keydownHandler}
              onBlur={blurHandler}
            />
            {renderPlaceholder()}
            {renderDetectiveKeybindings()}
          </div>
        );
      } else {
        const keyBlocks = keybinding?.split(' ');
        return (
          <div className={styles.keybinding_key} title={getRaw(keybinding)} onDoubleClick={clickHandler}>
            <div className={styles.keybinding_action} onClick={clickHandler}>
              <span
                className={cls(keybinding ? getIcon('edit') : getIcon('plus'), styles.keybinding_inline_action)}
                title={keybinding ? localize('keymaps.action.edit') : localize('keymaps.action.add')}
              ></span>
              {renderReset(source)}
            </div>
            {keyBlocks && !!keyBlocks[0]
              ? keyBlocks.map((block, index) => {
                  const keys = block.split('+');
                  return (
                    <div className={styles.keybinding_key_block} key={`${block}_${index}`}>
                      {keys.map((key, index) => (
                        <div
                          className={styles.keybinding_key_item}
                          key={`${key}_${index}`}
                          dangerouslySetInnerHTML={{ __html: key || '' }}
                        ></div>
                      ))}
                    </div>
                  );
                })
              : '—'}
          </div>
        );
      }
    };

    React.useEffect(() => {
      // 当值变化时清空错误信息
      if (validateMessage) {
        setValidateMessage(undefined);
      }
      // 根据快捷键查当前绑定的命令
      if (value && isEditing) {
        setDetectiveKeybindings(detectKeybindings(data, value));
      } else {
        setDetectiveKeybindings([]);
      }
    }, [value]);

    return (
      <div className={cls(styles.keybinding_list_item, index % 2 === 1 && styles.odd)}>
        <div className={styles.keybinding_list_item_box}>
          <div
            className={styles.limit_warp}
            title={getRaw(command)}
            dangerouslySetInnerHTML={{ __html: command }}
          ></div>
        </div>
        <div className={cls(styles.keybinding_list_item_box)}>{renderKeybinding()}</div>
        <div className={styles.keybinding_list_item_box}>
          <div
            className={styles.limit_warp}
            title={getRaw(when || '—')}
            dangerouslySetInnerHTML={{ __html: when || '—' }}
          ></div>
        </div>
        <div className={styles.keybinding_list_item_box}>
          <div title={getRaw(source)} dangerouslySetInnerHTML={{ __html: source || '' }}></div>
        </div>
      </div>
    );
  };

  const header = () => {
    const headers = [
      {
        title: localize('keymaps.header.command.title'),
        classname: styles.keybinding_header_item,
      },
      {
        title: localize('keymaps.header.keybinding.title'),
        classname: styles.keybinding_header_item,
      },
      {
        title: localize('keymaps.header.when.title'),
        classname: styles.keybinding_header_item,
      },
      {
        title: localize('keymaps.header.source.title'),
        classname: styles.keybinding_header_item,
      },
    ];
    return (
      <div className={styles.keybinding_header}>
        {headers.map((h, index) => (
          <div className={h.classname} key={`${h.title}_${index}`}>
            {h.title}
          </div>
        ))}
      </div>
    );
  };

  const renderInputPlaceholder = () => {
    const activeKeyboard = () => {
      setActiveKeyboardSearch(!activeKeyboardSearch);
    };
    return (
      <div className={styles.search_inline_action}>
        <span
          className={cls(getIcon('keyboard'), styles.search_inline_action_icon, activeKeyboardSearch && styles.active)}
          onClick={activeKeyboard}
        ></span>
      </div>
    );
  };

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      searchKeybindings(value);
    },
    [search],
  );

  const onChangeHandler = (event) => {
    if (!activeKeyboardSearch) {
      const value = event.target && event.target.value ? event.target.value.toLocaleLowerCase() : '';
      handleSearchChange(value);
    }
  };

  const onKeyDownHandler = (event) => {
    if (activeKeyboardSearch) {
      event.stopPropagation();
      event.preventDefault();
      const { key } = KeyCode.createKeyCode(event.nativeEvent);
      if (key && Key.ENTER.keyCode === key.keyCode) {
        // 屏蔽回车键作为快捷键搜索
        return;
      } else {
        handleSearchChange(covert(event.nativeEvent));
      }
    }
  };

  const clearSearch = () => {
    setSearch('');
    clearCovert();
  };

  const renderOptionalActions = () => (
    <div className={styles.keybinding_optional_actions}>
      <span
        className={cls(getIcon('close-circle-fill'), styles.keybinding_optional_action)}
        onClick={clearSearch}
        title={localize('keymaps.action.reset')}
      ></span>
    </div>
  );

  const renderSearchInput = () => (
    <div className={styles.search_container}>
      <Input
        className={styles.search_input}
        placeholder={localize(
          activeKeyboardSearch ? 'keymaps.search.keyboard.placeholder' : 'keymaps.search.placeholder',
        )}
        type='text'
        value={search}
        name={NO_KEYBINDING_NAME}
        onChange={onChangeHandler}
        onKeyDown={onKeyDownHandler}
        addonBefore={renderInputPlaceholder()}
      />
      {renderOptionalActions()}
    </div>
  );

  return (
    <div className={styles.keybinding_container}>
      <div className={styles.keybinding_header}>{renderSearchInput()}</div>
      <div className={styles.keybinding_body}>
        <RecycleList
          itemHeight={24}
          header={header}
          data={keybindings}
          template={template}
          className={styles.keybinding_list_container}
        />
      </div>
    </div>
  );
});
