import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, PreferenceSchemaProvider, PreferenceDataProperty } from '@ali/ide-core-browser';
import { PreferenceService } from './preference.service';
import './index.less';

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceService  = useInjectable(PreferenceService);
  const defaultPreferenceProvider: PreferenceSchemaProvider = (preferenceService.defaultPreference as PreferenceSchemaProvider);
  let selectedPreference = preferenceService.userPreference;

  const defaultList = defaultPreferenceProvider.getPreferences();
  const [list, setList] = React.useState({});

  const renderScopeSelect = () => {
    const options: React.ReactNode[] = [];
    options.push(<option value='user'>User</option>);
    options.push(<option value='workspace'>WorkSpace</option>);

    return (<select
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
  setTimeout(() => {
    selectedPreference = preferenceService.userPreference;
    preferenceService.getPreferences(preferenceService.userPreference).then((list) => {
      setList(Object.assign({}, defaultList, list));
    });
  });

  const renderPreferenceList = () => {
    const results: React.ReactNode[] = [];

    for (const key of Object.keys(list)) {
      const prop: PreferenceDataProperty|undefined = defaultPreferenceProvider.getPreferenceProperty(key);
      results.push(<div key={key}>{key}: {JSON.stringify(list[key])} {prop && prop.description && <span className='desc'>({prop.description})</span>}</div>);

    }
    return results;
  };

  return (
    <div className='wrap'>
      <div>
        {renderScopeSelect()}
      </div>
      <div className='property-list'>
        {renderPreferenceList()}
      </div>
    </div>
  );
});
