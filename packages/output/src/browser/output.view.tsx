import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { OutputChannel } from './output.channel';
import { useInjectable, localize } from '@ali/ide-core-browser';
import { OutputService } from './output.service';
import * as cls from 'classnames';
import * as styles from './output.module.less';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import Ansi from 'ansi-to-react';

export const Output = observer(() => {
  const outputService = useInjectable<OutputService>(OutputService);

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
                result.push(<div style={style} key={id++}><Ansi>{line}</Ansi></div>);
            }
        }
    } else {
      setTimeout(() => {
        outputService.selectedChannel = outputService.getChannels()[0];
      });
    }
    if (result.length === 0) {
        result.push(<div style={style} key={id++}>{localize('output.channel.none', '还没有任何输出')}</div>);
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
      {renderChannelContents()}
    </div>
  </React.Fragment>;
});

export const ChannelSelector = observer(() => {
  const NONE = '<no channels>';

  const outputService = useInjectable<OutputService>(OutputService);
  const channelOptionElements: React.ReactNode[] = [];
  outputService.getChannels().forEach((channel) => {
      channelOptionElements.push(<option value={channel.name} key={channel.name}>{channel.name}</option>);
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
