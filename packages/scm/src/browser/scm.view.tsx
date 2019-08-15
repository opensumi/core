import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, EDITOR_COMMANDS, useInjectable, IContextKeyService } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import * as useComponentSize from '@rehooks/component-size';
import { paths, URI, CommandService } from '@ali/ide-core-common';
import clx from 'classnames';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import TextareaAutosize from 'react-autosize-textarea';

import { SCMService, ISCMRepository, ISCMResourceGroup } from '../common';
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
  gitStage = 'git.stage',
  gitUnstage = 'git.unstage',
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
  [repoTreeAction.gitStage]: {
    icon: 'volans_icon plus',
    title: 'Stage changes',
    command: 'git.stage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
  [repoTreeAction.gitUnstage]: {
    icon: 'volans_icon line',
    title: 'Unstage changes',
    command: 'git.unstage',
    location: TreeViewActionTypes.TreeNode_Right,
  },
};

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

function isGroupVisible(group: ISCMResourceGroup) {
  return group.elements.length > 0 || !group.hideWhenEmpty;
}

export const SCM = observer((props) => {
  // const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const scmService = useInjectable<SCMService>(SCMService);
  const labelService = useInjectable<LabelService>(LabelService);
  const commandService = useInjectable<CommandService>(CommandService);

  const { selectedRepositories } = scmService;
  if (!selectedRepositories) {
    return <div>[WARNING]: Source control is not available at this time.</div>;
  }

  const ref = React.useRef(null);
  const size = (useComponentSize as any)(ref);

  const [selectedRepository] = selectedRepositories;

  function getNodes(repo: ISCMRepository) {
    if (!repo || !repo.provider) {
      return [];
    }

    const { groups, rootUri } = repo.provider;

    const arr = groups.elements.map((group, index) => {
      // 空的 group 不展示
      if (!isGroupVisible(group)) {
        return [];
      }

      const parent: TreeNode = {
        id: group.id,
        name: group.label,
        order: index,
        depth: 0,
        parent: undefined,
        badge: group.elements.length,
      };

      return [parent].concat(group.elements.map((subElement) => {
        const filePath = paths.parse(subElement.sourceUri.path);
        const uri = URI.from(subElement.sourceUri);
        const badgeColor = gitStatusColorMap[subElement.decorations.letter!];
        return {
          resourceState: (subElement as any).toJSON(),
          id: index,
          uri,
          name: filePath.base,
          description: paths.relative(rootUri!.path, filePath.dir),
          icon: labelService.getIcon(uri),
          order: index,
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

  const nodes = getNodes(selectedRepository);

  function commandActuator(command: string, params?) {
    return commandService.executeCommand(command, params);
  }

  const [ commitMsg, setCommitMsg ] = React.useState('');
  const commitInputRef = React.useRef<HTMLTextAreaElement>(null);

  function changeCommitMsg(msg: string) {
    setCommitMsg(msg);
    if (selectedRepository) {
      selectedRepository.input.value = msg;
    }
  }

  async function handleCommit() {
    await commandActuator('git.commit');
    changeCommitMsg('');
  }

  return (
    <div className={styles.wrap} ref={ref}>
      <div className={styles.scm}>
        <div className={styles.header}>
          <div>SOURCE CONTROL: GIT</div>
          <div>
            <span
              className={clx('check', 'volans_icon', styles.icon)}
              title={localize('scm.action.git.commit')}
              onClick={handleCommit}
            />
            <span
              className={clx('refresh', 'volans_icon', styles.icon)}
              title={localize('scm.action.git.refresh')}
              onClick={() => commandActuator('git.refresh')}
            />
            <span
              className='fa fa-ellipsis-h'
              title={localize('scm.action.git.more')}
            />
          </div>
        </div>
        <div className={styles.commitInput}>
          <TextareaAutosize
            placeholder={localize('commit msg', 'Message (press ⌘Enter to commit)')}
            autoFocus={true}
            tabIndex={1}
            value={commitMsg}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => changeCommitMsg(e.target.value)}
            ref={commitInputRef}
            rows={1}
            maxRows={6} /* from VS Code */
          />
        </div>
        <RecycleTree
          onSelect={ (files) => { console.log(files); } }
          nodes={nodes}
          contentNumber={nodes.length}
          scrollContainerStyle={{ width: size.width, height: size.height }}
          itemLineHeight={itemLineHeight}
          commandActuator={commandActuator}
        />
      </div>
    </div>
  );
});

SCM.displayName = 'SCM';
