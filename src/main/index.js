import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import chokidar from 'chokidar' // 감시 카메라
import fs from 'fs' // 파일 시스템 도구

// 1. 감시할 폴더 경로 설정 (바탕화면의 my-docs 폴더)
const watchPath = join(app.getPath('desktop'), 'my-docs')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // --- [여기서부터 감시 기능 시작] ---

  // 2. 폴더가 없으면 자동으로 만들기
  if (!fs.existsSync(watchPath)) {
    fs.mkdirSync(watchPath);
    console.log(`[알림] 바탕화면에 폴더를 생성했습니다: ${watchPath}`);
  }

  // 3. 창이 다 준비되면(ready-to-show) 감시 시작!
  mainWindow.on('ready-to-show', () => {
    mainWindow.show(); // 창 보여주기

    // 감시자(watcher) 생성
    const watcher = chokidar.watch(watchPath, {
      ignored: /^\./,
      persistent: true
    });

    // 4. 파일이 추가되면 실행되는 코드 (이게 watcher가 살아있는 이 함수 안에 있어야 합니다!)
    watcher.on('add', (filePath) => {
      console.log(`✨ 새 파일 발견!: ${filePath}`);
      // 화면(React)으로 신호 보내기
      mainWindow.webContents.send('file-added', filePath);
    });
    
    console.log("👀 폴더 감시가 시작되었습니다!");
  });

  // 5. 파일 열기 요청 처리 (이건 밖에서도 괜찮습니다)
  ipcMain.handle('open-file', async (event, path) => {
    console.log(`📂 파일 열기 시도: ${path}`);
    await shell.openPath(path); 
  });

}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})