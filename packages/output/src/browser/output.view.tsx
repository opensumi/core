import * as React from 'react';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandService, EDITOR_COMMANDS } from '@ali/ide-core-browser';
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

export const Output = observer(() => {
  const outputService = useInjectable<OutputService>(OutputService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [rawLines, setRawLines] = React.useState(outputService.getChannels()[0]?.getLines() || []);

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
      channelOptionElements.push(<option value={channel.name} key={`${idx} - ${channel.name}`}>{channel.name}</option>);
  });
  if (channelOptionElements.length === 0) {
      channelOptionElements.push(<option key={NONE} value={NONE}>{NONE}</option>);
  }
  return <select
  className={styles.select}
      value={outputService.selectedChannel ? outputService.selectedChannel.name : NONE}
      onChange={
          async (event) => {
              const channelName = (event.target as HTMLSelectElement).value;
              if (channelName !== NONE) {
                outputService.selectedChannel = outputService.getChannel(channelName);
              }
          }
      }>
      {channelOptionElements}
  </select>;
});
