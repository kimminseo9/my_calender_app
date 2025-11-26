import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import chokidar from 'chokidar' // 감시 카메라
import fs from 'fs' // 파일 시스템 도구
import mammoth from 'mammoth';

// 1. 감시할 폴더 경로 설정 (바탕화면의 my-docs 폴더)
const watchPath = join(app.getPath('desktop'), 'my-docs')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
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

  ipcMain.handle('summarize-file', async (event, filePath) => {
    try {
      console.log(`📝 정밀 요약 시도: ${filePath}`);
      
      const ext = filePath.split('.').pop().toLowerCase();
      let rawText = "";

      // 1. 파일 읽기
      if (ext === 'docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        rawText = result.value;
      } else if (ext === 'txt' || ext === 'md') {
        rawText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return "미리보기를 지원하지 않는 파일입니다.";
      }

      // 2. 텍스트 전처리 (공백 정리)
      const cleanText = rawText.replace(/\s+/g, ' ').trim();
      if (cleanText.length < 200) return cleanText; // 너무 짧으면 그냥 다 보여줌

      // 3. [알고리즘] 간단한 핵심 문장 추출기
      // 문장 단위로 쪼개기
      const sentences = cleanText.split(/[.?!]\s+/);
      
      // 단어 빈도수 계산 (자주 나오는 단어가 핵심 키워드일 확률이 높음)
      const wordCount = {};
      const words = cleanText.split(/\s+/);
      words.forEach(word => {
        if (word.length > 1) { // 한 글자 단어는 무시
          wordCount[word] = (wordCount[word] || 0) + 1;
        }
      });

      // 문장 점수 매기기 (핵심 단어가 많이 포함된 문장이 높은 점수)
      const scoredSentences = sentences.map(sentence => {
        let score = 0;
        const sentenceWords = sentence.split(/\s+/);
        sentenceWords.forEach(word => {
          if (wordCount[word]) score += wordCount[word];
        });
        return { text: sentence, score: score };
      });

      // 점수 높은 순으로 정렬해서 상위 3개 문장만 뽑기
      scoredSentences.sort((a, b) => b.score - a.score);
      const topSentences = scoredSentences.slice(0, 3).map(s => s.text);

      // 문장 합치기
      const summary = topSentences.join('. ') + ".";
      
      return "💡 자동 요약: " + summary;

    } catch (error) {
      console.error(error);
      return "내용을 읽을 수 없습니다.";
    }
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