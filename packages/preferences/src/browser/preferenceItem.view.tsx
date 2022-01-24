import React from 'react';
import {
  DisposableCollection,
  getIcon,
  IPreferenceSettingsService,
  isElectronRenderer,
  localize,
  PreferenceDataProperty,
  PreferenceItem,
  PreferenceProvider,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceService,
  replaceLocalizePlaceholder,
  useInjectable,
} from '@opensumi/ide-core-browser';
import styles from './preferences.module.less';
import classnames from 'classnames';
import { Button, CheckBox, Input, Option, Select, ValidateInput, ValidateMessage } from '@opensumi/ide-components';
import { PreferenceSettingsService } from './preference-settings.service';
import { toPreferenceReadableName } from '../common';

interface IPreferenceItemProps {
  preferenceName: string;
  localizedName?: string;
  currentValue: any;
  schema: PreferenceItem;
  scope: PreferenceScope;
  effectingScope: PreferenceScope;
  hasValueInScope: boolean;
}

const DESCRIPTION_EXPRESSION_REGEXP = /`#(.+)#`/gi;
const NONE_SELECT_OPTION = 'none';

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
export const NextPreferenceItem = ({
  preferenceName,
  localizedName,
  scope,
}: {
  preferenceName: string;
  localizedName?: string;
  scope: PreferenceScope;
}) => {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);

  const preferenceProvider: PreferenceProvider = preferenceService.getProvider(scope)!;

  // 获得这个设置项的当前值
  const { value: inherited, effectingScope } = settingsService.getPreference(preferenceName, scope);
  const [value, setValue] = React.useState<boolean | string | string[] | undefined>(
    preferenceProvider.get<boolean | string | string[]>(preferenceName)!,
  );
  const [schema, setSchema] = React.useState<PreferenceItem>();

  // 当这个设置项被外部变更时，更新局部值
  React.useEffect(() => {
    // 获得当前的schema
    const schemas = schemaProvider.getPreferenceProperty(preferenceName);
    setSchema(schemas);

    const disposableCollection = new DisposableCollection();
    // 监听配置变化
    disposableCollection.push(
      preferenceProvider.onDidPreferencesChanged((e) => {
        if (e.default && e.default.hasOwnProperty(preferenceName)) {
          if (e.default[preferenceName].scope === scope) {
            const newValue = e.default[preferenceName].newValue;
            setValue(newValue);
          }
        }
      }),
    );

    disposableCollection.push(
      settingsService.onDidEnumLabelsChange(() => {
        const schemas = schemaProvider.getPreferenceProperty(preferenceName);
        setSchema(schemas);
      }),
    );

    return () => {
      disposableCollection.dispose();
    };
  }, []);

  if (!localizedName) {
    localizedName = toPreferenceReadableName(preferenceName);
  }

  const renderPreferenceItem = () => {
    let renderSchema = schema;
    if (!renderSchema) {
      // 渲染阶段可能存在还没获取到 schema 的情况
      renderSchema = schemaProvider.getPreferenceProperty(preferenceName)!;
    }
    if (renderSchema) {
      const props = {
        preferenceName,
        scope,
        effectingScope,
        schema: renderSchema!,
        currentValue: value === undefined ? inherited : value,
        localizedName,
        hasValueInScope: value !== undefined,
      };

      switch (renderSchema!.type) {
        case 'boolean':
          return <CheckboxPreferenceItem {...props} />;
        case 'integer':
        case 'number':
          if (renderSchema.enum) {
            return <SelectPreferenceItem {...props} />;
          } else {
            return <InputPreferenceItem {...props} />;
          }
        case 'string':
          if (renderSchema.enum) {
            return <SelectPreferenceItem {...props} />;
          } else {
            return <InputPreferenceItem {...props} />;
          }
        case 'array':
          if (renderSchema.items && renderSchema.items.type === 'string') {
            return <StringArrayPreferenceItem {...props} />;
          } else {
            return <EditInSettingsJsonPreferenceItem {...props} />;
          }
        default:
          return <EditInSettingsJsonPreferenceItem {...props} />;
      }
    }
  };

  return (
    <div
      className={classnames({
        [styles.preference_item]: true,
        [styles.modified]: value !== undefined,
      })}
    >
      {renderPreferenceItem()}
    </div>
  );
};

const renderDescriptionExpression = (des: string) => {
  const preferenceSettingService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const description = replaceLocalizePlaceholder(des);
  if (!description) {
    return null;
  }
  const match = DESCRIPTION_EXPRESSION_REGEXP.exec(description!);
  if (!match) {
    return description;
  }
  const { 0: expression, 1: preferenceId } = match;
  const preference = preferenceSettingService.getSectionByPreferenceId(preferenceId);
  if (preference) {
    const preferenceTitle = localize(preference.localized);
    const others: any[] = description
      .split(expression)
      .map((des: string, index: number) => <span key={`${preferenceId}-${index}`}>{des}</span>);
    const search = () => {
      preferenceSettingService.search(preferenceTitle);
    };
    const link = (
      <a onClick={search} key={preferenceId}>
        {preferenceTitle}
      </a>
    );
    others.splice(1, 0, link);
    return others;
  } else {
    return description;
  }
};

const SettingStatus = ({
  preferenceName,
  scope,
  effectingScope,
  hasValueInScope,
}: {
  preferenceName: string;
  scope: PreferenceScope;
  effectingScope: PreferenceScope;
  hasValueInScope: boolean;
}) => {
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  return (
    <span className={styles.preference_status}>
      {effectingScope === PreferenceScope.Workspace && scope === PreferenceScope.User ? (
        <span className={styles.preference_overwritten}>{localize('preference.overwrittenInWorkspace')}</span>
      ) : undefined}
      {effectingScope === PreferenceScope.User && scope === PreferenceScope.Workspace ? (
        <span className={styles.preference_overwritten}>{localize('preference.overwrittenInUser')}</span>
      ) : undefined}
      {hasValueInScope ? (
        <span
          className={classnames(styles.preference_reset, getIcon('rollback'))}
          onClick={(e) => {
            settingsService.reset(preferenceName, scope);
          }}
        ></span>
      ) : undefined}
    </span>
  );
};

function InputPreferenceItem({
  preferenceName,
  localizedName,
  currentValue,
  schema,
  isNumber,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps & { isNumber?: boolean }) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);
  const [value, setValue] = React.useState<string>();

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = (value) => {
    if (hasValidateError(value)) {
      // scheme校验失败
      return;
    }
    preferenceService.set(preferenceName, value, scope);
    setValue(value);
  };

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

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          hasValueInScope={hasValueInScope}
        />
      </div>
      {schema && schema.description && (
        <div className={styles.desc}>{renderDescriptionExpression(schema.description)}</div>
      )}
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
    </div>
  );
}

function CheckboxPreferenceItem({
  preferenceName,
  localizedName,
  currentValue,
  schema,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps) {
  const description = schema && schema.description && replaceLocalizePlaceholder(schema.description);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);

  const [value, setValue] = React.useState<boolean>();

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = (value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  };

  return (
    <div className={styles.preference_line}>
      <div className={classnames(styles.check, styles.key)}>
        <CheckBox
          label={localizedName}
          checked={value}
          onChange={(event) => {
            handleValueChange((event.target as HTMLInputElement).checked);
          }}
        />
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          hasValueInScope={hasValueInScope}
        />
      </div>
      {description ? (
        <div>
          <div className={styles.desc}>{renderDescriptionExpression(description)}</div>
        </div>
      ) : undefined}
    </div>
  );
}

function SelectPreferenceItem({
  preferenceName,
  localizedName,
  currentValue,
  schema,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const config = schema as PreferenceDataProperty;
  const optionEnum = config.enum;
  const optionEnumDescriptions = config.enumDescriptions;

  const [value, setValue] = React.useState<string>(currentValue);

  // 鼠标还没有划过来的时候，需要一个默认的描述信息
  const defaultDescription = React.useMemo((): string => {
    if (optionEnumDescriptions && optionEnum) {
      return optionEnumDescriptions[optionEnum.indexOf(currentValue)] || '';
    }

    return '';
  }, [schema]);
  const [description, setDescription] = React.useState<string>(defaultDescription);

  React.useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handlerValueChange = (value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  };

  // enum 本身为 string[] | number[]
  const labels = settingsService.getEnumLabels(preferenceName);

  const renderEnumOptions = () =>
    optionEnum?.map((item, idx) => {
      if (typeof item === 'boolean') {
        item = String(item);
      }

      return (
        <Option
          value={item}
          label={replaceLocalizePlaceholder((labels[item] || item).toString())}
          key={`${idx} - ${item}`}
          className={styles.select_option}
        >
          {replaceLocalizePlaceholder((labels[item] || item).toString())}
          {item === config.default && (
            <div className={styles.select_default_option_tips}>{localize('preference.enum.default')}</div>
          )}
        </Option>
      );
    });

  const renderNoneOptions = () =>
    isElectronRenderer() ? (
      <option value={localize('preference.stringArray.none')} key={NONE_SELECT_OPTION} disabled>
        {localize('preference.stringArray.none')}
      </option>
    ) : (
      <Option
        value={localize('preference.stringArray.none')}
        key={NONE_SELECT_OPTION}
        label={localize('preference.stringArray.none')}
        disabled
      >
        {localize('preference.stringArray.none')}
      </Option>
    );

  const options = optionEnum && optionEnum.length > 0 ? renderEnumOptions() : renderNoneOptions();

  // 处理鼠标移动时候对应枚举值描述的变化
  const handleDescriptionChange = React.useCallback(
    (_, index) => {
      if (optionEnumDescriptions) {
        const description = optionEnumDescriptions[index];
        if (description) {
          setDescription(description);
        } else {
          // 对应的描述不存在，则设置为空，在渲染时会过滤掉 falsy 的值
          setDescription('');
        }
      }
    },
    [optionEnumDescriptions, setDescription],
  );

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          hasValueInScope={hasValueInScope}
        />
      </div>
      {schema && schema.description && (
        <div className={styles.desc}>{renderDescriptionExpression(schema.description)}</div>
      )}
      <div className={styles.control_wrap}>
        <Select
          dropdownRenderType='absolute'
          maxHeight='200'
          onChange={handlerValueChange}
          value={value}
          className={styles.select_control}
          description={description}
          onMouseEnter={handleDescriptionChange}
        >
          {options}
        </Select>
      </div>
    </div>
  );
}

function EditInSettingsJsonPreferenceItem({
  preferenceName,
  localizedName,
  schema,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps) {
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  const editSettingsJson = async () => {
    settingsService.openJSON(scope, preferenceName);
  };

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          hasValueInScope={hasValueInScope}
        />
      </div>
      {schema && schema.description && (
        <div className={styles.desc}>{renderDescriptionExpression(schema.description)}</div>
      )}
      <div className={styles.control_wrap}>
        <a onClick={editSettingsJson}>{localize('preference.editSettingsJson')}</a>
      </div>
    </div>
  );
}

function StringArrayPreferenceItem({
  preferenceName,
  localizedName,
  currentValue,
  schema,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [value, setValue] = React.useState<string[]>([]);
  const [inputValue, setInputValue] = React.useState<string>();
  const [editValue, setEditValue] = React.useState<string>();
  const [currentEditIndex, setCurrentEditIndex] = React.useState<number>(-1);

  React.useEffect(() => {
    setValue(currentValue || []);
  }, [currentValue]);

  React.useEffect(() => {
    if (currentEditIndex >= 0) {
      setEditValue(value[currentEditIndex]);
    } else {
      setEditValue('');
    }
  }, [currentEditIndex]);

  const handleValueChange = (value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  };

  const addItem = () => {
    if (inputValue) {
      const newValue = value.slice(0);
      if (newValue.indexOf(inputValue) > -1) {
        return;
      }
      newValue.push(inputValue);
      setInputValue('');
      handleValueChange(newValue);
    }
  };

  const removeItem = (idx: number) => {
    const newValue = value.slice(0);
    newValue.splice(idx, 1);
    if (newValue.length) {
      handleValueChange(newValue);
    } else {
      handleValueChange([]);
    }
  };

  const editItem = (index: number) => {
    setCurrentEditIndex(index);
  };

  const handleInputValueChange = (value: string) => {
    setInputValue(value);
  };

  const items = value.map((item, idx) => {
    if (currentEditIndex >= 0 && currentEditIndex === idx) {
      return <li className={styles.array_items} key={`${idx} - ${JSON.stringify(item)}`}></li>;
    } else {
      return (
        <li className={styles.array_items} key={`${idx} - ${JSON.stringify(item)}`}>
          <div className={styles.array_item}>{typeof item === 'string' ? item : JSON.stringify(item)}</div>
          <div className={styles.operate}>
            <Button
              type='icon'
              title={localize('preference.stringArray.operate.edit')}
              onClick={() => {
                editItem(idx);
              }}
              className={classnames(getIcon('edit'), styles.array_item)}
            ></Button>
            <Button
              type='icon'
              title={localize('preference.stringArray.operate.delete')}
              onClick={() => {
                removeItem(idx);
              }}
              className={classnames(getIcon('delete'), styles.array_item)}
            ></Button>
          </div>
        </li>
      );
    }
  });

  const renderEditInput = () => {
    const commit = () => {
      const newValue = value.slice(0);
      if (editValue) {
        newValue[currentEditIndex] = editValue!;
      } else {
        newValue.splice(currentEditIndex, 1);
      }
      setValue(newValue);
      preferenceService.set(preferenceName, newValue, scope);
      setCurrentEditIndex(-1);
    };

    const handleEditValueChange = (value: string) => {
      setEditValue(value);
    };

    if (currentEditIndex >= 0) {
      return (
        <div
          className={styles.array_edit_wrapper}
          style={{
            top: currentEditIndex * 24,
          }}
        >
          <Input
            type='text'
            className={styles.array_edit_input}
            value={editValue}
            onValueChange={handleEditValueChange}
            onPressEnter={commit}
            addonAfter={[
              <div className={styles.array_edit_input_tip}>{localize('preference.stringArray.operate.editTip')}</div>,
            ]}
          />
        </div>
      );
    }
  };

  return (
    <div className={styles.preference_line}>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          hasValueInScope={hasValueInScope}
        />
      </div>
      {schema && schema.description && (
        <div className={styles.desc}>{renderDescriptionExpression(schema.description)}</div>
      )}
      <div className={styles.control_wrap}>
        <ul className={styles.array_items_wrapper}>
          {items}
          {renderEditInput()}
        </ul>
        <div className={styles.preferences_flex_row}>
          <Input
            type='text'
            className={styles.text_control}
            value={inputValue}
            onValueChange={handleInputValueChange}
          />
          <Button className={styles.add_button} onClick={addItem}>
            {localize('preference.array.additem', '添加')}
          </Button>
        </div>
      </div>
    </div>
  );
}
