import TypeScriptServiceClientHost from '../typeScriptServiceClientHost';
import { Command } from '../utils/commandManager';
import { Lazy } from '../utils/lazy';

export class UpdateCompilerOptionsCommand implements Command {
  public readonly id = 'typescript.updateCompilerOptionsCommand';

  public constructor(
    private readonly lazyClientHost: Lazy<TypeScriptServiceClientHost>
  ) { }

  public execute(extraCompilerOptions = {}) {
    this.lazyClientHost.value.serviceClient.setCompilerOptionsForInferredProjects(
      this.lazyClientHost.value.serviceClient.configuration,
      extraCompilerOptions,
    );
  }
}
