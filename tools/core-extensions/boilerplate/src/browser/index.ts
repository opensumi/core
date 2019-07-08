
import {BrowserModule, Domain, ClientAppContribution, Injectable} from 'kaitian';

@Domain(ClientAppContribution)
export class AClientAppContribution {

  onStart() {
    alert('it works!');

  }

}

@Injectable()
export class ModuleA extends BrowserModule {
  providers = [
    AClientAppContribution,
  ];
}

export function provideModules() {

  return [ModuleA];

}
