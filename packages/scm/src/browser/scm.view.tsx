import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, EDITOR_COMMANDS, useInjectable } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { URI, CommandService } from '@ali/ide-core-common';
import { ISplice } from '@ali/ide-core-common/lib/sequence';
import * as paths from '@ali/ide-core-common/lib/path';
import { combinedDisposable } from '@ali/ide-core-common/lib/disposable';
import clx from 'classnames';
import { ContextMenuRenderer } from '@ali/ide-core-browser/lib/menu';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import { ViewState } from '@ali/ide-activity-panel';

import { ISCMRepository, ISCMResourceGroup, SCMService } from '../common';
import { SCMInput } from './component/scm-input';

import * as styles from './scm.module.less';
import { SCM_CONTEXT_MENU } from './scm-contribution';

const itemLineHeight = 22; // copied from vscode

const gitStatusColorMap = {
  // todo: read these colore from theme @taian.lta
  M: 'rgb(226, 192, 141)',
  U: 'rgb(115, 201, 145)',
  A: 'rgb(129, 184, 139)',
  D: 'rgb(199, 78, 57)',
  C: 'rgb(108, 108, 196)',
};

enum GitActionList {
  openFile = 'editor.openUri',
  gitCommit = 'git.commit',
  gitRefresh = 'git.refresh',
  gitClean = 'git.clean',
  gitCleanAll = 'git.cleanAll',
  gitStage = 'git.stage',
  gitStageAll = 'git.stageAll',
  gitUnstage = 'git.unstage',
  gitUnstageAll = 'git.unstageAll',
  gitOpenResource = 'git.openResource',
}

const repoTreeActionConfig = {
  [GitActionList.openFile]: {
    icon: 'volans_icon open',
    title: 'Open file',
    command: EDITOR_COMMANDS.OPEN_RESOURCE.id,
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitClean]: {
    icon: 'volans_icon withdraw',
    title: 'Discard changes',
    command: 'git.clean',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitCleanAll]: {
    icon: 'volans_icon withdraw',
    title: 'Discard all changes',
    command: 'git.cleanAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStage]: {
    icon: 'volans_icon plus',
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitStageAll]: {
    icon: 'volans_icon plus',
    title: 'Stage all changes',
    command: 'git.stageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstage]: {
    icon: 'volans_icon line',
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [GitActionList.gitUnstageAll]: {
    icon: 'volans_icon line',
    title: 'Unstage all changes',
    command: 'git.unstageAll',
    location: TreeViewActionTypes.TreeNode_Right,
  },
};

function getRepoGroupActions(groupId: string) {
  if (groupId === 'merge') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'index') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitUnstageAll],
      paramsKey: 'resourceState',
    }];
  }

  if (groupId === 'workingTree') {
    return [{
      ...repoTreeActionConfig[GitActionList.gitCleanAll],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStageAll],
      paramsKey: 'resourceState',
    }];
  }
}

function getRepoFileActions(groupId: string) {
  const actionList: TreeViewAction[] = [
    repoTreeActionConfig[GitActionList.openFile],
  ];

  if (groupId === 'merge') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'index') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitUnstage],
      paramsKey: 'resourceState',
    });
  }

  if (groupId === 'workingTree') {
    return actionList.concat({
      ...repoTreeActionConfig[GitActionList.gitClean],
      paramsKey: 'resourceState',
    }, {
      ...repoTreeActionConfig[GitActionList.gitStage],
      paramsKey: 'resourceState',
    });
  }

  return actionList;
}

export const SCMHeader: React.FC<{
  repository: ISCMRepository;
}> = ({ repository }) => {
  const commandService = useInjectable<CommandService>(CommandService);
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
            onClick={() => commandService.executeCommand(GitActionList.gitCommit)}
          />
          <span
            className={clx('refresh', 'volans_icon', styles.icon)}
            title={localize('scm.action.git.refresh')}
            onClick={() => commandService.executeCommand(GitActionList.gitRefresh)}
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
  viewState: ViewState;
}> = ({ repository, viewState }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const labelService = useInjectable<LabelService>(LabelService);
  const contextMenuRenderer = useInjectable<ContextMenuRenderer>(ContextMenuRenderer);

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

    // todo: [@need improve] data structures and types
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
            isFile: true,
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

  async function handleFileSelect(files: TreeNode) {
    const file: TreeNode = files[0];
    if (!file || !file.isFile) {
      return;
    }

    await commandService.executeCommand(GitActionList.gitOpenResource, file.resourceState);
  }

  function onContextMenu(files, event: React.MouseEvent<HTMLElement>) {
    const { x, y } = event.nativeEvent;
    const file: TreeNode = files[0];
    if (!file) {
      return;
    }

    if (file.isFile) {
      const data = { x, y };
      contextMenuRenderer.render(['scm/resourceState/context'], data);
    }
  }

  return (
    <RecycleTree
      nodes={nodes}
      onSelect={handleFileSelect}
      onContextMenu={onContextMenu}
      contentNumber={nodes.length}
      scrollContainerStyle={{ width: viewState.width, height: viewState.height }}
      itemLineHeight={itemLineHeight}
      commandActuator={commandActuator}
    />
  );
};

export const SCM = observer((props: { viewState: ViewState }) => {
  const { width, height } = props.viewState;
  const scmService = useInjectable<SCMService>(SCMService);
  const [selectedRepository] = scmService.selectedRepositories;

  return (
    <div className={styles.wrap}>
      <div className={styles.scm}>
        <SCMHeader repository={selectedRepository} />
        <SCMRepoTree viewState={props.viewState} repository={selectedRepository} />
      </div>
    </div>
  );
});

SCM.displayName = 'SCM';
