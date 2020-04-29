import * as React from 'react';
import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable, localize, CommandService, EDITOR_COMMANDS, isElectronRenderer, ViewState } from '@ali/ide-core-browser';
import { Select, Option } from '@ali/ide-components';
import { Select as NativeSelect } from '@ali/ide-core-browser/lib/components/select';
import { FixedSizeList, areEqual, ListChildComponentProps } from 'react-window';

import { OutputService } from './output.service';
import Ansi from '../common/ansi';

import * as styles from './output.module.less';

interface IOutputItem {
  line: string;
  id: string;
  onPath: (path: string) => void;
}

const OutputItem: React.FC<ListChildComponentProps> = React.memo(({ data, index, style }) => {
  const { line, onPath } = (data as IOutputItem)[index];
  return <div style={style} className={styles.outputItem}>
    <Ansi linkify onPath={onPath}>{line}</Ansi>
  </div>;
}, areEqual);

export const Output = observer(({ viewState }: { viewState: ViewState }) => {
  const outputService = useInjectable<OutputService>(OutputService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [rawLines, setRawLines] = React.useState(outputService.getChannels()[0]?.getLines() || []);

  const listRef = React.createRef<FixedSizeList>();

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

  const data = React.useMemo(() => {
    const result: IOutputItem[] = [];

    if (!Array.isArray(rawLines) || !rawLines.length) {
      result.push({ line: localize('output.channel.none', '还没有任何输出'), id: '-1', onPath: Function.prototype as any });
      return result;
    }

    const onPath = (path) => {
      commandService.executeCommand(EDITOR_COMMANDS.OPEN_RESOURCE.id, path, { disableNavigate: false, preview: false });
    };
    rawLines.forEach((text, i) => {
      const lines = text.split(/[\n\r]+/);
      lines.forEach((line, idx) => {
        if (line) {
          result.push({ line, id: i + '' + idx, onPath });
        }
      });
    });

    if (result.length === 0) {
      result.push({ line: localize('output.channel.none', '还没有任何输出'), id: '-1', onPath });
    }
    return result;
  }, [ rawLines ]);

  React.useEffect(() => {
    if (listRef && listRef.current) {
      // 自动吸底
      listRef.current.scrollTo(data.length * 20);
    }
  }, [data.length]);

  return (
    <div className={styles.output} style={{paddingTop: 10}}>
      <FixedSizeList
        ref={listRef}
        height={viewState.height - 10 /* 减去 padding-top */}
        width={viewState.width}
        itemSize={20}
        itemCount={data.length}
        itemData={data}>
        {OutputItem}
      </FixedSizeList>
    </div>
  );
});

Output.displayName = 'Output';

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
