import React from 'react';

import { Icon } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { RulesServiceToken, localize } from '@opensumi/ide-core-common';

import styles from './rules.module.less';
import { RulesService } from './rules.service';

export const RulesView: React.FC = () => {
  const rulesService = useInjectable<RulesService>(RulesServiceToken);
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{localize('ai.native.rules.title')}</h2>
          <p className={styles.description}>{localize('ai.native.rules.description')}</p>
        </div>
        <button className={styles.actionButton}>
          <Icon icon='plus' className={styles.actionButtonIcon} />
          {localize('ai.native.rules.addRule.title')}
        </button>
      </div>
    </div>
  );
};
