export class Definition {
  private variable1: string = '';
  constructor() {}

  public setVariable1(s: string): void {
    this.variable1 = s;
  }

  public getVariable1(): string {
    return this.variable1;
  }
}
