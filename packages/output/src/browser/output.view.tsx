import * as React from 'react';
import { observer } from 'mobx-react-lite';
import * as styles from './output.module.less';
import { OutputChannel } from '../common/output.channel';
import { useInjectable } from '@ali/ide-core-browser';
import { OutputService } from './output.service';

export const Output = observer(() => {
  const NONE = '<no channels>';

  const outputService = useInjectable<OutputService>(OutputService);

  const [selectedChannel, setSelectedChanel] = React.useState(outputService.getChannels()[0]);

  const getVisibleChannels = (): OutputChannel[] => {
    return outputService.getChannels().filter((channel) => channel.isVisible);
  };

  const renderChannelSelector = () => {
    const channelOptionElements: React.ReactNode[] = [];
    getVisibleChannels().forEach((channel) => {
        channelOptionElements.push(<option value={channel.name} key={channel.name}>{channel.name}</option>);
    });
    if (channelOptionElements.length === 0) {
        channelOptionElements.push(<option key={NONE} value={NONE}>{NONE}</option>);
    }
    return <select
        id={'CHANNEL_LIST'}
        value={selectedChannel ? selectedChannel.name : NONE}
        onChange={
            async (event) => {
                const channelName = (event.target as HTMLSelectElement).value;
                if (channelName !== NONE) {
                    setSelectedChanel(outputService.getChannel(channelName));
                }
            }
        }>
        {channelOptionElements}
    </select>;

  };
  const clear = () => {
    selectedChannel.clear();
  };
  const renderClearButton = () => {
    return <span title='Clear'
        className={selectedChannel ? 'enabled' : ''}
        id={'CLEAR_BUTTON'} onClick={() => clear()} />;

  };
  const renderLines = (): React.ReactNode[] => {

    let id = 0;
    const result: React.ReactNode[] = [];

    const style: React.CSSProperties = {
        whiteSpace: 'pre',
        fontFamily: 'monospace',
    };

    if (selectedChannel) {
        for (const text of selectedChannel.getLines()) {
            const lines = text.split(/[\n\r]+/);
            for (const line of lines) {
                result.push(<div style={style} key={id++}>{line}</div>);
            }
        }
    }
    if (result.length === 0) {
        result.push(<div style={style} key={id++}>{'<no output yet>'}</div>);
    }
    return result;
  };
  const renderChannelContents = () => {
    return <div id={'lines'}>{renderLines()}</div>;
  };

  return <React.Fragment>
      <div id={'output'}>
          {renderChannelSelector()}
          {renderClearButton()}
      </div>
      {renderChannelContents()}
  </React.Fragment>;
});
