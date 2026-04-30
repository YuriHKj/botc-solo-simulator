const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '..', 'docs', 'verification');
const outNormal = path.join(outDir, 'ui-current-ingame-normal.png');
const outFull = path.join(outDir, 'ui-current-ingame-grimoire.png');

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
  await sleep(800);

  await win.webContents.executeJavaScript(`(() => {
    localStorage.setItem('botc.solo.settings.v1', JSON.stringify({resolution:'auto',uiScale:100,masterVolume:100,sfxVolume:100}));
    localStorage.setItem('botc.ui.sidebar.v2', JSON.stringify({leftCollapsed:false,rightCollapsed:false,bottomCollapsed:true,leftDensity:'compact'}));
  })();`);

  await win.reload();
  await sleep(1000);

  await win.webContents.executeJavaScript(`(() => {
    const script = document.getElementById('startScriptSelect');
    const count = document.getElementById('startPlayerCount');
    const role = document.getElementById('startRoleSelect');
    const start = document.getElementById('btnStartFromMenu');
    if (script) script.value = 'tb';
    if (count) count.value = '9';
    if (role) role.value = '';
    start?.click();
  })();`);

  await sleep(2200);

  await win.webContents.executeJavaScript(`(() => {
    const skip = document.getElementById('btnSkipNightActionModal');
    if (skip && skip.offsetParent !== null) skip.click();
  })();`);

  await sleep(1200);

  const normal = await win.webContents.capturePage();
  fs.writeFileSync(outNormal, normal.toPNG());

  await win.webContents.executeJavaScript(`(() => {
    const toggle = document.getElementById('toggleGrimoire');
    if (toggle && !toggle.checked) {
      toggle.checked = true;
      toggle.dispatchEvent(new Event('change', { bubbles: true }));
    }
  })();`);

  await sleep(500);

  const full = await win.webContents.capturePage();
  fs.writeFileSync(outFull, full.toPNG());

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
