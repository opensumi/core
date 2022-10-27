import { Definition } from './definition';

export class Reference {
  private def: Definition = new Definition();

  constructor() {
    this.def.setVariable1('6');
  }
}
