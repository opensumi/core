import React, { useEffect, useRef } from 'react';

import { Option, Select } from '@opensumi/ide-components';
import { AppConfig, ViewState, useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { OUTPUT_CONTAINER_ID } from '@opensumi/ide-core-browser/lib/common/container-id';
import { Select as NativeSelect } from '@opensumi/ide-core-browser/lib/components/select';
import { IMainLayoutService } from '@opensumi/ide-main-layout/lib/common/main-layout.definition';

import styles from './output.module.less';
import { OutputService } from './output.service';

export const Output = ({ viewState }: { viewState: ViewState }) => {
  const outputService = useInjectable<OutputService>(OutputService);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);

  useEffect(() => {
    outputService.viewHeight = String(viewState.height);
  }, [viewState.height]);

  useEffect(() => {
    if (outputRef.current) {
      const handler = layoutService.getTabbarHandler(OUTPUT_CONTAINER_ID);
      if (handler?.isActivated()) {
        outputService.initOutputMonacoInstance(outputRef.current);
      } else {
        const dispose = handler?.onActivate(() => {
          outputService.initOutputMonacoInstance(outputRef.current!);
          dispose?.dispose();
        });
      }
    }
  }, []);

  return (
    <React.Fragment>
      <div className={styles.output} ref={outputRef} />
    </React.Fragment>
  );
};

export const ChannelSelector = () => {
  const NONE = '<no channels>';

  const appConfig = useInjectable<AppConfig>(AppConfig);
  const channelOptionElements: React.ReactNode[] = [];
  const [name, setName] = React.useState<string>('');
  const outputService = useInjectable<OutputService>(OutputService);
  const channels = useAutorun(outputService.getChannels);

  channels.forEach((channel, idx) => {
    channelOptionElements.push(
      appConfig.isElectronRenderer ? (
        <option value={channel.name} key={`${idx} - ${channel.name}`}>
          {channel.name}
        </option>
      ) : (
        <Option value={channel.name} key={`${idx} - ${channel.name}`}>
          {channel.name}
        </Option>
      ),
    );
  });

  useEffect(() => {
    const dispose = outputService.onDidSelectedChannelChange((channel) => {
      setName(channel.name);
    });
    return () => {
      dispose.dispose();
    };
  }, []);

  if (channelOptionElements.length === 0) {
    channelOptionElements.push(
      appConfig.isElectronRenderer ? (
        <option key={NONE} value={NONE}>
          {NONE}
        </option>
      ) : (
        <Option key={NONE} value={NONE}>
          {NONE}
        </Option>
      ),
    );
  }

  async function handleChange(event: React.ChangeEvent<HTMLSelectElement> | string) {
    let channelName;
    if (typeof event === 'object') {
      channelName = (event.target as HTMLSelectElement).value;
    } else {
      channelName = event;
    }

    if (channelName !== NONE) {
      outputService.updateSelectedChannel(outputService.getChannel(channelName));
    }
  }

  return appConfig.isElectronRenderer ? (
    <NativeSelect value={name ? name : NONE} onChange={handleChange}>
      {channelOptionElements}
    </NativeSelect>
  ) : (
    <Select
      value={name ? name : NONE}
      className={styles.select}
      size='small'
      maxHeight={outputService.viewHeight}
      onChange={handleChange}
    >
      {channelOptionElements}
    </Select>
  );
};
