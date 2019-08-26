import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, PreferenceSchemaProvider, PreferenceDataProperty, PreferenceProvider } from '@ali/ide-core-browser';
import { PreferenceService } from './preference.service';
import './index.less';
import { IWorkspaceService } from '@ali/ide-workspace';

let initView = false;
let selectedPreference;
export const PreferenceView: ReactEditorComponent<null> = (props) => {

  const preferenceService: PreferenceService  = useInjectable(PreferenceService);
  const defaultPreferenceProvider: PreferenceSchemaProvider = (preferenceService.defaultPreference as PreferenceSchemaProvider);

  const defaultList = defaultPreferenceProvider.getPreferences();
  const [list, setList] = React.useState({});

  const workspaceService: IWorkspaceService = useInjectable(IWorkspaceService);

  workspaceService.whenReady.finally(() => {
    preferenceService.userPreference.ready.finally(() => {
      if (!initView) {
        initView = true;
        selectedPreference = preferenceService.userPreference;
        preferenceService.getPreferences(preferenceService.userPreference).then((list) => {
          setList(Object.assign({}, defaultList, list));
        });
      }
    });
  });

  const changeValue = (key, value) => {
    selectedPreference.setPreference(key, value).then(() => {
      preferenceService.getPreferences(selectedPreference).then( (list) => {
          setList(Object.assign({}, defaultList, list));
      });
    });
  };

  const renderScopeSelect = () => {
    const options: React.ReactNode[] = [];
    options.push(<option value='user'>User</option>);
    options.push(<option value='workspace'>WorkSpace</option>);

    return (<select
      className='scope-select'
      value={selectedPreference ? selectedPreference.name : 'user'}
      onChange={async (event) => {
        const name = (event.target as HTMLSelectElement).value;
        switch (name) {
          case 'user':
            selectedPreference = preferenceService.userPreference;
            preferenceService.getPreferences(preferenceService.userPreference).then((list) => {
              setList(Object.assign({}, defaultList, list));
            });
            break;
          case 'workspace':
            selectedPreference = preferenceService.workspacePreference;
            preferenceService.getPreferences(preferenceService.workspacePreference).then((list) => {
              setList(Object.assign({}, defaultList, list));
            });
            break;
        }

    }}>{options}</select>);
  };

  const renderPreferenceList = () => {
    const results: React.ReactNode[] = [];

    for (const key of Object.keys(list)) {
      results.push(renderPreferenceItem(key, list[key]));
    }
    return results;
  };

  const renderPreferenceItem = (key, value) => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);
    if (prop) {
      switch (prop.type) {
        case 'boolean':
          return renderBooleanValue(key, value);
          break;

        default:
          return <div></div>;
      }
    }
    return <div></div>;
  };

  const renderBooleanValue = (key, value) => {
    const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);

    return (
      <div className='preference-line' key={key}>
        <span className='key'>
          {key}
        </span>
        <span className='value'>
          <select onChange={(event) => {
              changeValue(key, event.target.value === 'true');
            }}
            value={value ? 'true' : 'false'}
          >
            <option key='true' value='true'>true</option>
            <option key='value' value='false'>false</option>
          </select>
        </span>
        {prop && prop.description && <span className='desc'>({prop.description})</span>}
      </div>
    );
  };

  return (
    <div className='preference-view'>
      <div>
        {renderScopeSelect()}
      </div>
      <div className='property-list' key={Object.keys(list).join('-')}>
        {renderPreferenceList()}
      </div>
    </div>
  );
};
