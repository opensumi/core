import { Injectable, Provider } from '@ali/common-di';
import { FileSystemEditorContribution } from './file-scheme.contribution';
import { BrowserModule, EffectDomain } from '@ali/ide-core-browser';

const pkgJson = require('../../package.json');
@EffectDomain(pkgJson.name)
export class FileSchemeModule extends BrowserModule {
  providers: Provider[] = [
    FileSystemEditorContribution,
  ];
}
