
import {BrowserModule, Domain, ClientAppContribution, Injectable} from 'kaitian';

@Domain(ClientAppContribution)
export class AClientAppContribution {

  onStart() {
    console.log('it works!');
  }

}

export function getProviders() {

  return [AClientAppContribution];

}
