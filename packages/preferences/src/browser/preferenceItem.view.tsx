import classnames from 'classnames';
import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { Button, CheckBox, Input, Option, Select, ValidateInput, ValidateMessage } from '@opensumi/ide-components';
import { DefaultMarkedRenderer, linkify, Markdown } from '@opensumi/ide-components/lib/markdown/index';
import {
  DisposableCollection,
  getIcon,
  IPreferenceSettingsService,
  localize,
  PreferenceItem,
  PreferenceProvider,
  PreferenceSchemaProvider,
  PreferenceScope,
  PreferenceService,
  replaceLocalizePlaceholder,
  useInjectable,
  formatLocalize,
  ILogger,
  IOpenerService,
  IResolvedPreferenceViewDesc,
} from '@opensumi/ide-core-browser';

import { getPreferenceItemLabel, knownPrefIdMappings } from '../common';

import { PreferenceSettingsService } from './preference-settings.service';
import styles from './preferences.module.less';

interface IPreferenceItemProps {
  preferenceName: string;
  localizedName?: string;
  localizedDescription?: {
    description: string | undefined;
    markdownDescription: string | undefined;
  };
  /**
   * 自动处理了 markdown 和纯文本模式的选项
   */
  renderedDescription?: JSX.Element;
  currentValue: any;
  defaultValue: any;
  schema: PreferenceItem;
  labels: Record<string, string>;
  scope: PreferenceScope;
  effectingScope: PreferenceScope;
  hasValueInScope: boolean;
  isModified: boolean;
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
 *    只允许 string类 - 可视化编辑项
 *  object:
 *    暂不支持
 */
export const NextPreferenceItem = ({
  preferenceId,
  localizedName,
  preference,
  scope,
}: {
  preferenceId: string;
  preference: IResolvedPreferenceViewDesc;
  localizedName?: string;
  scope: PreferenceScope;
}) => {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);

  const preferenceProvider: PreferenceProvider = preferenceService.getProvider(scope)!;

  // 获得这个设置项的当前值
  const { value: inherited, effectingScope } = settingsService.getPreference(preferenceId, scope);
  const [value, setValue] = useState<boolean | string | string[] | undefined>(
    preferenceProvider.get<boolean | string | string[]>(preferenceId),
  );
  const [schema, setSchema] = useState<PreferenceItem>();
  const [labels, setLabels] = useState(() => settingsService.getEnumLabels(preferenceId));

  // 当这个设置项被外部变更时，更新局部值
  useEffect(() => {
    // 获得当前的schema
    const schemas = schemaProvider.getPreferenceProperty(preferenceId);
    setSchema(schemas);

    const disposableCollection = new DisposableCollection();
    // 监听配置变化
    disposableCollection.push(
      preferenceProvider.onDidPreferencesChanged((e) => {
        if (e.default && Object.prototype.hasOwnProperty.call(e.default, preferenceId)) {
          if (e.default[preferenceId].scope === scope) {
            const newValue = e.default[preferenceId].newValue;
            setValue(newValue);
          }
        }
      }),
    );

    disposableCollection.push(
      settingsService.onDidEnumLabelsChange(preferenceId)(
        debounce(() => {
          setSchema(schemaProvider.getPreferenceProperty(preferenceId));
          setLabels(settingsService.getEnumLabels(preferenceId));
        }, PreferenceSettingsService.DEFAULT_CHANGE_DELAY),
      ),
    );

    return () => {
      disposableCollection.dispose();
    };
  }, []);

  let renderSchema = schema;
  if (!renderSchema) {
    // 渲染阶段可能存在还没获取到 schema 的情况
    renderSchema = schemaProvider.getPreferenceProperty(preferenceId);
  }

  if (!renderSchema) {
    return (
      <div
        className={classnames({
          [styles.preference_item]: true,
        })}
      >
        {preferenceId} schema not found.
      </div>
    );
  }

  const defaultValue =
    preferenceService.resolve(preferenceId, undefined, undefined, undefined, PreferenceScope.Default).value ??
    renderSchema.default;

  // 目前还没法对 input 的数字值进行 === 校验，先全部转为 String
  const isModified = value !== undefined && String(value) !== String(defaultValue);

  const renderPreferenceItem = () => {
    if (renderSchema) {
      const props = {
        preferenceName: preferenceId,
        scope,
        effectingScope,
        schema: renderSchema,
        labels,
        currentValue: value === undefined ? inherited : value,
        defaultValue,
        localizedName,
        localizedDescription: {
          description: preference.description,
          markdownDescription: preference.markdownDescription,
        },
        renderedDescription: renderDescription({
          name: localizedName,
          description: preference.description,
          markdownDescription: preference.markdownDescription,
        }),
        hasValueInScope: value !== undefined,
        isModified,
      } as IPreferenceItemProps;

      switch (renderSchema.type) {
        case 'boolean':
          return <CheckboxPreferenceItem {...props} />;
        case 'integer':
        case 'number':
          if (renderSchema.enum) {
            return <SelectPreferenceItem {...props} />;
          } else {
            return <InputPreferenceItem {...props} isNumber={true} />;
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
        [styles.modified]: isModified,
      })}
      data-id={preferenceId}
    >
      {renderPreferenceItem()}
    </div>
  );
};

const renderDescriptionExpression = (description: string) => {
  const preferenceSettingService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  if (!description) {
    return null;
  }
  const match = description.match(DESCRIPTION_EXPRESSION_REGEXP);
  if (!match) {
    return description;
  }
  let tmp = description;
  const result = [] as JSX.Element[];
  for (const expression of match) {
    if (!tmp) {
      continue;
    }
    const _preferenceId = expression.slice(2, expression.length - 2);
    const preferenceId = knownPrefIdMappings[_preferenceId] ?? _preferenceId;

    const preference = preferenceSettingService.getPreferenceViewDesc(preferenceId);
    if (preference) {
      const preferenceTitle = getPreferenceItemLabel(preference);
      const [prev, next] = tmp.split(expression, 2);
      prev && result.push(<span key={result.length}>{prev}</span>);
      tmp = next;
      const link = (
        <a
          onClick={() => {
            preferenceSettingService.search(preferenceTitle);
          }}
          key={preferenceId}
        >
          {preferenceTitle}
        </a>
      );
      result.push(link);
    }
  }
  tmp && result.push(<span key={result.length}>{tmp}</span>);
  return result;
};

@Injectable()
class PreferenceMarkedRender extends DefaultMarkedRenderer {
  static openerScheme = 'prefTitle://';
  @Autowired(IPreferenceSettingsService)
  preferenceSettingService: PreferenceSettingsService;

  codespan(text: string): string {
    if (text.startsWith('#') && text.endsWith('#')) {
      const _prefId = text.slice(1, text.length - 1);
      const prefId = knownPrefIdMappings[_prefId] ?? _prefId;
      const preference = this.preferenceSettingService.getPreferenceViewDesc(prefId);
      if (preference) {
        const preferenceTitle = getPreferenceItemLabel(preference);
        return linkify(`${PreferenceMarkedRender.openerScheme}${preferenceTitle}`, prefId, preferenceTitle);
      }
      return super.codespan(prefId);
    }
    return super.codespan(text);
  }
}

const renderMarkdownDescription = (message: string) => {
  const openerService: IOpenerService = useInjectable(IOpenerService);
  const renderer = useInjectable(PreferenceMarkedRender) as PreferenceMarkedRender;
  const preferenceSettingService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  return (
    <Markdown
      opener={{
        open(uri: string) {
          if (uri.startsWith(PreferenceMarkedRender.openerScheme)) {
            const prefTitle = uri.slice(PreferenceMarkedRender.openerScheme.length);
            preferenceSettingService.search(prefTitle);
            return true;
          }
          return openerService.open(uri);
        },
      }}
      value={message}
      renderer={renderer}
    />
  );
};

const renderDescription = (data: { name?: string; description?: string; markdownDescription?: string }) => {
  const description = replaceLocalizePlaceholder(data.description ?? data.markdownDescription);
  if (!description) {
    return <div className={styles.desc}>{data.name}</div>;
  }

  return (
    <div className={styles.desc}>
      {data.markdownDescription ? renderMarkdownDescription(description) : renderDescriptionExpression(description)}
    </div>
  );
};

const SettingStatus = ({
  preferenceName,
  scope,
  effectingScope,
  showReset,
}: {
  preferenceName: string;
  scope: PreferenceScope;
  effectingScope: PreferenceScope;
  showReset: boolean;
}) => {
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);
  return (
    <span className={styles.preference_status}>
      {effectingScope === PreferenceScope.Workspace && scope === PreferenceScope.User ? (
        <span
          onClick={() => {
            settingsService.selectScope(PreferenceScope.Workspace);
            settingsService.scrollToPreference(preferenceName);
          }}
          className={styles.preference_overwritten}
        >
          {localize('preference.overwrittenInWorkspace')}
        </span>
      ) : undefined}
      {effectingScope === PreferenceScope.User && scope === PreferenceScope.Workspace ? (
        <span
          onClick={() => {
            settingsService.selectScope(PreferenceScope.User);
            settingsService.scrollToPreference(preferenceName);
          }}
          className={styles.preference_overwritten}
        >
          {localize('preference.overwrittenInUser')}
        </span>
      ) : undefined}
      {showReset ? (
        <span
          className={classnames(styles.preference_reset, getIcon('rollback'))}
          onClick={() => {
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
  renderedDescription,
  isNumber,
  effectingScope,
  scope,
  isModified,
}: IPreferenceItemProps & { isNumber?: boolean }) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const schemaProvider: PreferenceSchemaProvider = useInjectable(PreferenceSchemaProvider);
  const [value, setValue] = useState<string>();

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = (value) => {
    if (hasValidateError(isNumber && /^[0-9]+$/.test(value) ? Number(value) : value)) {
      return;
    }

    preferenceService.set(preferenceName, value, scope);
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
    <>
      <div className={classnames(styles.key, styles.item)}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          showReset={isModified}
        />
      </div>
      {renderedDescription}
      <div className={styles.control_wrap}>
        <div className={styles.text_control}>
          <ValidateInput
            type={isNumber ? 'number' : 'text'}
            validate={hasValidateError}
            onBlur={() => {
              handleValueChange(value);
            }}
            onValueChange={(value) => {
              setValue(value);
            }}
            value={value}
          />
        </div>
      </div>
    </>
  );
}

function CheckboxPreferenceItem({
  preferenceName,
  localizedName,
  renderedDescription,
  currentValue,
  effectingScope,
  scope,
  isModified,
}: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);

  const [value, setValue] = useState<boolean>();

  useEffect(() => {
    setValue(currentValue);
  }, [currentValue]);

  const handleValueChange = (value) => {
    setValue(value);
    preferenceService.set(preferenceName, value, scope);
  };

  return (
    <>
      <div className={classnames(styles.key)}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          showReset={isModified}
        />
      </div>
      <div className={styles.check}>
        <CheckBox
          checked={value}
          onChange={(event) => {
            handleValueChange((event.target as HTMLInputElement).checked);
          }}
        />
        {renderedDescription}
      </div>
    </>
  );
}

function SelectPreferenceItem({
  preferenceName: preferenceId,
  localizedName,
  renderedDescription,
  currentValue,
  defaultValue,
  schema,
  labels,
  effectingScope,
  scope,
  isModified,
}: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const logger: ILogger = useInjectable(ILogger);
  const value = currentValue ?? defaultValue;

  // 鼠标还没有划过来的时候，需要一个默认的描述信息
  const defaultDescription = useMemo((): string => {
    if (schema.enumDescriptions && schema.enum) {
      return schema.enumDescriptions[schema.enum.indexOf(currentValue)] || '';
    }
    return '';
  }, [schema]);
  const [description, setDescription] = useState<string>(defaultDescription);

  const handleValueChange = useCallback(
    (val) => {
      preferenceService.set(preferenceId, val, scope);
    },
    [preferenceService],
  );

  const renderEnumOptions = useCallback(() => {
    const enums = schema.enum ? [...schema.enum] : [];
    if (defaultValue && !enums.includes(defaultValue)) {
      logger.warn(`default value(${defaultValue}) of ${preferenceId} not found in its enum field`);
      enums.push(defaultValue);
    }
    return enums.map((item, idx) => {
      if (typeof item === 'boolean') {
        item = String(item);
      }
      const localized = replaceLocalizePlaceholder(String(labels[item] || item));
      return (
        <Option value={item} label={localized} key={`${idx}-${localized}`} className={styles.select_option}>
          {localized}
          {String(item) === String(defaultValue) && (
            <div className={styles.select_default_option_tips}>{localize('preference.enum.default')}</div>
          )}
        </Option>
      );
    });
  }, [schema.enum, labels]);

  const renderNoneOptions = () => (
    <Option
      value={localize('preference.stringArray.none')}
      key={NONE_SELECT_OPTION}
      label={localize('preference.stringArray.none')}
      disabled
    >
      {localize('preference.stringArray.none')}
    </Option>
  );

  const options = schema.enum && schema.enum.length > 0 ? renderEnumOptions() : renderNoneOptions();

  // 处理鼠标移动时候对应枚举值描述的变化
  const handleDescriptionChange = useCallback(
    (_, index) => {
      if (schema.enumDescriptions) {
        const description = schema.enumDescriptions[index];
        if (description) {
          setDescription(description);
        } else {
          // 对应的描述不存在，则设置为空，在渲染时会过滤掉 falsy 的值
          setDescription('');
        }
      }
    },
    [schema.enumDescriptions, setDescription],
  );

  return (
    <>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceId}
          scope={scope}
          effectingScope={effectingScope}
          showReset={isModified}
        />
      </div>
      {renderedDescription}
      <div className={styles.control_wrap}>
        <Select
          dropdownRenderType='absolute'
          maxHeight='200'
          onChange={handleValueChange}
          value={value}
          className={styles.select_control}
          description={description}
          onMouseEnter={handleDescriptionChange}
          notMatchWarning={isModified ? formatLocalize('preference.item.notValid', value) : ''}
        >
          {options}
        </Select>
      </div>
    </>
  );
}

function EditInSettingsJsonPreferenceItem({
  preferenceName,
  localizedName,
  renderedDescription,
  effectingScope,
  scope,
  hasValueInScope,
}: IPreferenceItemProps) {
  const settingsService: PreferenceSettingsService = useInjectable(IPreferenceSettingsService);

  const editSettingsJson = async () => {
    settingsService.openJSON(scope, preferenceName);
  };

  return (
    <>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          showReset={hasValueInScope}
        />
      </div>
      {renderedDescription}
      <div className={styles.control_wrap}>
        <a onClick={editSettingsJson}>{localize('preference.editSettingsJson')}</a>
      </div>
    </>
  );
}

function StringArrayPreferenceItem({
  preferenceName,
  localizedName,
  currentValue,
  renderedDescription,
  effectingScope,
  scope,
  isModified,
}: IPreferenceItemProps) {
  const preferenceService: PreferenceService = useInjectable(PreferenceService);
  const [value, setValue] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState<string>();
  const [editValue, setEditValue] = useState<string>();
  const [currentEditIndex, setCurrentEditIndex] = useState<number>(-1);

  useEffect(() => {
    setValue(currentValue || []);
  }, [currentValue]);

  useEffect(() => {
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
    const stringified = JSON.stringify(item);
    if (currentEditIndex >= 0 && currentEditIndex === idx) {
      return <li className={styles.array_items} key={`${idx}-${stringified}`}></li>;
    } else {
      return (
        <li className={styles.array_items} key={`${idx}-${stringified}`}>
          <div className={styles.array_item}>{typeof item === 'string' ? item : stringified}</div>
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
        newValue[currentEditIndex] = editValue;
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
    <>
      <div className={styles.key}>
        {localizedName}{' '}
        <SettingStatus
          preferenceName={preferenceName}
          scope={scope}
          effectingScope={effectingScope}
          showReset={isModified}
        />
      </div>
      {renderedDescription}
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
            {localize('preference.array.additem', 'Add')}
          </Button>
        </div>
      </div>
    </>
  );
}
