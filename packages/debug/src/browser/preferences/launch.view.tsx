import { IChangeEvent, withTheme } from '@rjsf/core';
import { GenericObjectType, RJSFSchema, StrictRJSFSchema, SubmitButtonProps } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv6';
import cls from 'classnames';
import lodashGet from 'lodash/get';
import throttle from 'lodash/throttle';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button, ComponentContextProvider, RecycleList } from '@opensumi/ide-components';
import {
  CommandService,
  Disposable,
  EDITOR_COMMANDS,
  IJSONSchema,
  IJSONSchemaMap,
  IJSONSchemaRegistry,
  IJSONSchemaSnippet,
  ISchemaContributions,
  Schemes,
  getIcon,
  isObject,
  isUndefined,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { EDirection, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { MenuActionList } from '@opensumi/ide-core-browser/lib/components/actions/index';
import { LabelMenuItemNode } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
import { acquireAjv } from '@opensumi/ide-core-browser/lib/utils/schema';
import { ReactEditorComponent } from '@opensumi/ide-editor/lib/browser/index';

import { DebugConfiguration, MASSIVE_PROPERTY_FLAG } from '../../common/debug-configuration';
import { JSON_SCHEMA_TYPE, launchExtensionSchemaUri } from '../../common/debug-schema';
import { ILaunchService } from '../../common/debug-service';
import { DebugConfigurationManager } from '../debug-configuration-manager';
import { parseSnippet } from '../debugUtils';

import { CheckboxWidget } from './components/checkbox-widget';
import { AnyOfField } from './components/fields/any-of-field';
import { ArrayField } from './components/fields/array-field';
import { ObjectField } from './components/fields/object-filed';
import { TitleField } from './components/fields/title-field';
import { SelectWidget } from './components/select-widget';
import { TextWidget } from './components/text-widget';
import styles from './launch.module.less';
import { LaunchService } from './launch.service';
import { ConfigurationItemsModel } from './model/configuration-items';
import { WrapIfAdditionalTemplate } from './templates/additional-template';
import { ArrayFieldItemTemplate } from './templates/array-field-item-template';
import { ArrayFieldTemplate } from './templates/array-field-template';
import { BaseInputTemplate } from './templates/base-input-template';
import {
  AddButton,
  AddItemButton,
  CopyButton,
  MoveDownButton,
  MoveUpButton,
  RemoveButton,
} from './templates/button-template';
import { DescriptionFieldTemplate } from './templates/description-field-template';
import { FieldTemplate } from './templates/field-template';
import { ObjectFieldTemplate } from './templates/object-field-template';

export const LaunchViewContainer: ReactEditorComponent<any> = ({ resource }) => {
  const { uri } = resource;
  const schemaRegistry = useInjectable<IJSONSchemaRegistry>(IJSONSchemaRegistry);
  const debugConfigurationManager = useInjectable<DebugConfigurationManager>(DebugConfigurationManager);
  const launchService = useInjectable<LaunchService>(ILaunchService);
  const commandService = useInjectable<CommandService>(CommandService);

  const [currentConfigurationIndex, serCurrentConfigurationIndex] = useState<number>(0);
  const [schemaContributions, setSchemaContributions] = useState<IJSONSchema>();
  const [inputConfigurationItems, setInputConfigurationItems] = useState<ConfigurationItemsModel[]>([]);

  useEffect(() => {
    const disposed = new Disposable();

    disposed.addDispose(
      schemaRegistry.onDidChangeSchema((uri: string) => {
        if (uri === launchExtensionSchemaUri) {
          handleSchemaSnippets(schemaRegistry.getSchemaContributions());
        }
      }),
    );

    disposed.addDispose(
      debugConfigurationManager.onDidChange(async () => {
        handleInputConfigurationItems();
      }),
    );

    handleSchemaSnippets(schemaRegistry.getSchemaContributions());
    handleInputConfigurationItems();

    return () => disposed.dispose();
  }, []);

  const fileUri = useMemo(() => uri.withScheme(Schemes.file), [uri]);

  const handleSchemaSnippets = useCallback(
    (contributions: ISchemaContributions) => {
      const launchExtension = contributions.schemas[launchExtensionSchemaUri];

      if (!launchExtension) {
        return;
      }

      setSchemaContributions(launchExtension);
    },
    [schemaContributions],
  );

  const handleInputConfigurationItems = useCallback(() => {
    const all = debugConfigurationManager.all;
    if (!Array.isArray(all)) {
      return;
    }

    setInputConfigurationItems(
      all.map((config) => new ConfigurationItemsModel(config.configuration.name, config.configuration)),
    );
  }, []);

  const snippetItems = useMemo(() => {
    if (!schemaContributions) {
      return [];
    }

    const snippets: IJSONSchemaSnippet[] = lodashGet(schemaContributions, [
      'properties',
      'configurations',
      'items',
      'defaultSnippets',
    ] as (keyof IJSONSchema)[]);
    return snippets || [];
  }, [schemaContributions]);

  const onSelectedConfiguration = useCallback((current: ConfigurationItemsModel, index: number) => {
    const { configuration } = current;
    if (!configuration) {
      return;
    }

    serCurrentConfigurationIndex(index);
  }, []);

  const currentSnippetItem = useMemo(() => {
    if (inputConfigurationItems && !isUndefined(currentConfigurationIndex)) {
      const current = inputConfigurationItems[currentConfigurationIndex];
      if (!current) {
        return undefined;
      }

      const { configuration, description, label } = current;
      if (!configuration) {
        return;
      }

      return {
        body: configuration,
        description,
        label,
      };
    }
    return undefined;
  }, [inputConfigurationItems, currentConfigurationIndex]);

  const onAddConfigurationItems = useCallback(
    async (newItems: ConfigurationItemsModel) => {
      const { configuration } = newItems;
      await debugConfigurationManager.insertConfiguration(fileUri, configuration);
      commandService.executeCommand(EDITOR_COMMANDS.SAVE_URI.id, fileUri);
    },
    [snippetItems],
  );

  const scheduleUpdateConfigurationsInResource = throttle(
    async (data, currentConfigurationIndex) =>
      await launchService.modifyConfigurationsInResource(fileUri, data, currentConfigurationIndex),
    100,
  );

  const onFormChange = useCallback(
    async (data: IChangeEvent) => {
      const { formData } = data;
      if (!formData || isUndefined(currentConfigurationIndex)) {
        return;
      }

      scheduleUpdateConfigurationsInResource(data, currentConfigurationIndex);
    },
    [currentConfigurationIndex, currentSnippetItem],
  );

  return (
    <ComponentContextProvider value={{ getIcon, localize }}>
      <div className={styles.launch_container}>
        <SplitPanel
          id='launch-container'
          resizeHandleClassName={styles.devider}
          className={styles.launch_panel}
          direction={EDirection.LeftToRight}
        >
          <LaunchIndexs
            data-sp-defaultSize={240}
            data-sp-minSize={150}
            inputConfigurationItems={inputConfigurationItems}
            snippetItems={snippetItems}
            onSelectedConfiguration={onSelectedConfiguration}
            onAddConfigurationItems={onAddConfigurationItems}
            currentConfigurationIndex={currentConfigurationIndex}
          />
          <LaunchBody
            data-sp-flex={1}
            snippetItem={currentSnippetItem}
            schemaContributions={schemaContributions}
            onChange={onFormChange}
          />
        </SplitPanel>
      </div>
    </ComponentContextProvider>
  );
};

const LaunchIndexs = ({
  snippetItems,
  onSelectedConfiguration,
  onAddConfigurationItems,
  inputConfigurationItems,
  currentConfigurationIndex,
}: {
  snippetItems: IJSONSchemaSnippet[];
  onSelectedConfiguration: (data: ConfigurationItemsModel, index: number) => void;
  onAddConfigurationItems: (data: ConfigurationItemsModel) => void;
  inputConfigurationItems: ConfigurationItemsModel[];
  currentConfigurationIndex: number | undefined;
}) => {
  const launchService = useInjectable<LaunchService>(ILaunchService);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const [configurationItems, setConfigurationItems] = useState<ConfigurationItemsModel[]>(inputConfigurationItems);

  useEffect(() => {
    if (configurationItems.length === 0 && isUndefined(currentConfigurationIndex)) {
      return;
    }

    const findItem = configurationItems[currentConfigurationIndex!];

    if (findItem && findItem.configuration) {
      launchService.nextNewFormData(findItem.configuration, false);
    }
  }, [currentConfigurationIndex, configurationItems]);

  useEffect(() => {
    setConfigurationItems([...inputConfigurationItems]);
  }, [inputConfigurationItems]);

  const handleConfigurationItemsClick = useCallback((data: ConfigurationItemsModel, index: number) => {
    onSelectedConfiguration(data, index);
  }, []);

  const template = ({ data, index }) => (
    <div
      key={index}
      className={cls(styles.configuration_item, currentConfigurationIndex === index ? styles.selected : '')}
      onClick={() => handleConfigurationItemsClick(data, index)}
    >
      <div className={styles.configuration_wrapper}>
        <span className={styles.configuration_description}>{(data as ConfigurationItemsModel).label}</span>
      </div>
    </div>
  );

  const handleMenuItemClick = useCallback(
    (item: LabelMenuItemNode) => {
      setMenuOpen(false);

      const { label } = item;
      const findItem = snippetItems.find((snippet) => snippet.label === label);
      if (!findItem) {
        return;
      }

      const { body } = findItem;
      if (!isObject(body)) {
        return;
      }

      // 将 body 里一些形如 ${1:xxxx} 这样的符号给过滤掉
      const parseBody: DebugConfiguration = Object.keys(body).reduce((pre: DebugConfiguration, cur: string) => {
        const curValue = body[cur];

        if (typeof curValue === 'string') {
          pre[cur] = parseSnippet(curValue);
        } else if (Array.isArray(curValue)) {
          pre[cur] = curValue.map((value: any) => {
            if (typeof value == 'string') {
              return parseSnippet(value);
            }
            return value;
          });
        }

        return pre;
      }, body);

      const itemModel = new ConfigurationItemsModel(findItem.label!, parseBody);
      itemModel.setDescription(findItem.description || '');

      onAddConfigurationItems(itemModel);
    },
    [configurationItems, snippetItems],
  );

  const handleVisibleChange = (visible: boolean) => {
    setMenuOpen(visible);
  };

  const snippetMenu = useMemo(
    () => (
      <MenuActionList
        data={snippetItems.map((item) => new LabelMenuItemNode(item.label!))}
        afterClick={(item: LabelMenuItemNode) => handleMenuItemClick(item)}
      />
    ),
    [snippetItems, configurationItems],
  );

  return (
    <div className={styles.launch_indexes_container}>
      <AutoSizer className={styles.configuration_items_box}>
        {({ width, height }) =>
          configurationItems.length === 0 ? (
            <div style={{ width }} className={styles.not_configuration_content}>
              {localize('debug.action.no.configuration')}
            </div>
          ) : (
            <RecycleList width={width} height={height} data={configurationItems} template={template} />
          )
        }
      </AutoSizer>
      <div className={styles.foot_box}>
        <Button
          className={styles.button}
          placement={'topCenter'}
          menu={snippetMenu}
          moreVisible={menuOpen}
          onVisibleChange={handleVisibleChange}
        >
          {localize('debug.action.add.configuration')}
        </Button>
      </div>
    </div>
  );
};

const Form = withTheme({
  widgets: {
    TextWidget,
    SelectWidget,
    CheckboxWidget,
  },
  fields: {
    ObjectField,
  },
});

const LaunchBody = ({
  snippetItem,
  schemaContributions,
  onChange,
}: {
  snippetItem?: IJSONSchemaSnippet;
  schemaContributions?: IJSONSchema;
  onChange: (data: IChangeEvent, id?: string) => void;
}) => {
  if (!snippetItem) {
    return <div className={styles.no_onfiguration}>{localize('debug.action.no.configuration')}</div>;
  }

  const launchService = useInjectable<LaunchService>(ILaunchService);

  const schemaProperties: IJSONSchema | undefined = useMemo(() => {
    const ajv = acquireAjv();
    // 1. 先从 schema 中找出 oneOf 池
    const oneOfPool: IJSONSchema[] =
      lodashGet(schemaContributions, ['properties', 'configurations', 'items', 'oneOf'] as (keyof IJSONSchema)[]) || [];

    // 2. 再从 snippetItem body 中找出符合条件的 oneOf（可能存在多个，如果有多个就只取第一个）
    const findOneOf = oneOfPool.find((oneOf) => {
      const { body } = snippetItem;
      return ajv!.validate(oneOf, body);
    });

    if (findOneOf) {
      launchService.setRawSchemaProperties(findOneOf);
      return findOneOf;
    }

    return;
  }, [snippetItem, schemaContributions]);

  const schema: RJSFSchema | undefined = useMemo(() => {
    if (!(schemaProperties && schemaProperties.properties)) {
      return;
    }

    const { label, body, description } = snippetItem;
    const { properties, required } = schemaProperties;

    const snippetProperties = Object.keys(body).reduce((pre: IJSONSchemaMap, cur: string) => {
      const curProp = properties![cur];

      if (curProp?.type === JSON_SCHEMA_TYPE.ARRAY && isUndefined(curProp?.items)) {
        curProp.items = { type: JSON_SCHEMA_TYPE.STRING };
      }

      // 如果 type 是数组，则取第一个
      if (Array.isArray(curProp?.type)) {
        curProp.type = curProp.type![0] || JSON_SCHEMA_TYPE.STRING;
      }

      // 去掉 anyof 中的空对象
      if (Array.isArray(curProp?.anyOf)) {
        curProp.anyOf = curProp.anyOf.filter((c) => Object.keys(c).length > 0);
      }

      // 如果 type 是 object 且存在 additionalProperties 时，固定将其设置为 additionalProperties: { type: 'string' }
      if (curProp?.type === JSON_SCHEMA_TYPE.OBJECT && !isUndefined(curProp?.additionalProperties)) {
        curProp.additionalProperties = { type: JSON_SCHEMA_TYPE.STRING };
      }

      /**
       * 为了避免因 properties 太多导致页面非常非常的长，影响用户体验，这里对 properties 属性超过一定个数（暂定 6 个）的配置项进行引导操作，让其在 launch.json 中进行配置
       * 通过添加 MASSIVE_PROPERTY_FLAG 来做标识
       */
      if (
        curProp?.type === JSON_SCHEMA_TYPE.OBJECT &&
        !isUndefined(curProp?.properties) &&
        Object.keys(curProp.properties!).length > 6
      ) {
        curProp.properties = {};
        curProp[MASSIVE_PROPERTY_FLAG] = true;
      }

      // 将 markdownDescription 赋给 description
      if (!curProp?.description && curProp?.markdownDescription) {
        curProp.description = curProp.markdownDescription;
      }

      pre[cur] = curProp;
      return pre;
    }, {});

    const schema = {
      title: label,
      type: JSON_SCHEMA_TYPE.OBJECT,
      required,
      description,
      properties: snippetProperties,
    } as StrictRJSFSchema;

    launchService.nextNewSchema(schema);

    return schema;
  }, [snippetItem, schemaProperties]);

  const hanldeAddItem = useCallback(
    (item: LabelMenuItemNode) => {
      if (!(schemaProperties && schemaProperties.properties)) {
        return;
      }

      if (!(schema && schema.properties)) {
        return;
      }

      const { label } = item;
      launchService.addNewItem(label);
    },
    [snippetItem, schemaProperties, schema],
  );

  return (
    <div className={styles.launch_schema_body_container}>
      {schema && schemaProperties && (
        <Form
          formData={snippetItem.body}
          schema={schema}
          validator={validator}
          fields={{ AnyOfField, OneOfField: AnyOfField, ArrayField }}
          onChange={onChange}
          templates={{
            ArrayFieldTemplate,
            ArrayFieldItemTemplate,
            DescriptionFieldTemplate,
            FieldTemplate,
            ObjectFieldTemplate,
            WrapIfAdditionalTemplate,
            BaseInputTemplate,
            TitleFieldTemplate: TitleField,
            ButtonTemplates: {
              MoveUpButton,
              MoveDownButton,
              RemoveButton,
              SubmitButton: (
                props: React.PropsWithChildren<SubmitButtonProps<unknown, RJSFSchema, GenericObjectType>>,
              ) => <AddItemButton {...props} onAddClick={hanldeAddItem}></AddItemButton>,
              AddButton,
              CopyButton,
            },
          }}
        />
      )}
    </div>
  );
};
