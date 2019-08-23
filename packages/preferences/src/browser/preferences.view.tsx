import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable, PreferenceSchemaProvider } from '@ali/ide-core-browser';
import { PreferenceService } from './preference.service';
import './index.less';

export const PreferenceView: ReactEditorComponent<null> = observer((props) => {

  const preferenceService: PreferenceService  = useInjectable(PreferenceService);
  let selectedPreference = preferenceService.userPreference;

  const renderScopeSelect = () => {
    const options: React.ReactNode[] = [];
    options.push(<option value='default'>Default</option>);
    options.push(<option value='user'>User</option>);
    options.push(<option value='workspace'>WorkSpace</option>);
    options.push(<option value='folder'>Folder</option>);

    return (<select
      value={selectedPreference ? selectedPreference.name : 'user'}
      onChange={async (event) => {

        const name = (event.target as HTMLSelectElement).value;
        switch (name) {
          case 'default':
            selectedPreference = preferenceService.defaultPreference;
            const list = (selectedPreference as PreferenceSchemaProvider).getPreferences();
            setList(list);
            break;
          case 'user':
            selectedPreference = preferenceService.userPreference;
            preferenceService.getPreferences(preferenceService.userPreference).then((list) => {
              setList(list);
            });
            break;
          case 'workspace':
            selectedPreference = preferenceService.workspacePreference;
            preferenceService.getPreferences(preferenceService.workspacePreference).then((list) => {
              setList(list);
            });
            break;
          case 'folder':
            selectedPreference = preferenceService.folderPreference;
            preferenceService.getPreferences(preferenceService.folderPreference).then((list) => {
              setList(list);
            });
            break;
        }

    }}>{options}</select>);
  };

  const [list, setList] = React.useState({});
  const renderPreferenceList = () => {
    const results: React.ReactNode[] = [];

    for (const key of Object.keys(list)) {
      results.push(<div key={key}>{key}:{list[key]}</div>);
    }
    return results;
  };

  return (
    <div>
      <div>
        {renderScopeSelect()}
      </div>
      <div className='property-list'>
        {renderPreferenceList()}
      </div>
    </div>
  );
});
