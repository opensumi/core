import Form from '@rjsf/core';
import { RJSFSchema, StrictRJSFSchema, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import cls from 'classnames';
import lodashGet from 'lodash/get';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';

import { Button, ComponentContextProvider, RecycleList } from '@opensumi/ide-components';
import {
  localize,
  getIcon,
  useInjectable,
  IJSONSchemaRegistry,
  ISchemaContributions,
  IJSONSchema,
  IJSONSchemaSnippet,
} from '@opensumi/ide-core-browser';
import { EDirection, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { MenuActionList } from '@opensumi/ide-core-browser/lib/components/actions/index';
import { LabelMenuItemNode } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
import { acquireAjv } from '@opensumi/ide-core-browser/lib/utils/schema';

import { launchExtensionSchemaUri } from '../../common/debug-schema';

import styles from './launch.module.less';

export const LaunchViewContainer = () => {
  const schemaRegistry = useInjectable<IJSONSchemaRegistry>(IJSONSchemaRegistry);
  const [schemaContributions, setSchemaContributions] = useState<IJSONSchema>();
  const [currentSnippetItem, setCurrentSnippetItem] = useState<IJSONSchemaSnippet>();

  useEffect(() => {
    const disposed = schemaRegistry.onDidChangeSchema((uri: string) => {
      if (uri === launchExtensionSchemaUri) {
        handleSchemaSnippets(schemaRegistry.getSchemaContributions());
      }
    });

    handleSchemaSnippets(schemaRegistry.getSchemaContributions());

    return () => disposed.dispose();
  }, []);

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
    return snippets.filter((s) => s.label);
  }, [schemaContributions]);

  const onSelectedConfiguration = (current: string) => {
    const findItems = snippetItems.find(({ label }) => label === current);
    if (!findItems) {
      return;
    }

    setCurrentSnippetItem(findItems);
  };

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
            snippetItems={snippetItems}
            onSelectedConfiguration={onSelectedConfiguration}
          />
          <LaunchBody data-sp-flex={1} snippetItem={currentSnippetItem} schemaContributions={schemaContributions} />
        </SplitPanel>
      </div>
    </ComponentContextProvider>
  );
};

const LaunchIndexs = ({
  snippetItems,
  onSelectedConfiguration,
}: {
  snippetItems: IJSONSchemaSnippet[];
  onSelectedConfiguration: (data: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const [configurationItems, setConfigurationItems] = useState<string[]>([]);
  const [currentCheckItem, setCurrentCheckItem] = useState<string>();

  useEffect(() => {
    if (currentCheckItem) {
      onSelectedConfiguration(currentCheckItem);
    }
  }, [currentCheckItem]);

  const template = ({ data }) => (
    <div className={cls(styles.configuration_item)} onClick={() => setCurrentCheckItem(data)}>
      <div className={styles.configuration_wrapper}>
        <span className={styles.configuration_description}>{data}</span>
      </div>
    </div>
  );

  const handleMenuItemClick = useCallback(
    (item: LabelMenuItemNode) => {
      setMenuOpen(false);
      setConfigurationItems([...configurationItems, item.label]);
    },
    [configurationItems],
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

const LaunchBody = ({
  snippetItem,
  schemaContributions,
}: {
  snippetItem?: IJSONSchemaSnippet;
  schemaContributions?: IJSONSchema;
}) => {
  if (!snippetItem) {
    return <div>{localize('debug.action.no.configuration')}</div>;
  }

  const [schemaProperties, setSchemaProperties] = useState<IJSONSchema>();

  useEffect(() => {
    const ajv = acquireAjv();
    // 1. 先从 schema 中找出 oneOf 池
    const oneOfPool: IJSONSchema[] =
      lodashGet(schemaContributions, ['properties', 'configurations', 'items', 'oneOf'] as (keyof IJSONSchema)[]) || [];

    // 2. 再从 snippetItem body 中找出符合条件的 oneOf（可能存在多个，如果有多个就只取第一个）
    const findOneOf = oneOfPool.filter((oneOf) => {
      const { body } = snippetItem;
      return ajv!.validate(oneOf, body);
    });

    if (findOneOf.length > 0) {
      setSchemaProperties(findOneOf[0]);
    }
  }, [snippetItem, schemaContributions]);

  const schema: RJSFSchema | undefined = useMemo(() => {
    if (!(schemaProperties && schemaProperties.properties)) {
      return;
    }

    const { label, body } = snippetItem;
    const { properties } = schemaProperties;

    let snippetProperties = {};
    Object.keys(body).forEach((key) => {
      if (properties![key].type === 'array') {
        if (!Object.getOwnPropertyDescriptor(properties![key], 'items')) {
          properties![key]['items'] = { type: 'string' };
        }
      }
      snippetProperties[key] = properties![key];
    });

    return {
      title: label,
      type: 'object',
      properties: snippetProperties,
    } as StrictRJSFSchema;
  }, [snippetItem, schemaProperties]);

  return (
    <div className={styles.launch_schema_body_container}>
      {schema && <Form formData={snippetItem.body} schema={schema} validator={validator} />}
    </div>
  );
};
