import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { ConfigContext, localize } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode } from '@ali/ide-core-browser/lib/components';
import * as useComponentSize from '@rehooks/component-size';
import { paths, URI } from '@ali/ide-core-common';
import clx from 'classnames';
import { LabelService } from '@ali/ide-core-browser/lib/services';

import { SCMService, ISCMRepository } from '../common';
import * as styles from './scm.module.less';

const itemLineHeight = 22;

const gitStatusColorMap = {
  // todo: read these colore from theme @taian.lta
  M: 'rgb(226, 192, 141)',
  U: 'rgb(115, 201, 145)',
  A: 'rgb(129, 184, 139)',
};

export const SCM = observer((props) => {
  const configContext = React.useContext(ConfigContext);
  const { injector, workspaceDir } = configContext;
  const scmService = injector.get(SCMService);
  const labelService = injector.get(LabelService);
  const { selectedRepositories } = scmService;

  if (!selectedRepositories) {
    return <div>[WARNING]: Source control is not available at this time.</div>;
  }

  const ref = React.useRef(null);
  const size = (useComponentSize as any)(ref);

  const [selectedRepository] = selectedRepositories as ISCMRepository[];

  const nodes = React.useMemo(() => {
    if (!selectedRepository || !selectedRepository.provider) {
      return [];
    }

    const { groups, rootUri } = selectedRepository.provider;

    const arr = groups.elements.map((element, index) => {
      // 空的 group 不展示
      if (element.hideWhenEmpty && !element.elements.length) {
        return [];
      }

      const parent: TreeNode = {
        id: element.id,
        name: element.label,
        order: index,
        depth: 0,
        parent: undefined,
        badge: element.elements.length,
      };

      return [parent].concat(element.elements.map((subElement) => {
        const filePath = paths.parse(subElement.sourceUri.path);
        const uri = URI.from(subElement.sourceUri);
        const badgeColor = gitStatusColorMap[subElement.decorations.letter!];
        return {
          id: index,
          name: filePath.base,
          description: paths.relative(rootUri!.path, filePath.dir),
          icon: labelService.getIcon(uri),
          order: index,
          depth: 0,
          parent: undefined,
          badge: subElement.decorations.letter,
          badgeStyle: badgeColor ? { color: badgeColor } : null,
        } as TreeNode;
      }));
    });

    return Array.prototype.concat.apply([], arr);
  }, [ selectedRepository ]);

  return (
    <div className={styles.wrap} ref={ref}>
      <div className={styles.scm}>
        <div className={styles.header}>
          <div>SOURCE CONTROL: GIT</div>
          <div>
            <span className={clx('check', 'volans_icon', styles.icon)} title={localize('scm.action.git.refresh')} />
            <span className={clx('refresh', 'volans_icon', styles.icon)} title={localize('scm.action.git.commit')} />
            <span className='fa fa-ellipsis-h' title={localize('scm.action.git.more')} />
          </div>
        </div>
        <RecycleTree
          onSelect={ (files) => { console.log(files); } }
          nodes={nodes}
          contentNumber={nodes.length}
          scrollContainerStyle={{ width: size.width, height: size.height }}
          itemLineHeight={itemLineHeight}
        />
      </div>
    </div>
  );
});

SCM.displayName = 'SCM';
