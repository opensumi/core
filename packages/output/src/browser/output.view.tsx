import { observer } from 'mobx-react-lite';
import React from 'react';
import { useEffect, createRef } from 'react';

import { Select } from '@opensumi/ide-components';
import { useInjectable, isElectronRenderer, ViewState } from '@opensumi/ide-core-browser';
import { Select as NativeSelect } from '@opensumi/ide-core-browser/lib/components/select';

import styles from './output.module.less';
import { OutputService } from './output.service';

const NONE = '<no channels>';

const NONE_CHANNELS = [
  {
    label: NONE,
    value: NONE,
  },
];

export const Output = observer(({ viewState }: { viewState: ViewState }) => {
  const outputService = useInjectable<OutputService>(OutputService);
  const outputRef = createRef<HTMLDivElement>();

  useEffect(() => {
    outputService.viewHeight = String(viewState.height);
  }, [viewState.height]);

  useEffect(() => {
    if (outputRef.current) {
      outputService.initOutputMonacoInstance(outputRef.current);
    }
  }, []);

  return (
    <React.Fragment>
      <div className={styles.output} ref={outputRef} />
    </React.Fragment>
  );
});

export const ChannelSelector = observer(() => {
  const outputService = useInjectable<OutputService>(OutputService);
  const channelOptionElements: React.ReactNode[] = [];
  outputService.getChannels().forEach((channel, idx) => {
    channelOptionElements.push(
      <option value={channel.name} key={`${idx} - ${channel.name}`}>
        {channel.name}
      </option>,
    );
  });
  if (channelOptionElements.length === 0) {
    channelOptionElements.push(
      <option key={NONE} value={NONE}>
        {NONE}
      </option>,
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

  const options =
    outputService.channels.size === 0
      ? NONE_CHANNELS
      : Array.from(outputService.channels.values()).map((channel) => ({
          label: channel.name,
          value: channel.name,
        }));

  return isElectronRenderer() ? (
    <NativeSelect
      value={outputService.selectedChannel ? outputService.selectedChannel.name : NONE}
      onChange={handleChange}
    >
      {channelOptionElements}
    </NativeSelect>
  ) : (
    <Select
      value={outputService.selectedChannel ? outputService.selectedChannel.name : NONE}
      className={styles.select}
      size='small'
      maxHeight={outputService.viewHeight}
      onChange={handleChange}
      options={options}
    />
  );
});
