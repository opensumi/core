import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as cls from 'classnames';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import * as styles from './keymaps.module.less';
import { Input, RecycleList } from '@ali/ide-core-browser/lib/components';
import { localize, useInjectable, MessageType, KeybindingScope, noKeybidingInputName, KeyCode, Key } from '@ali/ide-core-browser';
import { KeymapService } from './keymaps.service';
import { IKeymapService, KeybindingItem } from '../common';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
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
    const [isEditing, setIsEditing] = React.useState(false);
    const [value, setValue] = React.useState(keybinding);
    const [isDirty, setIsDirty] = React.useState(false);
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
          command: id,
          when: when || '',
          context: context || '',
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

    const changeHandler = (event) => {
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
        return <span className={cls(getIcon('rollback'), styles.keybinding_inline_action)} onClick={reset}></span>;
      }
    };

    const renderKeybinding = () => {
      if (isEditing) {
        return <Input className={styles.keybinding_key_input} autoFocus={true} name={noKeybidingInputName} value={value} onChange={changeHandler} onKeyDown={keydownHandler} onBlur={blurHandler} />;
      } else {
        return <span className={styles.keybinding_key} dangerouslySetInnerHTML={{ __html: keybinding || '' }}></span>;
      }
    };

    return <div className={cls(styles.keybinding_list_item, index % 2 === 1 && styles.odd)}>
      <div className={styles.keybinding_action} onClick={clickHandler}>
        <i className={cls(keybinding ? getIcon('edit') : getIcon('plus'))}></i>
      </div>
      <div className={styles.keybinding_list_item_box} dangerouslySetInnerHTML={{ __html: command }}></div>
      <div className={cls(styles.keybinding_list_item_box)}>
        {
          renderKeybinding()
        }
      </div>
      <div className={styles.keybinding_list_item_box} dangerouslySetInnerHTML={{ __html: context || when || '—' }}>
      </div>
      <div className={styles.keybinding_list_item_box}>
        <span dangerouslySetInnerHTML={{ __html: source || '' }}></span>
        {renderReset(source)}
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

  return (
    <div className={styles.keybinding_container}>
      <div className={styles.keybinding_header} >
        <div className={styles.search_container}>
          <Input
            className={styles.search_input}
            placeholder={localize('keymaps.search.placeholder')}
            type='text'
            onKeyUp={searchKeybindings}
          />
        </div>
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
