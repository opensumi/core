export interface ISerializer<FROM, TO> {
  serialize(data: FROM): TO;
  deserialize(data: TO): FROM;
}
