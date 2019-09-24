import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { OutputChannel } from './output.channel';
import { useInjectable } from '@ali/ide-core-browser';
import { OutputService } from './output.service';
import * as cls from 'classnames';
import * as styles from './output.module.less';

export const Output = observer(() => {
  const NONE = '<no channels>';

  const outputService = useInjectable<OutputService>(OutputService);

  const renderChannelSelector = () => {
    const channelOptionElements: React.ReactNode[] = [];
    outputService.getChannels().forEach((channel) => {
        channelOptionElements.push(<option value={channel.name} key={channel.name}>{channel.name}</option>);
    });
    if (channelOptionElements.length === 0) {
        channelOptionElements.push(<option key={NONE} value={NONE}>{NONE}</option>);
    }
    return <select
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

  };
  const clear = () => {
    outputService.selectedChannel.clear();
  };
  const renderClearButton = () => {
    return <span title='Clear'
        className={outputService.selectedChannel ? cls(styles.enabled, styles.clear, 'volans_icon cache_clean') : cls(styles.enabled, styles.clear, 'volans_icon cache_clean')}
        onClick={() => clear()} />;

  };
  const renderLines = (): React.ReactNode[] => {

    let id = 0;
    const result: React.ReactNode[] = [];

    const style: React.CSSProperties = {
        whiteSpace: 'normal',
        fontFamily: 'monospace',
    };

    if (outputService.selectedChannel) {
        for (const text of outputService.selectedChannel.getLines) {
            const lines = text.split(/[\n\r]+/);
            for (const line of lines) {
                result.push(<div style={style} key={id++}>{line}</div>);
            }
        }
    } else {
      setTimeout(() => {
        outputService.selectedChannel = outputService.getChannels()[0];
      });
    }
    if (result.length === 0) {
        result.push(<div style={style} key={id++}>{'<no output yet>'}</div>);
    }
    return result;
  };
  const renderChannelContents = () => {
    return <div ref={(el) => {
        if (el) {
          setTimeout(() => {
            el.scrollTop = el.scrollHeight;
          });
        }
      }}
      className={styles.content}
      key={outputService.keys + outputService.getChannels().map((c) => c.name).join('-')}>
        {renderLines()}
     </div>;
  };

  return <React.Fragment>
    <div className={styles.output}>
      <div className={styles.overlay}>
          {renderChannelSelector()}
          {renderClearButton()}
      </div>
      {renderChannelContents()}
    </div>
  </React.Fragment>;
});
