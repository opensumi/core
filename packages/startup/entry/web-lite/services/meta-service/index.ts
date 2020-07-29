import { IMetaService } from './base';

export class MetaService implements IMetaService {
  private _projectId: string;
  private _group: string;
  private _name: string;
  private _ref: string;

  constructor(props: IMetaService) {
    this._projectId = props.projectId;
    this._group = props.group;
    this._name = props.name;
    this._ref = props.ref;
  }

  get projectId() {
    return this._projectId;
  }

  get group() {
    return this._group;
  }

  get name() {
    return this._name;
  }

  get repo() {
    return this._group + '/' + this._name;
  }

  get ref() {
    return this._ref;
  }
}
