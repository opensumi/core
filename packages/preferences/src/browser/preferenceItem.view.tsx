import * as React from 'react';
import { PreferenceScope, PreferenceService, useInjectable, PreferenceSchemaProvider, PreferenceItem, replaceLocalizePlaceholder, localize, getIcon, PreferenceDataProperty, isElectronRenderer, CommandService, EDITOR_COMMANDS, URI, IPreferenceSettingsService, PreferenceProvider } from '@ali/ide-core-browser';
import * as styles from './preferences.module.less';
import * as classnames from 'classnames';
import { Input, Select, Option, CheckBox, Button, ValidateInput } from '@ali/ide-components';
import { PreferenceSettingsService } from './preference.service';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import { IFileServiceClient } from '@ali/ide-file-service/lib/common';

import { toPreferenceReadableName } from '../common';
import { ValidateMessage } from '../../../components/lib';

interface IPreferenceItemProps {
  preferenceName: string;
  localizedName?: string;
  currentValue: any;
  schema: PreferenceItem;
  scope: PreferenceScope;
  effectingScope: PreferenceScope;
  hasValueInScope: boolean;
}
/**
 * 用于展示单个设置项的视图
 * 目前支持类型:
 *  string:
 *    含有 enum - 下拉选项框
 *    不含有 enum - 输入框
 *  number: 输入框
 *  array:
 *    只允许 string类 - 可视化编辑项
 *  object:
 *    暂不支持
 */
export const NextPreferenceItem = ({ preferenceName, localizedName, scope }: { preferenceName: string, localizedName?: string, scope: PreferenceScope }) => {

  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);

  const preferenceProvider: PreferenceProvider = preferenceService.getProvider(scope)!;

  // 获得当前的schema
  const schema = schemaProvider.getPreferenceProperty(preferenceName);

  // 获得这个设置项的当前值
  const { value: inherited, effectingScope } = settingsService.getPreference(preferenceName, scope);
  const [value, setValue] = React.useState<boolean | string | string[]>(preferenceProvider.get<boolean | string | string[]>(preferenceName)!);

  let inheritedValue = inherited;
  // 当这个设置项被外部变更时，更新局部值
  React.useEffect(() => {
    const disposer = preferenceProvider.onDidPreferencesChanged((e) => {
      if (e.default && e.default.hasOwnProperty(preferenceName)) {
        const newValue = e.default[preferenceName].newValue;
        if (!newValue) {
          inheritedValue = settingsService.getPreference(preferenceName, scope).value;
        }
        setValue(newValue);
      }
    });
    return () => {
      disposer.dispose();
    };
  }, []);

  if (!localizedName) {
    localizedName = toPreferenceReadableName(preferenceName);
  }

  const renderPreferenceItem = () => {
    if (schema) {
      const props = {
        preferenceName,
        scope,
        effectingScope,
        schema,
        currentValue: value === undefined ? inheritedValue : value,
        localizedName,
        hasValueInScope: value !== undefined,
      };

      switch (schema.type) {
        case 'boolean':
          return <CheckboxPreferenceItem {...props} />;
        case 'integer':
        case 'number':
          return <InputPreferenceItem {...props} isNumber={true} />;
        case 'string':
          if (schema.enum) {
            return <SelectPreferenceItem {...props} />;
          } else {
            return <InputPreferenceItem {...props} />;
          }
        case 'array':
          if (schema.items && schema.items.type === 'string') {
            return <StringArrayPreferenceItem {...props} />;
          } else {
            return <EditInSettingsJsonPreferenceItem {...props} />;
          }
        default:
          return <EditInSettingsJsonPreferenceItem {...props} />;
      }
    }
    return <div></div>;
  };

  return <div className={classnames({
    [styles.preference_item]: true,
    [styles.modified]: value !== undefined,
  })}>
    {renderPreferenceItem()}
  </div>;

};

const SettingStatus = ({ preferenceName, scope, effectingScope, hasValueInScope }: { preferenceName: string, scope: PreferenceScope, effectingScope: PreferenceScope, hasValueInScope: boolean }) => {
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  return <span className={styles.preference_status}>
    {
      effectingScope === PreferenceScope.Workspace && scope === PreferenceScope.User ? <span className={styles.preference_overwritten}>{localize('preference.overwrittenInWorkspace')}</span> : undefined
    }
    {
      effectingScope === PreferenceScope.User && scope === PreferenceScope.Workspace ? <span className={styles.preference_overwritten}>{localize('preference.overwrittenInUser')}</span> : undefined
    }
    {
      hasValueInScope ? <span className={classnames(styles.preference_reset, getIcon('rollback'))} onClick={(e) => {
        settingsService.reset(preferenceName, scope);
      }}></span> : undefined
    }
  </span>;
};

function InputPreferenceItem({ preferenceName, localizedName, currentValue, schema, isNumber, effectingScope, scope, hasValueInScope }: IPreferenceItemProps & { isNumber?: boolean }) {

  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);
  const [value, setValue] = React.useState<string>();

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = ((value) => {
    if (hasValidateError(value)) {
      // scheme校验失败
      return;
    }
    preferenceService.set(preferenceName, value, scope);
    setValue(value);
  });

  function hasValidateError(value): ValidateMessage | undefined {
    const res = schemaProvider.validate(preferenceName, value);
    if (res.valid) {
      return undefined;
    } else {
      return {
        type: 2,
        message: res.reason,
      };
    }
  }

  return <div className={styles.preference_line}>
    <div className={styles.key}>
      {localizedName} <SettingStatus preferenceName={preferenceName} scope={scope} effectingScope={effectingScope} hasValueInScope={hasValueInScope} />
    </div>
    {schema && schema.description && <div className={styles.desc}>{replaceLocalizePlaceholder(schema.description)}</div>}
    <div className={styles.control_wrap}>
      <div className={styles.text_control}>
        <ValidateInput
          type={isNumber ? 'number' : 'text'}
          validate={hasValidateError}
          onBlur={(event) => {
            const value = isNumber ? event.target.valueAsNumber : event.target.value;
            handleValueChange(value);
          }}
          value={value}
        />
      </div>
    </div>
  </div>;
}

function CheckboxPreferenceItem({ preferenceName, localizedName, currentValue, schema, effectingScope, scope, hasValueInScope }: IPreferenceItemProps) {
  const description = schema && schema.description && replaceLocalizePlaceholder(schema.description);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);

  const [value, setValue] = React.useState<boolean>();

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = ((value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  });

  return (
    <div className={styles.preference_line}>
      <div className={classnames(styles.check, styles.key)}>
        <CheckBox label={localizedName} checked={value} onChange={(event) => {
          handleValueChange((event.target as HTMLInputElement).checked);
        }} />
        <SettingStatus preferenceName={preferenceName} scope={scope} effectingScope={effectingScope} hasValueInScope={hasValueInScope} />
      </div>
      {
        description ?
          <div>
            <div className={styles.desc}>{description}</div>
          </div> : undefined
      }
    </div>
  );
}

function SelectPreferenceItem({ preferenceName, localizedName, currentValue, schema, effectingScope, scope, hasValueInScope }: IPreferenceItemProps) {

  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const [value, setValue] = React.useState<string>();

  const optionEnum = (schema as PreferenceDataProperty).enum;

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  if (!Array.isArray(optionEnum) || !optionEnum.length) {
    return <div></div>;
  }

  const handlerValueChange = ((value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  });

  // enum 本身为 string[] | number[]
  const labels = settingsService.getEnumLabels(preferenceName);
  const options = optionEnum && optionEnum.map((item, idx) =>
    isElectronRenderer() ?
      <option value={item} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</option> :
      <Option value={item} label={replaceLocalizePlaceholder((labels[item] || item).toString())} key={`${idx} - ${item}`}>{
        replaceLocalizePlaceholder((labels[item] || item).toString())
      }</Option>);

  return (
    <div className={styles.preference_line} >
      <div className={styles.key}>
        {localizedName} <SettingStatus preferenceName={preferenceName} scope={scope} effectingScope={effectingScope} hasValueInScope={hasValueInScope} />
      </div>
      {schema && schema.description && <div className={styles.desc}>{replaceLocalizePlaceholder(schema.description)}</div>}
      <div className={styles.control_wrap}>
        {isElectronRenderer() ?
          <NativeSelect onChange={(event) => {
            handlerValueChange(event.target.value);
          }}
            className={styles.select_control}
            value={value}
          >
            {options}
          </NativeSelect> :
          <Select maxHeight='300' onChange={handlerValueChange} value={value} className={styles.select_control}>
            {options}
          </Select>}
      </div>
    </div>
  );
}

function EditInSettingsJsonPreferenceItem({ preferenceName, localizedName, schema, effectingScope, scope, hasValueInScope }: IPreferenceItemProps) {

  const commandService = useInjectable<CommandService>(CommandService);
  const fileServiceClient = useInjectable<IFileServiceClient>(IFileServiceClient);

  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  const editSettingsJson = async () => {
    // TODO 更好的创建方式
    const openUri = await settingsService.getPreferenceUrl(scope);
    if (!openUri) {
      return;
    }
    const exist = await fileServiceClient.access(openUri);
    if (!exist) {
      try {
        await fileServiceClient.createFile(openUri, { content: '', overwrite: false });
      } catch (e) {
        // TODO: 告诉用户无法创建 settings.json
      }
    }
    commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, new URI(openUri));
  };

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName} <SettingStatus preferenceName={preferenceName} scope={scope} effectingScope={effectingScope} hasValueInScope={hasValueInScope} />
      </div>
      {schema && schema.description && <div className={styles.desc}>{replaceLocalizePlaceholder(schema.description)}</div>}
      <div className={styles.control_wrap}>
        <a onClick={editSettingsJson}>{localize('preference.editSettingsJson')}</a>
      </div>
    </div>
  );

}

// TODO: 优化这个组件
function StringArrayPreferenceItem({ preferenceName, localizedName, currentValue, schema, effectingScope, scope, hasValueInScope }: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [value, setValue] = React.useState<string[]>([]);

  React.useEffect(() => {
    setValue(currentValue || []);
  }, [currentValue]);

  const handleValueChange = ((value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  });

  let editEl;
  const addItem = () => {
    if (editEl.value) {
      const newValue = value.slice(0);
      const rawValue = editEl.value;
      // FIXME: 这里的Input状态管理存在问题，后续修复，目前先解决样式问题
      editEl.value = '';
      if (newValue.indexOf(rawValue) > -1) {
        return;
      }
      newValue.push(rawValue);
      handleValueChange(newValue);
    }
  };
  const removeItem = (idx) => {
    const newValue = value.slice(0);
    newValue.splice(idx, 1);
    if (newValue.length) {
      handleValueChange(newValue);
    } else {
      handleValueChange([]);
    }
  };

  const items: any[] = [];
  (currentValue || []).map((item, idx) => {
    items.push(
      <li className={styles.arr_items} key={`${idx} - ${JSON.stringify(item)}`}>
        <div onClick={() => { removeItem(idx); }} className={classnames(getIcon('delete'), styles.rm_icon, styles.arr_item)}></div>
        <div className={styles.arr_item}>{typeof item === 'string' ? item : JSON.stringify(item)}</div>
      </li>);
  });

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName} <SettingStatus preferenceName={preferenceName} scope={scope} effectingScope={effectingScope} hasValueInScope={hasValueInScope} />
      </div>
      {schema && schema.description && <div className={styles.desc}>{replaceLocalizePlaceholder(schema.description)}</div>}
      <div className={styles.control_wrap}>
        <ul className={styles.arr_list}>
          {items}
        </ul>
        <div className={styles.preferences_flex_row}>
          <Input
            type='text'
            className={styles.text_control}
            ref={(el) => { editEl = el; }}
          />
          <Button className={styles.add_button} onClick={addItem}>{localize('preference.array.additem', '添加')}</Button>
        </div>
      </div>
    </div>
  );
}
