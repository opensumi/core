// /* tslint:disable */

// import {WebSocketServerRoute} from '../src/node/ws';
// import * as http from 'http';
// import {ChannelHandler} from '../src/node/channel-handler';
// import {RPCStub} from '../src/node/stub';
// import {RPCService} from '../src/common/proxy'
// import {StubClient} from '../src/browser/stub-client'
// import * as ws from 'ws'
// const WebSocket = ws

// class FileService extends RPCService{
//   getContent(filePath){
//     return `file content ${filePath}`
//   }
// }
// const testFileService = new FileService()

// class NodeEditorService extends RPCService{
//   getNodeModel(uri){
//     return `node model ${uri}`
//   }
// }
// const nodeEditorService = new NodeEditorService()

// ;(async ()=>{
//   // server
//   const server = http.createServer()
//   const socketRoute = new WebSocketServerRoute(server)

//   const rpcStub = new RPCStub()
//   const channelHandler = new ChannelHandler('/service', rpcStub)

//   socketRoute.registerHandler(channelHandler)
//   socketRoute.init()
//   server.listen(9099, ()=>{
//     console.log(`server listen on 9099`)
//   })

//   rpcStub.registerStubService('FileService', testFileService)
//   rpcStub.registerStubService('NodeEditorService', nodeEditorService)

//   console.log('getClientService', 'EditorService')
//   const editorService = await rpcStub.getClientService('EditorService', nodeEditorService)
//   const editorResult = await editorService.syncModel('index.ts', '/~/index.ts', {line1: 'line1 content'})
//   console.log('editorResult', editorResult)

//   setTimeout(()=>{
//     testFileService.rpcClient && testFileService.rpcClient.forEach((proxy)=>{
//       proxy.createProxy().expand('index.less').then(((result)=>{
//         console.log('FileService client service result', result)
//       }))
//     })
//   }, 4000)

// })()

// // browser
// class FileTreeService extends RPCService {
//   expand(path){
//     return `expand ${path}`
//   }
// }
// const fileTreeService = new FileTreeService()

// class EditorService extends RPCService {
//   syncModel(model, path, content){
//     return {
//       model,
//       path,
//       content
//     }
//   }
// }
// const editorService = new EditorService()

// setTimeout(async ()=>{
//   const clientConnection = new WebSocket('ws://127.0.0.1:9099/service')
//   clientConnection.on('open', async ()=>{
//     const stubClient = new StubClient(clientConnection)
//     const fileService = await stubClient.getStubService('FileService', fileTreeService)

//     const fileContent = await fileService.getContent('/foo/bar')
//     console.log('fileContentResult', fileContent)
//     const fileContent2 = await fileService.getContent('/foo/bar2')
//     console.log('fileContentResult2', fileContent2)

//     const nodeEditorService = await stubClient.getStubService('NodeEditorService')
//     const nodeEditorServiceResult = await nodeEditorService.getNodeModel('/service/model')
//     console.log('nodeEditorServiceResult', nodeEditorServiceResult)

//     stubClient.registerSubClientService('EditorService', editorService)

//     setTimeout(()=>{
//       editorService.rpcClient && editorService.rpcClient.forEach((proxy)=>{
//         proxy.createProxy().getNodeModel('/global.less').then(((result)=>{
//           console.log('EditorService client service result', result)
//         }))
//       })
//     }, 5000)
//   })
// }, 3000)
