const { app, BrowserWindow } = require('electron');
const path = require('path');

// Enable flags for local file access and html2canvas canvas rendering in Electron
app.commandLine.appendSwitch('allow-file-access-from-files');
app.commandLine.appendSwitch('disable-web-security');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false, // Disables local file CORS/origin restrictions on file:// for html2canvas and local stylesheets
      allowRunningInsecureContent: true
    }
  });

  // تحميل ناتج بناء مشروع Vite
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
