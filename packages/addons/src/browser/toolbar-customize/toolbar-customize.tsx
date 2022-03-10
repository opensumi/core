import React from 'react';

import { Injectable, Autowired } from '@opensumi/di';
import { CheckBox, Select, Button } from '@opensumi/ide-components';
import {
  useInjectable,
  PreferenceService,
  PreferenceScope,
  IToolbarRegistry,
  localize,
} from '@opensumi/ide-core-browser';

import styles from './style.module.less';

@Injectable()
export class ToolbarCustomizeViewService {
  private _setVisible: (visible: boolean) => void;

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  public bindSetVisibleHandle(setVisible: (visible: boolean) => void) {
    this._setVisible = setVisible;
  }

  setVisible(visible: boolean) {
    this._setVisible(visible);
  }

  async toggleActionVisibility(location: string, actionId: string, visible: boolean) {
    const prev: { [key: string]: string[] } = this.preferenceService.get('toolbar.ignoreActions') || {};
    if (!prev[location]) {
      prev[location] = [];
    }
    if (!visible) {
      if (prev[location].indexOf(actionId) === -1) {
        prev[location].push(actionId);
      }
    } else {
      const index = prev[location].indexOf(actionId);
      if (index !== -1) {
        prev[location].splice(index, 1);
      }
    }
    const effectingScope = this.preferenceService.inspect('toolbar.ignoreActions')!.workspaceValue
      ? PreferenceScope.Workspace
      : PreferenceScope.User;
    await this.preferenceService.set('toolbar.ignoreActions', prev, effectingScope);
  }
}

export const ToolbarCustomizeComponent = () => {
  const [visible, setVisible] = React.useState<boolean>(false);
  const service: ToolbarCustomizeViewService = useInjectable(ToolbarCustomizeViewService);
  const registry: IToolbarRegistry = useInjectable(IToolbarRegistry);
  const preferenceService: PreferenceService = useInjectable(PreferenceService);

  service.bindSetVisibleHandle(setVisible);

  if (!visible) {
    return null;
  }

  const locations = registry.getAllLocations();

  const currentPref: { [key: string]: string[] } = preferenceService.get('toolbar.ignoreActions') || {};

  let currentDisplayPref: string = preferenceService.get<string>('toolbar.buttonDisplay', 'iconAndText')!;

  function renderLocationPref(location: string) {
    const groups = [{ id: '_head' }, ...(registry.getActionGroups(location) || []), { id: '_tail' }];
    const result: React.ReactNode[] = [];
    const pref = currentPref[location] || [];

    groups.forEach((group, gi) => {
      const actions = registry.getToolbarActions({ location, group: group.id });
      if (actions && actions.actions.length > 0) {
        if (result.length > 0) {
          result.push(<div className={styles['group-split']} key={'split-' + gi}></div>);
        }
        actions.actions.forEach((action, i) => {
          let visible = pref.indexOf(action.id) === -1;
          const id = 'action-toggle-' + action.id;
          result.push(
            <div className={styles['action-item']} key={i + '_' + action.id}>
              <CheckBox
                onChange={() => {
                  service.toggleActionVisibility(location, action.id, !visible);
                  visible = !visible;
                }}
                defaultChecked={visible}
                id={id}
                label={action.description}
              />
            </div>,
          );
        });
      }
    });
    if (result.length === 0) {
      return null;
    }

    return (
      <div key={location} className={styles['toolbar-customize-location']}>
        {result}
      </div>
    );
  }

  return (
    <div className={styles['toolbar-customize-overlay']}>
      <div className={styles['toolbar-customize']}>
        {locations.map((location) => renderLocationPref(location))}
        <div className={styles['button-display']}>
          <div>{localize('toolbar-customize.buttonDisplay.description')}</div>
          <Select
            options={[
              {
                label: localize('toolbar-customize.buttonDisplay.icon'),
                value: 'icon',
              },
              {
                label: localize('toolbar-customize.buttonDisplay.iconAndText'),
                value: 'iconAndText',
              },
            ]}
            value={currentDisplayPref}
            onChange={(v) => {
              const effectingScope = preferenceService.inspect('toolbar.buttonDisplay')!.workspaceValue
                ? PreferenceScope.Workspace
                : PreferenceScope.User;
              preferenceService.set('toolbar.buttonDisplay', v, effectingScope);
              currentDisplayPref = v;
            }}
            className={styles['button-display-select']}
          ></Select>
        </div>
        <div className={styles['customize-complete']}>
          <Button type='primary' onClick={() => setVisible(false)}>
            {localize('toolbar-customize.complete')}
          </Button>
        </div>
      </div>
    </div>
  );
};
