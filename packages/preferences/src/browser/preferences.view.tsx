import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './index.module.less';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { useInjectable } from '@ali/ide-core-browser';
import { PreferenceService } from './preference.service';

export const PreferenceView: ReactEditorComponent<null> = (props) => {

  const preferenceService: PreferenceService  = useInjectable(PreferenceService);

  const list = preferenceService.preferenceList();
  const renderPreferenceList = () => {
    const results: React.ReactNode[] = [];

    for (const key of Object.keys(list)) {
      results.push(<div>{key}:{list[key]}</div>);
    }
    return results;
  };

  return (
    <div>
      {renderPreferenceList()}
    </div>
  );
};
