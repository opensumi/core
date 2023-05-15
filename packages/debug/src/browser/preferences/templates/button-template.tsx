import { IconButtonProps } from '@rjsf/utils';
import React from 'react';

import { Button, getIcon } from '@opensumi/ide-components';
import { defaultIconfont } from '@opensumi/ide-components/lib/icon/iconfont/iconMap';
import { localize } from '@opensumi/ide-core-common';

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

export const SubmitButton = (props: IconButtonProps) => (
  <Button {...props} type='secondary' icon={defaultIconfont.plus} className={styles.add_new_field}>
    <span className={getIcon(defaultIconfont.plus)}></span> {localize('debug.launch.view.template.button.submit')}
  </Button>
);
