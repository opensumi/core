import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { localize, EDITOR_COMMANDS, useInjectable, IContextKeyService, useComponentSize, ComponentSize } from '@ali/ide-core-browser';
import { RecycleTree, TreeNode, TreeViewActionTypes, TreeViewAction } from '@ali/ide-core-browser/lib/components';
import { paths, URI, CommandService, ISplice } from '@ali/ide-core-common';
import clx from 'classnames';
import { LabelService } from '@ali/ide-core-browser/lib/services';
import produce from 'immer';

import { SCMService, ISCMRepository, ISCMResourceGroup, ResourceGroupSplicer, ISCMResource } from '../common';
import { SCMInput } from './component/SCMInput';

import * as styles from './scm.module.less';
import { Injectable, Autowired } from '@ali/common-di';
import { combinedDisposable, IDisposable } from '../../../core-common/src/lifecycle';

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

interface IGroupItem {
  readonly group: ISCMResourceGroup;
  visible: boolean;
  readonly disposable: IDisposable;
}

type IGroupList = IGroupItem[];

export const SCMRepoTree: React.FC<{
  repository: ISCMRepository;
  size: ComponentSize;
}> = ({ repository, size }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const labelService = useInjectable<LabelService>(LabelService);

  const [items, setItems] = React.useState<IGroupList>([]);

  React.useEffect(() => {
    if (repository) {
      const groupSequence = repository.provider.groups;
      groupSequence.onDidSplice(onDidSpliceGroups);
      onDidSpliceGroups({ start: 0, deleteCount: 0, toInsert: groupSequence.elements });
    }

    function onDidSpliceGroups(splice: ISplice<ISCMResourceGroup>): void {
      const { start, deleteCount, toInsert } = splice;
      console.log(splice, 'splice_onDidSpliceGroups');
      const itemsToInsert: IGroupList = [];

      for (const group of toInsert) {
        const visible = isGroupVisible(group);

        const disposable = combinedDisposable([
          group.onDidChange(() => onDidChangeGroup(group)),
          group.onDidSplice((splice) => onDidSpliceGroup(group, splice)),
        ]);

        itemsToInsert.push({ group, visible, disposable });
      }

      setItems(produce((draft) => {
        draft.splice(start, deleteCount, ...itemsToInsert);
      }));
    }

    function onDidChangeGroup(group: ISCMResourceGroup) {
      console.log(group, 'group_onDidChangeGroup');
      setItems(produce((draft) => {
        const itemIndex = draft.findIndex((item) => item.group === group);

        if (itemIndex < 0) {
          return;
        }

        // update item by splice it
        const item = draft[itemIndex];
        item.visible = isGroupVisible(group);
        item.group = group;
        draft.splice(itemIndex, 1, item);
      }));
    }

    function onDidSpliceGroup(group: ISCMResourceGroup, splice: ISplice<ISCMResource>) {
      const { start, deleteCount, toInsert } = splice;
      console.log(group, splice, 'group_onDidSpliceGroup');
      setItems(produce((draft) => {
        const itemIndex = draft.findIndex((item) => item.group === group);

        if (itemIndex < 0) {
          return;
        }

        // update item by splice it
        const item = draft[itemIndex];
        item.visible = isGroupVisible(group);
        item.group.elements.splice(start, deleteCount, ...toInsert);
        draft.splice(itemIndex, 1, item);
      }));
    }
  }, [repository]);

  function commandActuator(command: string, params?) {
    return commandService.executeCommand(command, params);
  }

  const nodes = React.useMemo(() => {
    function getNodes(scmGroups: IGroupList) {
      if (!scmGroups.length) {
        return [];
      }

      const arr = scmGroups.
        filter((n) => n.visible)
        .map(({ group }, index) => {

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
              id: group.label + index,
              uri,
              name: filePath.base,
              // description: paths.relative(rootUri!.path, filePath.dir),
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

    return getNodes(items);
  }, [items]);

  console.log(items, 'items');

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
