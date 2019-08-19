import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, EDITOR_COMMANDS, useInjectable, useComponentSize, ComponentSize } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService } from '@ali/ide-core-common';
import { ISplice } from '@ali/ide-core-common/lib/sequence';
import * as paths from '@ali/ide-core-common/lib/path';
import { combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import clx from 'classnames';
import { LabelService } from '@ali/ide-core-browser/lib/services';

import { ISCMRepository, ISCMResourceGroup, SCMService } from '../common';
import { SCMInput } from './component/scm-input';

import * as styles from './scm.module.less';

const itemLineHeight = 22; // copied from vscode

const gitStatusColorMap = {
  // todo: read these colore from theme @taian.lta
  M: 'rgb(226, 192, 141)',
  U: 'rgb(115, 201, 145)',
  A: 'rgb(129, 184, 139)',
  D: 'rgb(199, 78, 57)',
  C: 'rgb(108, 108, 196)',
};

enum repoTreeAction {
  openFile = 'editor.openUri',
  gitClean = 'git.clean',
  gitCleanAll = 'git.cleanAll',
  gitStage = 'git.stage',
  gitStageAll = 'git.stageAll',
  gitUnstage = 'git.unstage',
  gitUnstageAll = 'git.unstageAll',
}

const repoTreeActionConfig = {
  [repoTreeAction.openFile]: {
    icon: 'volans_icon open',
    title: 'Open file',
    command: EDITOR_COMMANDS.OPEN_RESOURCE.id,
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitClean]: {
    icon: 'volans_icon withdraw',
    title: 'Discard changes',
    command: 'git.clean',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitCleanAll]: {
    icon: 'volans_icon withdraw',
    title: 'Discard all changes',
    command: 'git.cleanAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitStage]: {
    icon: 'volans_icon plus',
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitStageAll]: {
    icon: 'volans_icon plus',
    title: 'Stage all changes',
    command: 'git.stageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitUnstage]: {
    icon: 'volans_icon line',
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitUnstageAll]: {
    icon: 'volans_icon line',
    title: 'Unstage all changes',
    command: 'git.unstageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
};

function getRepoGroupActions(groupId: string) {
  if (groupId === 'merge') {
    return [{
      ...repoTreeActionConfig[repoTreeAction.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'index') {
    return [{
      ...repoTreeActionConfig[repoTreeAction.gitUnstageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'workingTree') {
    return [{
      ...repoTreeActionConfig[repoTreeAction.gitCleanAll],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[repoTreeAction.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }
}

function getRepoFileActions(groupId: string) {
  const actionList: TreeViewAction[] = [
    repoTreeActionConfig[repoTreeAction.openFile],
  ];

  if (groupId === 'merge') {
    return actionList.concat({
      ...repoTreeActionConfig[repoTreeAction.gitStage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'index') {
    return actionList.concat({
      ...repoTreeActionConfig[repoTreeAction.gitUnstage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'workingTree') {
    return actionList.concat({
      ...repoTreeActionConfig[repoTreeAction.gitClean],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[repoTreeAction.gitStage],
      paramsKey: 'resourceState',
    });
  }

  return actionList;
}

export const SCMHeader: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandSerivce = useInjectable<CommandService>(CommandService);
  const [ commitMsg, setCommitMsg ] = React.useState('');

  if (!repository || !repository.provider) {
    return (
      <>
        <div className={styles.header}>
          <div>SOURCE CONTROL</div>
        </div>
        <div className={styles.noopTip}>
          No source control providers registered.
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <div>SOURCE CONTROL: GIT</div>
        <div>
          <span
            className={clx('check', 'volans_icon', styles.icon)}
            title={localize('scm.action.git.commit')}
            onClick={() => commandSerivce.executeCommand('git.commit')}
          />
          <span
            className={clx('refresh', 'volans_icon', styles.icon)}
            title={localize('scm.action.git.refresh')}
            onClick={() => commandSerivce.executeCommand('git.refresh')}
          />
          <span
            className='fa fa-ellipsis-h'
            title={localize('scm.action.git.more')}
            onClick={() => console.log('should show menu')}
          />
        </div>
      </div>
      <SCMInput
        repository={repository}
        value={commitMsg}
        onChange={(val: string) => setCommitMsg(val)} />
    </>
  );
};

function isGroupVisible(group: ISCMResourceGroup) {
  return group.elements.length > 0 || !group.hideWhenEmpty;
}

export const SCMRepoTree: React.FC<{
  repository: ISCMRepository;
  size: ComponentSize;
}> = ({ repository, size }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const labelService = useInjectable<LabelService>(LabelService);

  const [, forceRender] = React.useReducer((s) => s + 1, 0);

  React.useEffect(() => {
    if (repository) {
      const groupSequence = repository.provider.groups;
      groupSequence.onDidSplice(onDidSpliceGroups);
      onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: groupSequence.elements });
    }

    // 监听事件后 forceRender
    function onDidSpliceGroups(splice: ISplice<ISCMResourceGroup>): void {
      const { toInsert } = splice;

      for (const group of toInsert) {
        combinedDisposable([
          group.onDidChange(() => forceRender('')),
          group.onDidSplice(() => forceRender('')),
        ]);
      }

      forceRender('');
    }
  }, [repository]);

  function commandActuator(command: string, params?) {
    return commandService.executeCommand(command, params);
  }

  function getNodes(repository: ISCMRepository) {
    if (!repository || !repository.provider) {
      return [];
    }

    const { groups, rootUri } = repository.provider;

    const arr = groups.elements
      .map((group) => {
        if (!isGroupVisible(group)) {
          return [];
        }

        const parent: TreeNode = {
          resourceState: (group as any).toJSON(),
          id: group.id,
          name: group.label,
          depth: 0,
          parent: undefined,
          badge: group.elements.length,
          actions: getRepoGroupActions(group.id),
        };

        return [parent].concat(group.elements.map((subElement, index) => {
          const filePath = paths.parse(subElement.sourceUri.path);
          const uri = URI.from(subElement.sourceUri);
          const badgeColor = gitStatusColorMap[subElement.decorations.letter!];
          return {
            resourceState: (subElement as any).toJSON(),
            id: group.label + index,
            uri,
            name: filePath.base,
            description: paths.relative(rootUri!.path, filePath.dir),
            icon: labelService.getIcon(uri),
            depth: 0,
            parent: undefined,
            badge: subElement.decorations.letter,
            badgeStyle: badgeColor ? { color: badgeColor } : null,
            actions: getRepoFileActions(group.id),
          } as TreeNode;
        }));
      });

    return Array.prototype.concat.apply([], arr);
  }

  const nodes = getNodes(repository);

  return (
    <RecycleTree
      onSelect={ (files) => { console.log(files); } }
      nodes={nodes}
      contentNumber={nodes.length}
      scrollContainerStyle={{ width: size.width, height: size.height }}
      itemLineHeight={itemLineHeight}
      commandActuator={commandActuator}
    />
  );
};

export const SCM = observer((props) => {
  const scmService = useInjectable<SCMService>(SCMService);
  const [selectedRepository] = scmService.selectedRepositories;

  const ref = React.useRef<HTMLDivElement>(null);
  const size = useComponentSize(ref);
  return (
    <div className={styles.wrap} ref={ref}>
      <div className={styles.scm}>
        <SCMHeader repository={selectedRepository} />
        <SCMRepoTree size={size} repository={selectedRepository} />
      </div>
    </div>
  );
});

SCM.displayName = 'SCM';
