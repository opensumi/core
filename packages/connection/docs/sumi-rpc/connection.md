# Connection

OpenSumi RPC Connection is highly inspired by the [JSON-RPC](https://www.jsonrpc.org/specification) specification, but we use FURY instead of JSON. The protocol is defined in the [packet.md](./packet.md). It is transport agnostic in that the concepts can be used within the same process, over sockets, over http, or in many various message passing environments.

## Why not JSON?

JSON is a great format for many things, but it is not the best format for high performance RPC. The main reason is that JSON is a text-based format, and it is not very efficient to parse and serialize. It is also not very efficient to send over the wire. FURY is a binary format that is much more efficient to parse and serialize, and it is also much more efficient to send over the wire.

## Conventions

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](http://www.ietf.org/rfc/rfc2119.txt).

We use `@furyjs/fury` as our protocol format, `@furyjs/fury` is a high performance protocol buffers implementation, it is much faster than `protobuf.js` and `JSON`.

And also we use the `BinaryReader` and `BinaryWriter` from `@furyjs/fury` to operate the binary data.

`@furyjs/fury` support many types, such as Object, Array, String, Number, Boolean, Null, Undefined, Date, Buffer, Map, Set, and so on.

All member names exchanged between the Client and the Server that are considered for matching of any kind should be considered to be case-sensitive. The terms function, method, and procedure can be assumed to be interchangeable.

The Client is defined as the origin of Request packets and the handler of Response packets. The Server is defined as the origin of Response packets and the handler of Request packets.

## Packets

The Request/Response Packet is binary format, you can see the [packet.md](./packet.md) for more details.

### Request

#### Notification

#### Cancel

### Response

#### Error
