import { contextBridge, ipcRenderer } from 'electron'

// 화면(React)으로 전달할 기능들 정의
const api = {
  // 1. 파일이 들어왔다는 신호를 받는 함수
  onFileAdded: (callback) => ipcRenderer.on('file-added', (_event, value) => callback(value)),
  
  // 2. 파일을 열어달라고 요청하는 함수
  openFile: (path) => ipcRenderer.invoke('open-file', path)
}

// 세상 밖으로 기능 노출 (React가 window.api 로 쓸 수 있게 함)
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}