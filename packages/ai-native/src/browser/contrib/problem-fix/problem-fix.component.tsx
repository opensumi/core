import React from 'react';
import ReactDOM from 'react-dom/client';

import { Button } from '@opensumi/ide-components';
import { AppConfig, ConfigProvider, useInjectable } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';
import { MarkerHover } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/markerHoverParticipant';

import styles from './problem-fix.module.less';
import { ProblemFixService } from './problem-fix.service';

interface IProblemFixComponentProps {
  part: MarkerHover;
}

export const ProblemFixComponent = ({ part }: IProblemFixComponentProps) => {
  const problemFixService = useInjectable<ProblemFixService>(ProblemFixService);

  const handleClick = React.useCallback(() => {
    problemFixService.triggerHoverFix(part);
  }, [problemFixService, part]);

  return (
    <Button size='small' onClick={handleClick}>
      {localize('aiNative.inline.problem.fix.title')}
    </Button>
  );
};

export const MarkerHoverParticipantComponent = {
  mount(container: DocumentFragment, hoverParts: MarkerHover[], configContext: AppConfig) {
    container.childNodes.forEach((node, index) => {
      const dom = document.createElement('div');
      dom.className = styles.problem_fix_btn_container;

      const part = hoverParts[index];

      ReactDOM.createRoot(dom).render(
        <ConfigProvider value={configContext}>
          <ProblemFixComponent part={part} />
        </ConfigProvider>,
      );
      node.appendChild(dom);
    });
  },
};
