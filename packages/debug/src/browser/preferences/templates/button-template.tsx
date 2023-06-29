import { IconButtonProps, SubmitButtonProps } from '@rjsf/utils';
import React, { useCallback, useEffect } from 'react';

import { Button, getIcon } from '@opensumi/ide-components';
import { defaultIconfont } from '@opensumi/ide-components/lib/icon/iconfont/iconMap';
import { useInjectable } from '@opensumi/ide-core-browser';
import { MenuActionList } from '@opensumi/ide-core-browser/lib/components/actions/index';
import { MenuNode } from '@opensumi/ide-core-browser/lib/menu/next/base';
import { LabelMenuItemNode } from '@opensumi/ide-core-browser/lib/menu/next/menu.interface';
import { Disposable, localize } from '@opensumi/ide-core-common';

import { ILaunchService } from '../../../common';
import { LaunchService } from '../launch.service';

import styles from './json-templates.module.less';

export const MoveUpButton = (props: IconButtonProps) => (
  <Button {...props} type='primary' icon={defaultIconfont.arrowup}>
    <span className={getIcon(defaultIconfont.arrowup)}></span>
  </Button>
);

export const MoveDownButton = (props: IconButtonProps) => (
  <Button {...props} type='primary' icon={defaultIconfont.arrowdown}>
    <span className={getIcon(defaultIconfont.arrowdown)}></span>
  </Button>
);

export const RemoveButton = (props: IconButtonProps) => (
  <Button {...props} type='danger' icon={defaultIconfont.delete}>
    <span className={getIcon(defaultIconfont.delete)}></span>
  </Button>
);

export const AddButton = (props: IconButtonProps) => (
  <Button {...props} type='primary' icon={defaultIconfont.plus}>
    <span className={getIcon(defaultIconfont.plus)}></span> {localize('debug.launch.view.template.button.addItem')}
  </Button>
);

export const CopyButton = (props: IconButtonProps) => (
  <Button {...props} type='primary' icon={defaultIconfont['file-copy']}>
    <span className={getIcon(defaultIconfont['file-copy'])}></span>
  </Button>
);

export const AddItemButton = (props: SubmitButtonProps & { onAddClick: (item: LabelMenuItemNode) => void }) => {
  const {
    registry: { rootSchema },
    onAddClick,
  } = props;
  const launchService = useInjectable<LaunchService>(ILaunchService);
  const [menuOpen, setMenuOpen] = React.useState<boolean>(false);
  const [snippetMenu, setSnippetMenu] = React.useState<MenuNode[]>([]);
  const { rawSchemaProperties: schemaProperties } = launchService;

  const handleVisibleChange = useCallback((visible: boolean) => setMenuOpen(visible), []);

  const handleMenuItemClick = useCallback((item: LabelMenuItemNode) => {
    setMenuOpen(false);
    onAddClick(item);
  }, []);

  const handleSnippetMenu = useCallback(() => {
    const { properties } = schemaProperties;
    const { properties: existedProperties } = rootSchema;

    if (!properties || !existedProperties) {
      return;
    }
    // schema
    const menuItemNode = Object.keys(properties)
      // 过滤已存在于视图中的 properties
      .filter((key) => !Object.hasOwn(existedProperties, key))
      .map((item) => new LabelMenuItemNode(item));

    setSnippetMenu(menuItemNode);
  }, [rootSchema, schemaProperties]);

  useEffect(() => {
    const disposable = new Disposable();

    disposable.addDispose(
      launchService.onChangeSchema(() => {
        requestAnimationFrame(() => {
          handleSnippetMenu();
        });
      }),
    );
    handleSnippetMenu();

    return () => disposable.dispose();
  }, [schemaProperties, rootSchema]);

  return (
    <Button
      type='secondary'
      icon={defaultIconfont.plus}
      className={styles.add_new_field}
      menu={<MenuActionList afterClick={handleMenuItemClick} data={snippetMenu} style={{ maxHeight: 600 }} />}
      moreVisible={menuOpen}
      onVisibleChange={handleVisibleChange}
    >
      <span className={getIcon(defaultIconfont.plus)}></span> {localize('debug.launch.view.template.button.submit')}
    </Button>
  );
};
