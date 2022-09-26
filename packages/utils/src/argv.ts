/* eslint-disable no-console */
import mri, { Argv, Options } from 'mri';

export function parseArgv(argv: string[]) {
  return mri(argv);
}

export function parseString(str: string) {
  return mri(str.split(''));
}

export class ArgvFactory {
  constructor(private factoryArgv: string[]) {}

  private _argv: Argv | undefined;
  get argv() {
    if (!this._argv) {
      const options = {
        string: this._string,
      } as Options;
      this._argv = mri(this.factoryArgv, options);
    }

    if (this._argv?.help) {
      this.showUsage();
      process.exit(0);
    }
    return this._argv;
  }
  private _usage: string | undefined;
  usage(message: string) {
    this._usage = message;
    return this;
  }
  private showUsage() {
    if (this._usage) {
      console.log(this._usage.trimLeft());
      if (this.afterUsage) {
        console.log('Usage:');
        console.log('    ' + this.afterUsage);
      }
    }
  }
  private _string = [] as string[];
  string(k: string) {
    this._string.push(k);
    return this;
  }
  private afterUsage: string | undefined;
  help() {
    this.afterUsage = '--help Show help';
    return this;
  }
}
