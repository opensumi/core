import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as cls from 'classnames';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as styles from './keymaps.module.less';
import { RecycleList } from '@ali/ide-core-browser/lib/components';
import { Input } from '@ali/ide-components';
import { localize, useInjectable, MessageType, KeybindingScope, noKeybidingInputName, KeyCode, Key } from '@ali/ide-core-browser';
import { KeymapService } from './keymaps.service';
import { IKeymapService, KeybindingItem } from '../common';
import { getIcon } from '@ali/ide-core-browser';
import { IMessageService } from '@ali/ide-overlay';

export const KeymapsView: ReactEditorComponent<null> = observer(() => {

  const {
    keybindings,
    searchKeybindings,
    validateKeybinding,
    setKeybinding,
    removeKeybinding,
    getRaw,
    getScope,
    covert,
    clearCovert,
    fixed,
  }: KeymapService = useInjectable(IKeymapService);
  const [activeKeyboardSearch, setActiveKeyboardSearch] = React.useState<boolean>(false);

  const [search, setSearch] = React.useState<string>('');

  const message: IMessageService = useInjectable(IMessageService);

  const template = ({
    data,
    index,
  }) => {
    const {
      id,
      command,
      context,
      when,
      source,
      keybinding,
    }: KeybindingItem = data;
    const [isEditing, setIsEditing] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<string | undefined>(keybinding);
    const [isDirty, setIsDirty] = React.useState<boolean>(false);
    const clickHandler = () => {
      // 修改时固定设置页面
      if (!isDirty) {
        fixed();
        setIsDirty(true);
      }
      clearCovert();
      setValue(keybinding);
      setIsEditing(true);
    };
    const updateKeybinding = (value: string) => {
      const validateMessage = validateKeybinding(data, value);
      if (validateMessage) {
        if (validateMessage !== ' ') {
          message.open(validateMessage, MessageType.Error);
        }
      } else {
        setKeybinding({
          command: getRaw(id),
          when: getRaw(when) || '',
          context: getRaw(context) || '',
          keybinding: value,
        });
        clearCovert();
      }
    };
    const blurHandler = () => {
      if (value) {
        updateKeybinding(value);
      }
      setIsEditing(false);
    };

    const keydownHandler = (event: React.KeyboardEvent) => {
      event.stopPropagation();
      event.preventDefault();
      const { key } = KeyCode.createKeyCode(event.nativeEvent);
      if (key && Key.ENTER.keyCode === key.keyCode) {
        if (value) {
          updateKeybinding(value);
        }
        setIsEditing(false);
      } else {
        setValue(covert(event.nativeEvent));
      }
    };

    const renderReset = (source?: string) => {
      // 修改时固定设置页面
      if (!isDirty) {
        fixed();
        setIsDirty(true);
      }
      const reset = () => {
        removeKeybinding(id);
      };
      if (source && getRaw(source) === getScope(KeybindingScope.USER)) {
        return <span className={cls(getIcon('rollback'), styles.keybinding_inline_action)} onClick={reset} title={localize('keymaps.action.reset')}></span>;
      }
    };

    const renderKeybinding = () => {
      if (isEditing) {
        return <Input className={styles.keybinding_key_input} size='small' autoFocus={true} name={noKeybidingInputName} value={value} onKeyDown={keydownHandler} onBlur={blurHandler} />;
      } else {
        const keyBlocks = keybinding?.split(' ');
        return <div className={styles.keybinding_key} title={getRaw(keybinding)}>
          <div className={styles.keybinding_action} onClick={clickHandler}>
            <span className={cls(keybinding ? getIcon('edit') : getIcon('plus'), styles.keybinding_inline_action)} title={keybinding ? localize('keymaps.action.edit') : localize('keymaps.action.add')}></span>
            {renderReset(source)}
          </div>
          {
            keyBlocks?.map((block) => {
              const keys = block.split('+');
              return <div className={styles.keybinding_key_block}>
                {
                  keys.map((key) => {
                    return <div className={styles.keybinding_key_item} dangerouslySetInnerHTML={{ __html: key || '' }}></div>;
                  })
                }
              </div>;
            })
          }
        </div>;

      }
    };

    return <div className={cls(styles.keybinding_list_item, index % 2 === 1 && styles.odd)}>
      <div className={styles.keybinding_list_item_box} title={getRaw(command)} dangerouslySetInnerHTML={{ __html: command }}></div>
      <div className={cls(styles.keybinding_list_item_box)}>
        {
          renderKeybinding()
        }
      </div>
      <div className={styles.keybinding_list_item_box} title={getRaw(context || when || '—')} dangerouslySetInnerHTML={{ __html: context || when || '—' }}>
      </div>
      <div className={styles.keybinding_list_item_box}>
        <span title={getRaw(source)} dangerouslySetInnerHTML={{ __html: source || '' }}></span>
      </div>
    </div>;
  };

  const header = [
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

  const renderInputPlaceholder = () => {
    const activeKeyboard = () => {
      setActiveKeyboardSearch(!activeKeyboardSearch);
    };
    return <div className={styles.search_inline_action}>
      <span
        className={cls(getIcon('keyboard'), styles.search_inline_action_icon, activeKeyboardSearch && styles.active)}
        onClick={activeKeyboard}
      ></span>
    </div>;
  };

  const onChangeHandler = (event) => {
    if (!activeKeyboardSearch) {
      const value = event.target && event.target.value ? event.target.value.toLocaleLowerCase() : '';
      setSearch(value);
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
        setSearch(covert(event.nativeEvent));
      }
    }
  };

  React.useEffect(() => {
    searchKeybindings(search);
  }, [search]);

  const renderSearchInput = () => {
    return <div className={styles.search_container}>
      { renderInputPlaceholder() }
      <Input
        className={styles.search_input}
        placeholder={localize(activeKeyboardSearch ? 'keymaps.search.keyboard.placeholder' : 'keymaps.search.placeholder')}
        type='text'
        value={search}
        onChange={onChangeHandler}
        onKeyDown={onKeyDownHandler}
      />
    </div>;
  };

  return (
    <div className={styles.keybinding_container}>
      <div className={styles.keybinding_header} >
        { renderSearchInput() }
      </div>
      <div className={styles.keybinding_body} >
        <RecycleList
          header={header}
          data={keybindings}
          template={template}
          className={styles.keybinding_list_container}
        />
      </div>
    </div>
  );
});
