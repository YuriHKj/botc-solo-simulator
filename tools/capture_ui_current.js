const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'verification');
const outStart = path.join(outDir, 'ui-current-start.png');
const outGame = path.join(outDir, 'ui-current-ingame.png');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function capture() {
  fs.mkdirSync(outDir, { recursive: true });

  const win = new BrowserWindow({
    width: 1920,
    height: 1080,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  await win.loadFile(path.join(__dirname, '..', 'index.html'));
  await sleep(1200);

  const startShot = await win.webContents.capturePage();
  fs.writeFileSync(outStart, startShot.toPNG());

  await win.webContents.executeJavaScript(`(() => {
    const script = document.getElementById('startScriptSelect');
    const count = document.getElementById('startPlayerCount');
    const start = document.getElementById('btnStartFromMenu');
    if (script) script.value = 'tb';
    if (count) count.value = '9';
    start?.click();
  })();`);

  await sleep(1500);

  await win.webContents.executeJavaScript(`(() => {
    const modal = document.getElementById('nightActionModal');
    if (modal?.classList.contains('show')) {
      document.getElementById('btnSkipNightActionModal')?.click();
    }
  })();`);

  await sleep(1200);

  const gameShot = await win.webContents.capturePage();
  fs.writeFileSync(outGame, gameShot.toPNG());

  await win.close();
}

app.whenReady().then(async () => {
  try {
    await capture();
    app.quit();
  } catch (err) {
    console.error(err);
    app.quit();
    process.exit(1);
  }
});
