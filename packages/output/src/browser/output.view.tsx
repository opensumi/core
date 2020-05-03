import * as React from 'react';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandService, EDITOR_COMMANDS, isElectronRenderer, ViewState } from '@ali/ide-core-browser';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import { OutputService } from './output.service';
import * as styles from './output.module.less';
import { InfinityList } from '@ali/ide-core-browser/lib/components';

import Ansi from '../common/ansi';

const style: React.CSSProperties = {
  whiteSpace: 'normal',
  fontFamily: 'monospace',
};

interface IOutputItem {
  line: string;
  id: number;
  onPath: (path: string) => void;
}

const OutputTemplate: React.FC<{ data: IOutputItem; index: number }> = ({ data: { line, onPath }, index }) => {
  return (
    <div style={style} key={`${line}-${index}`}><Ansi linkify={true} onPath={onPath}>{line}</Ansi></div>
  );
};

export const Output = observer(({ viewState }: { viewState: ViewState }) => {
  const outputService = useInjectable<OutputService>(OutputService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [rawLines, setRawLines] = React.useState(outputService.getChannels()[0]?.getLines() || []);

  useEffect(() => {
    outputService.viewHeight = String(viewState.height);
  }, [viewState.height]);

  useEffect(() => {
    setRawLines(outputService.selectedChannel?.getLines());
  }, [outputService.selectedChannel]);

  useEffect(() => {
    if (!outputService.selectedChannel) {
      outputService.selectedChannel = outputService.getChannels()[0];
    }
    setRawLines(outputService.selectedChannel?.getLines() || []);
  }, [outputService.keys]);

  const renderLines = (rawLines): IOutputItem[] => {

    const result: IOutputItem[] = [];

    const onPath = (path) => {
      commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, path, { disableNavigate: false, preview: false });
    };
    for (const text of rawLines) {
      const lines = text.split(/[\n\r]+/);
      lines.forEach((line, idx) => {
        if (line) {
          result.push({ line, id: idx, onPath });
        }
      });
    }

    if (result.length === 0) {
      result.push({ line: localize('output.channel.none', '还没有任何输出'), id: -1, onPath });
    }
    return result;
  };

  return <React.Fragment>
    <div className={styles.output}>
      <InfinityList
        template={OutputTemplate}
        getContainer={(ref) => ref}
        style={style}
        data={renderLines(rawLines)}
        className={styles.content}
        keyProp={'id'}
        isLoading={false}
        isDrained={false}
        sliceSize={30}
        sliceThreshold={30}
        scrollBottomIfActive={true}
      />
    </div>
  </React.Fragment>;
});

export const ChannelSelector = observer(() => {
  const NONE = '<no channels>';

  const outputService = useInjectable<OutputService>(OutputService);
  const channelOptionElements: React.ReactNode[] = [];
  outputService.getChannels().forEach((channel, idx) => {
    channelOptionElements.push(
      isElectronRenderer() ?
      <option value={channel.name} key={`${idx} - ${channel.name}`}>{channel.name}</option> :
      <Option value={channel.name} key={`${idx} - ${channel.name}`}>{channel.name}</Option>,
    );
  });
  if (channelOptionElements.length === 0) {
    channelOptionElements.push(
      isElectronRenderer() ?
      <option key={NONE} value={NONE}>{NONE}</option> :
      <Option key={NONE} value={NONE}>{NONE}</Option>,
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
      outputService.selectedChannel = outputService.getChannel(channelName);
    }
  }

  return (
   isElectronRenderer() ?
    <NativeSelect
      value={outputService.selectedChannel ? outputService.selectedChannel.name : NONE}
      onChange={handleChange}
    >{channelOptionElements}</NativeSelect> :
    <Select
      value={outputService.selectedChannel ? outputService.selectedChannel.name : NONE}
      className={styles.select}
      size='small'
      maxHeight={outputService.viewHeight}
      onChange={handleChange}
    >{channelOptionElements}</Select>
  );
});
