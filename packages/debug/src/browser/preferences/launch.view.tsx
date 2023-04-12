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

import { launchExtensionSchemaUri } from '../../common/debug-schema';

import styles from './launch.module.less';

export const LaunchViewContainer = () => {
  const schemaRegistry = useInjectable<IJSONSchemaRegistry>(IJSONSchemaRegistry);
  const [snippetItems, setSnippetItems] = useState<IJSONSchemaSnippet[]>([]);

  useEffect(() => {
    const disposed = schemaRegistry.onDidChangeSchema((uri: string) => {
      if (uri === launchExtensionSchemaUri) {
        handleSchemaSnippets(schemaRegistry.getSchemaContributions());
      }
    });

    handleSchemaSnippets(schemaRegistry.getSchemaContributions());

    return () => disposed.dispose();
  }, []);

  const handleSchemaSnippets = (contributions: ISchemaContributions) => {
    const launchExtension = contributions.schemas[launchExtensionSchemaUri];

    if (!launchExtension) {
      return;
    }

    const snippets: IJSONSchemaSnippet[] = lodashGet(launchExtension, [
      'properties',
      'configurations',
      'items',
      'defaultSnippets',
    ] as (keyof IJSONSchema)[]);
    setSnippetItems(snippets.filter((s) => s.label));
  };

  const onSelectedConfiguration = (current: string) => {};

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
          <LaunchBody data-sp-flex={1} />
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

const LaunchBody = () => <div>body</div>;
