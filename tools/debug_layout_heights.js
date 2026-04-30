const { app, BrowserWindow } = require('electron');
const path = require('path');
function sleep(ms){return new Promise(r=>setTimeout(r,ms);}
async function run(){
 const win=new BrowserWindow({width:1920,height:1080,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:false}});
 await win.loadFile(path.join(__dirname,'..','index.html'));
 await sleep(600);
 await win.webContents.executeJavaScript(`(() => {
   localStorage.setItem('botc.solo.settings.v1', JSON.stringify({resolution:'auto',uiScale:100,masterVolume:100,sfxVolume:100}));
   localStorage.setItem('botc.ui.sidebar.v2', JSON.stringify({leftCollapsed:true,rightCollapsed:true,bottomCollapsed:true,leftDensity:'compact'}));
 })();`);
 await win.reload();
 await sleep(700);
 await win.webContents.executeJavaScript(`(() => {
   document.getElementById('startScriptSelect').value='tb';
   document.getElementById('startPlayerCount').value='9';
   document.getElementById('btnStartFromMenu').click();
 })();`);
 await sleep(1800);
 await win.webContents.executeJavaScript(`(() => {
   const skip = document.getElementById('btnSkipNightActionModal');
   if (skip && skip.offsetParent !== null) skip.click();
 })();`);
 await sleep(800);
 const info = await win.webContents.executeJavaScript(`(() => {
   const el = (id) => document.getElementById(id)?.getBoundingClientRect();
   const hud = document.querySelector('.hud-panel')?.getBoundingClientRect();
   const center = document.querySelector('.center-column')?.getBoundingClientRect();
   const wrap = el('boardWrap');
   const board = el('grimoireBoard');
   const shell = document.getElementById('appShell')?.getBoundingClientRect();
   return {
    shell: shell ? {w:Math.round(shell.width),h:Math.round(shell.height)}:null,
    hud: hud ? {w:Math.round(hud.width),h:Math.round(hud.height)}:null,
    center:center ? {w:Math.round(center.width),h:Math.round(center.height)}:null,
    wrap: wrap ? {w:Math.round(wrap.width),h:Math.round(wrap.height)}:null,
    board: board ? {w:Math.round(board.width),h:Math.round(board.height)}:null
   };
 })();`);
 console.log(JSON.stringify(info,null,2));
 await win.close();
}
app.whenReady().then(async()=>{try{await run();app.quit();}catch(e){console.error(e);app.quit();process.exit(1);}});
