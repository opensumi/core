import { Autowired, Injectable } from '@opensumi/di';
import {
  CancellationToken,
  ProblemFixRegistryToken,
  RenameCandidatesProviderRegistryToken,
} from '@opensumi/ide-core-common';
import { IRange, ITextModel, NewSymbolName } from '@opensumi/ide-monaco';

import { IProblemFixProviderRegistry, IRenameCandidatesProviderRegistry } from '../../types';

@Injectable()
export class ProblemFixService {
  @Autowired(ProblemFixRegistryToken)
  private readonly problemFixProviderRegistry: IProblemFixProviderRegistry;

  async provideProblemFix(model: ITextModel, range: IRange, token: CancellationToken) {}
}
