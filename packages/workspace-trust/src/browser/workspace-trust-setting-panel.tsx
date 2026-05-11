import React, { useCallback, useState } from 'react';

import { IClientApp, localize, useInjectable } from '@opensumi/ide-core-browser';

import styles from './workspace-trust-setting-panel.module.less';
import { WorkspaceTrustService } from './workspace-trust.service';

export const WorkspaceTrustSettingPanel: React.FC<{ scope: number }> = () => {
  const workspaceTrustService = useInjectable<WorkspaceTrustService>(WorkspaceTrustService);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const [loading, setLoading] = useState(false);

  const isRestricted = workspaceTrustService.isRestricted();

  const handleClick = useCallback(async () => {
    setLoading(true);
    if (isRestricted) {
      await workspaceTrustService.setTrustState('trusted' as any);
    } else {
      await workspaceTrustService.setTrustState('restricted' as any);
    }
    clientApp.fireOnReload(true);
  }, [isRestricted, workspaceTrustService, clientApp]);

  const buttonText = isRestricted
    ? localize('workspace.trust.settings.trustButton', 'Trust Current Project')
    : localize('workspace.trust.settings.restrictButton', 'Enter Restricted Mode');

  const description = isRestricted
    ? localize(
        'workspace.trust.settings.restrictedDesc',
        '当前处于受限模式。当前 IDE 提供可以自动在此文件夹中执行文件的功能。点击以信任此工作区中文件的作者。',
      )
    : localize(
        'workspace.trust.settings.trustedDesc',
        '此工作区已被信任。点击以进入受限模式并禁用可能存在风险的功能。',
      );

  return (
    <div className={styles.workspaceTrustPanel}>
      <div className={styles.description}>{description}</div>
      <button
        className={`${styles.button} ${isRestricted ? styles.buttonTrust : styles.buttonRestrict}`}
        onClick={handleClick}
        disabled={loading}
      >
        {loading ? localize('workspace.trust.settings.loading', 'Processing...') : buttonText}
      </button>
    </div>
  );
};
