import React, { useCallback, useEffect, useState } from 'react';

import { Icon } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { RulesServiceToken, localize } from '@opensumi/ide-core-common';

import { ProjectRule } from '../../common/types';

import styles from './rules.module.less';
import { RulesService } from './rules.service';

export const RulesView: React.FC = () => {
  const rulesService = useInjectable<RulesService>(RulesServiceToken);
  const [globalRules, setGlobalRules] = useState<string>(rulesService.globalRules as string);
  const [projectRules, setProjectRules] = useState<ProjectRule[]>([]);

  useEffect(() => {
    setProjectRules(rulesService.projectRules);
  }, [rulesService]);

  const handleGlobalRulesChange = useCallback(
    (e) => {
      setGlobalRules(e.target.value);
      rulesService.updateGlobalRules(e.target.value);
    },
    [rulesService, globalRules],
  );

  const handleCreateNewRule = useCallback(() => {
    rulesService.createNewRule();
  }, [rulesService]);

  const handleOpenRule = useCallback(
    (rule: ProjectRule) => {
      rulesService.openRule(rule);
    },
    [rulesService],
  );

  const getFileNameFromPath = (path: string) => path.split('/').pop() || path;

  const hasWarning = (rule: ProjectRule) => !rule.description && !rule.alwaysApply && !rule.globs;

  const getAppliesToText = (rule: ProjectRule) => {
    if (rule.globs) {
      if (Array.isArray(rule.globs)) {
        return `Applies to: ${rule.globs.join(', ')}`;
      } else {
        return `Applies to: ${rule.globs}`;
      }
    }
    return '';
  };

  useEffect(() => {
    const disposable = rulesService.onRulesChange(() => {
      setProjectRules(rulesService.projectRules);
    });
    return () => {
      disposable.dispose();
    };
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{localize('ai.native.rules.title')}</h2>
          <p className={styles.description}>{localize('ai.native.rules.description')}</p>
        </div>
      </div>
      <div className={styles.user_rules}>
        <div className={styles.user_rules_header}>
          <h3 className={styles.title}>{localize('ai.native.rules.userRules.title')}</h3>
          <p className={styles.description}>{localize('ai.native.rules.userRules.description')}</p>
        </div>
        <div className={styles.user_rules_content}>
          <textarea
            rows={6}
            placeholder={localize('ai.native.rules.userRules.placeholder')}
            value={globalRules}
            onChange={handleGlobalRulesChange}
            style={{ resize: 'none' }}
          />
        </div>
      </div>
      <div className={styles.project_rules}>
        <div className={styles.project_rules_header}>
          <div className={styles.project_rules_header_left}>
            <h3 className={styles.title}>
              {localize('ai.native.rules.projectRules.title')}
              <button className={styles.actionButton} onClick={handleCreateNewRule}>
                <Icon icon='plus' className={styles.actionButtonIcon} />
                {localize('ai.native.rules.projectRules.newRule')}
              </button>
            </h3>
            <p className={styles.description}>{localize('ai.native.rules.projectRules.description')}</p>
          </div>
        </div>
        <div className={styles.project_rules_content}>
          {projectRules.length > 0 ? (
            <div className={styles.project_rules_list}>
              {projectRules.map((rule, index) => (
                <div key={index} className={styles.rule_item} onClick={() => handleOpenRule(rule)}>
                  <div className={styles.rule_item_left}>
                    <div className={styles.rule_filename}>{getFileNameFromPath(rule.path)}</div>
                    {rule.description && <div className={styles.rule_description}>{rule.description}</div>}
                    {hasWarning(rule) && (
                      <div className={styles.rule_warning}>
                        This rule may never be used since it has no description or auto attachments
                      </div>
                    )}
                  </div>
                  <div className={styles.rule_item_right}>
                    {getAppliesToText(rule) && <div className={styles.rule_applies_to}>{getAppliesToText(rule)}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty_state}>{localize('ai.native.rules.projectRules.empty')}</div>
          )}
        </div>
      </div>
    </div>
  );
};
