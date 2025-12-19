import { contextBridge, ipcRenderer } from 'electron'

const api = {
  onFileAdded: (callback) => ipcRenderer.on('file-added', (_event, value) => callback(value)),
  openFile: (path) => ipcRenderer.invoke('open-file', path),
  getSummary: (path) => ipcRenderer.invoke('summarize-file', path),
  
  // 🆕 [추가] URL 요약 요청
  getUrlSummary: (url) => ipcRenderer.invoke('crawl-summary', url)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.api = api
}