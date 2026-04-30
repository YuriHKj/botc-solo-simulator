const { app, BrowserWindow } = require('electron');
const path = require('path');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
async function run(){
  const win = new BrowserWindow({width:1920,height:1080,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:false}});
  await win.loadFile(path.join(__dirname,'..','index.html'));
  await sleep(1000);
  await win.webContents.executeJavaScript(`(() => {
    const script = document.getElementById('startScriptSelect');
    const count = document.getElementById('startPlayerCount');
    const start = document.getElementById('btnStartFromMenu');
    if (script) script.value='tb';
    if (count) count.value='9';
    start?.click();
  })();`);
  await sleep(1400);
  const info = await win.webContents.executeJavaScript(`(() => {
    const tokens = [...document.querySelectorAll('.player-token')];
    const board = document.getElementById('grimoireBoard');
    const wrap = document.getElementById('boardWrap');
    return {
      tokenCount: tokens.length,
      firstTokenStyle: tokens[0] ? getComputedStyle(tokens[0]).cssText : null,
      firstTokenRect: tokens[0] ? tokens[0].getBoundingClientRect().toJSON() : null,
      firstDiscRect: tokens[0]?.querySelector('.token-disc') ? tokens[0].querySelector('.token-disc').getBoundingClientRect().toJSON() : null,
      boardRect: board ? board.getBoundingClientRect().toJSON() : null,
      wrapRect: wrap ? wrap.getBoundingClientRect().toJSON() : null,
      boardHtmlSample: board ? board.innerHTML.slice(0,260) : null,
      bodyClasses: document.body.className,
      appShellClasses: document.getElementById('appShell')?.className || ''
    };
  })();`);
  console.log(JSON.stringify(info,null,2));
  await win.close();
}
app.whenReady().then(async()=>{try{await run(); app.quit();}catch(e){console.error(e); app.quit(); process.exit(1);}});
