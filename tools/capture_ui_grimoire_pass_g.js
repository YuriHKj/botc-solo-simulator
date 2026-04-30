const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'verification');
const outFile = path.join(outDir, 'ui-grimoire-pass-g.png');

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function run(){
  fs.mkdirSync(outDir, { recursive: true });
  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: false }
  });

  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await sleep(700);

  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('botc.solo.settings.v1', JSON.stringify({resolution:'auto',uiScale:100,masterVolume:100,sfxVolume:100}));
    localStorage.setItem('botc.ui.sidebar.v2', JSON.stringify({leftCollapsed:true,rightCollapsed:true,bottomCollapsed:true,leftDensity:'compact'}));
  })();`);

  await win.reload();
  await sleep(900);

  await win.webContents.executeJavaScript(`(() => {
    const script = document.getElementById('startScriptSelect');
    const count = document.getElementById('startPlayerCount');
    const start = document.getElementById('btnStartFromMenu');
    if (script) script.value = 'tb';
    if (count) count.value = '9';
    start?.click();
  })();`);

  await sleep(2200);

  await win.webContents.executeJavaScript(`(() => {
    const closeModal = () => {
      const modal = document.getElementById('nightActionModal');
      if (!modal || !modal.classList.contains('show')) return;
      document.getElementById('btnSkipNightActionModal')?.click();
      document.getElementById('btnCloseNightActionModal')?.click();
    };
    closeModal();
    setTimeout(closeModal, 180);
    setTimeout(closeModal, 420);
  })();`);

  await sleep(900);

  const shot = await win.webContents.capturePage();
  fs.writeFileSync(outFile, shot.toPNG());

  const metrics = await win.webContents.executeJavaScript(`(() => {
    const wrap = document.getElementById('boardWrap')?.getBoundingClientRect();
    const board = document.getElementById('grimoireBoard')?.getBoundingClientRect();
    const token = document.querySelector('.player-token')?.getBoundingClientRect();
    return {
      wrap: wrap ? {w: Math.round(wrap.width), h: Math.round(wrap.height)} : null,
      board: board ? {w: Math.round(board.width), h: Math.round(board.height)} : null,
      token: token ? {w: Math.round(token.width), h: Math.round(token.height)} : null,
      tokenCount: document.querySelectorAll('.player-token').length,
      modalOpen: document.getElementById('nightActionModal')?.classList.contains('show') || false,
      shellClass: document.getElementById('appShell')?.className || ''
    };
  })();`);
  console.log(JSON.stringify(metrics, null, 2));

  await win.close();
}

app.whenReady().then(async () => {
  try {
    await run();
    app.quit();
  } catch (e) {
    console.error(e);
    app.quit();
    process.exit(1);
  }
});
