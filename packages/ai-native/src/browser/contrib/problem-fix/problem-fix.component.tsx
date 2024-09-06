import React from 'react';
import ReactDOM from 'react-dom/client';

import { Button } from '@opensumi/ide-components';
import { AppConfig, ConfigProvider } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';

import styles from './problem-fix.module.less';

export const ProblemFixComponent = () => {
  const handleClick = () => {};

  return (
    <Button size='small' onClick={handleClick}>
      {localize('aiNative.inline.problem.fix.title')}
    </Button>
  );
};

export const MarkerHoverParticipantComponent = {
  mount(container: DocumentFragment, configContext: AppConfig) {
    const dom = document.createElement('div');
    dom.className = styles.problem_fix_btn_container;

    ReactDOM.createRoot(dom).render(
      <ConfigProvider value={configContext}>
        <ProblemFixComponent />
      </ConfigProvider>,
    );

    container.appendChild(dom);
  },
};
