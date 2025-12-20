import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import chokidar from 'chokidar' // 파일 감시
import fs from 'fs' // 파일 시스템
import mammoth from 'mammoth' // 워드 파일 읽기

// 크롤링 및 요약 라이브러리
import axios from 'axios'
import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'

// 바탕화면의 my-docs 폴더 경로 설정
const watchPath = join(app.getPath('desktop'), 'my-docs')

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200, // 넉넉한 가로 사이즈
    height: 800,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
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

  // --- [기능 구현: 파일 감시] ---
  // 창(Window)과 직접 연관된 기능은 여기에 둡니다.

  // 1. 폴더가 없으면 생성
  if (!fs.existsSync(watchPath)) {
    fs.mkdirSync(watchPath);
  }

  // 2. 창이 켜지면 감시 시작
  mainWindow.on('ready-to-show', () => {
    mainWindow.show();
    const watcher = chokidar.watch(watchPath, { ignored: /^\./, persistent: true });
    
    // 파일 추가 감지 시 화면으로 알림
    watcher.on('add', (filePath) => {
      // 창이 닫혀있지 않을 때만 전송
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('file-added', filePath);
      }
    });
  });
}

// 🔴 [수정됨] 앱이 준비되었을 때 기능 등록 (createWindow 밖으로 뺌)
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => optimizer.watchWindowShortcuts(window))

  // --- [기능 등록: 핸들러들은 여기서 딱 한 번만 등록] ---

  // 3. 파일 열기 요청 처리
  ipcMain.handle('open-file', async (event, path) => {
    await shell.openPath(path); 
  });

  // 4. 로컬 파일(word, txt) 요약 핸들러
  ipcMain.handle('summarize-file', async (event, filePath) => {
    try {
      const ext = filePath.split('.').pop().toLowerCase();
      let rawText = "";

      if (ext === 'docx') {
        const result = await mammoth.extractRawText({ path: filePath });
        rawText = result.value;
      } else if (ext === 'txt' || ext === 'md') {
        rawText = fs.readFileSync(filePath, 'utf-8');
      } else {
        return "미리보기를 지원하지 않는 파일입니다.";
      }

      const cleanText = rawText.replace(/\s+/g, ' ').trim();
      if (cleanText.length < 200) return cleanText;

      const sentences = cleanText.split(/[.?!]\s+/);
      const wordCount = {};
      cleanText.split(/\s+/).forEach(w => { if(w.length > 1) wordCount[w] = (wordCount[w] || 0) + 1 });

      const scored = sentences.map(s => {
        let score = 0;
        s.split(/\s+/).forEach(w => score += (wordCount[w] || 0));
        return { text: s, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const summary = scored.slice(0, 3).map(s => s.text).join('. ') + ".";
      
      return "💡 파일 요약: " + summary;

    } catch (error) {
      console.error(error);
      return "파일을 읽을 수 없습니다.";
    }
  });

  // 5. 스마트 URL 요약 핸들러
  ipcMain.handle('crawl-summary', async (event, url) => {
    try {
      console.log(`🌐 스마트 요약 시도: ${url}`);
      
      const { data } = await axios.get(url, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36' 
        },
        timeout: 3000 
      });

      const dom = new JSDOM(data, { url });
      const document = dom.window.document;

      const metaDesc = 
        document.querySelector('meta[property="og:description"]')?.content ||
        document.querySelector('meta[name="description"]')?.content ||
        document.querySelector('meta[name="twitter:description"]')?.content;

      if (metaDesc && metaDesc.length > 10) {
        return `📌 [핵심 요약]\n${metaDesc}`;
      }

      const reader = new Readability(document);
      const article = reader.parse();

      if (!article || !article.textContent) {
        return "본문 내용을 파악할 수 없는 페이지입니다 (이미지 위주 등).";
      }

      const cleanText = article.textContent
        .replace(/[\r\n]+/g, ' ') 
        .replace(/\s+/g, ' ')
        .trim();

      const sentences = cleanText.split(/(?<=[.?!])\s+/);

      const meaningfulSentences = sentences.filter(s => {
        return s.length > 20 && 
               !s.includes("로그인") && 
               !s.includes("회원가입") &&
               !s.includes("Menu") &&
               !s.includes("Skip to");
      });

      if (meaningfulSentences.length === 0) {
        return "요약할 만한 텍스트가 없습니다.";
      }

      const introSummary = meaningfulSentences.slice(0, 3).join(' ');

      const finalSummary = introSummary.length > 150 
        ? introSummary.substring(0, 150) + "..." 
        : introSummary;

      return `📄 [본문 서론]\n${finalSummary}`;

    } catch (error) {
      console.error(error);
      return "접속할 수 없거나 보안이 설정된 사이트입니다.";
    }
  });

  // 창 생성
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})