import { Injectable } from '@opensumi/di';
import { CancellationToken, Disposable } from '@opensumi/ide-core-common';
import { IReadableStream, isReadableStream, listenGroupReadable, listenReadable } from '@opensumi/ide-utils/lib/stream';

import { ITerminalCommandSuggestionDesc } from '../../../common/index';
import {
  ITerminalProviderRegistry,
  TTerminalCommandSuggestionsProviderFn,
  TerminalSuggestionReadableStream,
} from '../../types';

@Injectable()
export class TerminalFeatureRegistry extends Disposable implements ITerminalProviderRegistry {
  private readonly providerMap = new Set<TTerminalCommandSuggestionsProviderFn>();

  public hasProvider(): boolean {
    return this.providerMap.size > 0;
  }

  registerCommandSuggestionsProvider(provider: TTerminalCommandSuggestionsProviderFn): void {
    this.providerMap.add(provider);
  }

  async readableCommandSuggestions(
    message: string,
    token: CancellationToken,
  ): Promise<TerminalSuggestionReadableStream> {
    const providers = Array.from(this.providerMap);
    const collectStream: IReadableStream<ITerminalCommandSuggestionDesc>[] = [];
    const collectDesc: ITerminalCommandSuggestionDesc[] = [];

    for await (const provider of providers) {
      const result = await provider(message, token);

      if (isReadableStream(result)) {
        collectStream.push(result);
        continue;
      }

      collectDesc.push(...(result as ITerminalCommandSuggestionDesc[]));
    }

    const terminalReadableStream = TerminalSuggestionReadableStream.create();

    collectDesc.forEach(terminalReadableStream.emitData.bind(terminalReadableStream));

    // 如果没有 stream 的 provider，则直接结束
    if (collectStream.length === 0) {
      queueMicrotask(() => {
        terminalReadableStream.end();
      });
    } else {
      listenGroupReadable(collectStream, {
        onData: terminalReadableStream.emitData.bind(terminalReadableStream),
        onEnd: terminalReadableStream.end.bind(terminalReadableStream),
      });
    }

    return terminalReadableStream;
  }
}
