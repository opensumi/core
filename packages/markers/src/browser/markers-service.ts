'use strict';

import { Injectable, Autowired } from '@ali/common-di';

@Injectable()
export class MarkersService {

  public addMarkers() {
    console.error('------------> addMarkers');
  }

  public clearAllMarkers() {
    console.error('------------> clearAllMarkers');
  }

}
