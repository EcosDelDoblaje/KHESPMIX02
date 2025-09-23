const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const os = require('os');
const axios = require('axios');
// const Seven = require('node-7z'); // No usado - usar UnRAR.exe directamente

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 650,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    frame: false,
    resizable: true,
    icon: path.join(__dirname, '../assets/icon.ico'),
    show: false
  });

  mainWindow.loadFile('src/index.html');
  
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('minimize-window', () => {
  mainWindow.minimize();
});

ipcMain.handle('close-window', () => {
  mainWindow.close();
});

ipcMain.handle('detect-steam-path', async () => {
  try {
    // Check Steam paths
    const steamPaths = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      path.join(os.homedir(), 'AppData', 'Local', 'Steam')
    ];

    for (const steamPath of steamPaths) {
      if (await fs.pathExists(steamPath)) {
        const khPath = path.join(steamPath, 'steamapps', 'common', 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue');
        if (await fs.pathExists(khPath)) {
          return khPath;
        }
      }
    }

    // Check Epic Games Store paths
    const epicPaths = [
      'C:\\Program Files\\Epic Games\\KINGDOM HEARTS HD 2.8 Final Chapter Prologue',
      'C:\\Program Files (x86)\\Epic Games\\KINGDOM HEARTS HD 2.8 Final Chapter Prologue'
    ];

    for (const epicPath of epicPaths) {
      if (await fs.pathExists(epicPath)) {
        return epicPath;
      }
    }

    // Check registry for Steam installation
    const steamRegistryPath = await new Promise((resolve) => {
      exec('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath', (error, stdout) => {
        if (!error && stdout) {
          const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/);
          if (match) {
            const steamPath = match[1].trim();
            const khPath = path.join(steamPath, 'steamapps', 'common', 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue');
            fs.pathExists(khPath).then(exists => {
              resolve(exists ? khPath : null);
            });
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
    });

    if (steamRegistryPath) {
      return steamRegistryPath;
    }

    // Check registry for Epic Games Store
    return new Promise((resolve) => {
      exec('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Epic Games\\EpicGamesLauncher" /v AppDataPath', (error, stdout) => {
        if (!error && stdout) {
          // Epic Games detection is more complex, for now return null
          // Could be enhanced to parse Epic's manifest files
          resolve(null);
        } else {
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error('Error detecting game path:', error);
    return null;
  }
});

ipcMain.handle('check-startup-mod-status', async () => {
  try {
    // First detect Steam path using the same logic as detect-steam-path
    const steamPaths = [
      'C:\\Program Files (x86)\\Steam',
      'C:\\Program Files\\Steam',
      path.join(os.homedir(), 'AppData', 'Local', 'Steam')
    ];

    let gamePath = null;

    // Check common Steam paths
    for (const steamPath of steamPaths) {
      if (await fs.pathExists(steamPath)) {
        const khPath = path.join(steamPath, 'steamapps', 'common', 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue');
        if (await fs.pathExists(khPath)) {
          gamePath = khPath;
          break;
        }
      }
    }

    // Check Epic Games Store paths if Steam not found
    if (!gamePath) {
      const epicPaths = [
        'C:\\Program Files\\Epic Games\\KINGDOM HEARTS HD 2.8 Final Chapter Prologue',
        'C:\\Program Files (x86)\\Epic Games\\KINGDOM HEARTS HD 2.8 Final Chapter Prologue'
      ];

      for (const epicPath of epicPaths) {
        if (await fs.pathExists(epicPath)) {
          gamePath = epicPath;
          break;
        }
      }
    }

    // If not found, check registry
    if (!gamePath) {
      gamePath = await new Promise((resolve) => {
        exec('reg query "HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Valve\\Steam" /v InstallPath', (error, stdout) => {
          if (!error && stdout) {
            const match = stdout.match(/InstallPath\s+REG_SZ\s+(.+)/);
            if (match) {
              const steamPath = match[1].trim();
              const khPath = path.join(steamPath, 'steamapps', 'common', 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue');
              fs.pathExists(khPath).then(exists => {
                resolve(exists ? khPath : null);
              });
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        });
      });
    }

    if (!gamePath) {
      return { found: false, gamePath: null, modInstalled: false };
    }

    // Check if mods are installed
    const possibleModDirs = [
      path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Paks', '~mods')
    ];
    
    let modInstalled = false;
    let foundModsDir = null;
    let installedMods = {
      dubbing: false,
      dtFile: false,
      copyrightVideo: false
    };
    
    console.log('Checking for mods in multiple possible locations:');
    for (const modsDir of possibleModDirs) {
      console.log('Testing mods directory:', modsDir);
      const dirExists = await fs.pathExists(modsDir);
      console.log('Directory exists:', dirExists);
      
      if (dirExists) {
        foundModsDir = modsDir;
        
        // Check for dubbing mod
        const dubbingModPath = path.join(modsDir, '000_Spanishmod_P.pak');
        const dubbingExists = await fs.pathExists(dubbingModPath);
        console.log('Dubbing mod exists:', dubbingExists);
        
        installedMods.dubbing = dubbingExists;
        
        if (dubbingExists) {
          modInstalled = true;
        }
        
        // Check for dt file
        const dtFilePath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'CriMovie', 'main', 'dt');
        const dtExists = await fs.pathExists(dtFilePath);
        console.log('DT file exists:', dtExists);
        
        // Check for copyright video
        const copyrightVideoPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Movies', 'copyright.mp4');
        const copyrightExists = await fs.pathExists(copyrightVideoPath);
        console.log('Copyright video exists:', copyrightExists);
        
        installedMods.dtFile = dtExists;
        installedMods.copyrightVideo = copyrightExists;
        
        if (dtExists || copyrightExists) {
          modInstalled = true;
        }
        
        break;
      }
    }

    console.log('Startup detection results:', { 
      found: true, 
      gamePath, 
      modInstalled, 
      foundModsDir,
      installedMods,
      testedDirs: possibleModDirs 
    });
    
    return { found: true, gamePath, modInstalled, installedMods };
  } catch (error) {
    console.error('Error checking startup mod status:', error);
    return { found: false, gamePath: null, modInstalled: false };
  }
});

ipcMain.handle('browse-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Selecciona la carpeta de Kingdom Hearts HD 2.8 Final Chapter Prologue'
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('validate-game-path', async (event, gamePath) => {
  try {
    // Check for multiple possible executable locations
    const possibleExePaths = [
      // KH 0.2 executable in Win64 folder
      path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Binaries', 'Win64', 'KINGDOM HEARTS 0.2 Birth by Sleep.exe'),
      // Main launcher executable
      path.join(gamePath, 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue.exe')
    ];
    
    for (const exePath of possibleExePaths) {
      if (await fs.pathExists(exePath)) {
        return true;
      }
    }
    
    return false;
  } catch (error) {
    return false;
  }
});

ipcMain.handle('check-mod-installed', async (event, gamePath) => {
  try {
    const modsPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Paks', '~mods');
    const modFilePath = path.join(modsPath, '000_Spanishmod_P.pak');
    return await fs.pathExists(modFilePath);
  } catch (error) {
    return false;
  }
});

ipcMain.handle('install-dubbing', async (event, gamePath, installOptions = {}) => {
  let tempDir = null;
  let mainModDestPath = null;
  
  try {
    const steps = [
      'Verificando archivos del juego...',
      'Creando directorios necesarios...',
      'Creando copias de seguridad...',
      'Instalando archivo de doblaje...',
      'Descargando cinemáticas...',
      'Instalando cinemáticas...',
      'Instalando vídeo de copyright...',
      'Verificando instalación...',
      'Finalizando instalación...'
    ];

    // Step 1: Verify game files
    mainWindow.webContents.send('installation-progress', {
      step: 1,
      total: steps.length,
      message: steps[0],
      percentage: 20
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check for Kingdom Hearts executables
    const possibleExePaths = [
      path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Binaries', 'Win64', 'KINGDOM HEARTS 0.2 Birth by Sleep.exe'),
      path.join(gamePath, 'KINGDOM HEARTS HD 2.8 Final Chapter Prologue.exe')
    ];
    
    let gameExeFound = false;
    for (const exePath of possibleExePaths) {
      if (await fs.pathExists(exePath)) {
        gameExeFound = true;
        break;
      }
    }
    
    if (!gameExeFound) {
      throw new Error('No se encontró el ejecutable de Kingdom Hearts en la ruta especificada');
    }

    // Step 2: Create necessary directories
    mainWindow.webContents.send('installation-progress', {
      step: 2,
      total: steps.length,
      message: steps[1],
      percentage: 15
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const modsPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Paks', '~mods');
    const criMoviePath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'CriMovie', 'main');
    const moviesPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Movies');
    
    await fs.ensureDir(modsPath);
    await fs.ensureDir(criMoviePath);
    await fs.ensureDir(moviesPath);

    // Step 3: Create backups
    mainWindow.webContents.send('installation-progress', {
      step: 3,
      total: steps.length,
      message: steps[2],
      percentage: 25
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Create backup of dt file if it exists
    const dtFilePath = path.join(criMoviePath, 'dt');
    const dtBackupPath = path.join(criMoviePath, 'dt.backup');
    if (await fs.pathExists(dtFilePath) && !await fs.pathExists(dtBackupPath)) {
      await fs.copy(dtFilePath, dtBackupPath);
      console.log('Created backup of dt file');
    }

    // Create backup of copyright video if it exists
    const copyrightVideoPath = path.join(moviesPath, 'copyright.mp4');
    const copyrightBackupPath = path.join(moviesPath, 'copyright.mp4.backup');
    if (await fs.pathExists(copyrightVideoPath) && !await fs.pathExists(copyrightBackupPath)) {
      await fs.copy(copyrightVideoPath, copyrightBackupPath);
      console.log('Created backup of copyright video');
    }

    // Step 4: Install main dubbing mod
    mainWindow.webContents.send('installation-progress', {
      step: 4,
      total: steps.length,
      message: steps[3],
      percentage: 35
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const mainModPaths = [
      path.join(process.resourcesPath, 'app', 'assets', '000_Spanishmod_P.pak'),
      path.join(process.resourcesPath, 'assets', '000_Spanishmod_P.pak'),
      path.join(__dirname, '..', 'assets', '000_Spanishmod_P.pak'),
      path.join(process.cwd(), 'assets', '000_Spanishmod_P.pak')
    ];
    
    console.log('Searching for main dubbing mod in the following locations:');
    let mainModPath = null;
    for (const modPath of mainModPaths) {
      console.log('Checking:', modPath);
      if (await fs.pathExists(modPath)) {
        mainModPath = modPath;
        console.log('Found main mod file at:', mainModPath);
        break;
      }
    }
    
    if (!mainModPath) {
      throw new Error('No se encontró el archivo principal del mod de doblaje');
    }
    
    // Set file permissions (Windows)
    try {
      await fs.chmod(mainModPath, 0o755);
      console.log('Main mod file permissions set successfully');
    } catch (permError) {
      console.warn('Could not set file permissions:', permError.message);
    }
    
    mainModDestPath = path.join(modsPath, '000_Spanishmod_P.pak');
    await fs.copy(mainModPath, mainModDestPath);
    console.log('Main mod file copied successfully to:', mainModDestPath);
    
    // Create temporary directory for DT files download
    tempDir = path.join(os.tmpdir(), `khespmix02-dt-${Date.now()}`);
    await fs.ensureDir(tempDir);
    console.log('Created temporary directory:', tempDir);
    
    // Download and extract DT files
    const extractedDtPath = await downloadAndExtractDTFiles(tempDir, (progress) => {
      // Update progress for download/extraction
      let stepProgress = 50; // Base progress for this step
      if (progress.step === 'download') {
        stepProgress = 50 + (progress.percentage * 0.15); // 50-65% for downloads
      } else if (progress.step === 'extract') {
        stepProgress = 65 + (progress.percentage * 0.15); // 65-80% for extraction
      }
      
      mainWindow.webContents.send('installation-progress', {
        step: 5,
        total: steps.length,
        message: progress.message,
        percentage: Math.round(stepProgress)
      });
    });
    
    console.log('DT files downloaded and extracted to:', extractedDtPath);
    
    // Copy DT files to game directory
    const dtDestPath = path.join(criMoviePath, 'dt');
    await fs.copy(extractedDtPath, dtDestPath, { overwrite: true });
    console.log('DT files copied to game directory:', dtDestPath);

    // Step 6: Install DT file
    mainWindow.webContents.send('installation-progress', {
      step: 6,
      total: steps.length,
      message: steps[5],
      percentage: 80
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (extractedDtPath && await fs.pathExists(extractedDtPath)) {
      await fs.copy(extractedDtPath, dtFilePath, { overwrite: true });
      console.log('DT file copied successfully to:', dtFilePath);
    } else {
      throw new Error('No se pudieron extraer correctamente los archivos DT');
    }

    // Step 7: Install copyright video
    mainWindow.webContents.send('installation-progress', {
      step: 7,
      total: steps.length,
      message: steps[6],
      percentage: 85
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const copyrightSourcePaths = [
      // Packaged app locations
      path.join(process.resourcesPath, 'app', 'assets', 'copyright.mp4'),
      path.join(process.resourcesPath, 'assets', 'copyright.mp4'),
      // Development locations
      path.join(__dirname, '..', 'assets', 'copyright.mp4'),
      // Current directory
      path.join(process.cwd(), 'assets', 'copyright.mp4')
    ];

    let sourceCopyrightVideo = null;
    console.log('Searching for copyright video in the following locations:');
    for (const testPath of copyrightSourcePaths) {
      console.log('Checking:', testPath);
      if (await fs.pathExists(testPath)) {
        sourceCopyrightVideo = testPath;
        console.log('Found copyright video at:', sourceCopyrightVideo);
        break;
      }
    }

    if (sourceCopyrightVideo) {
      await fs.copy(sourceCopyrightVideo, copyrightVideoPath, { overwrite: true });
      console.log('Copyright video copied successfully to:', copyrightVideoPath);
    } else {
      console.warn('Copyright video not found, skipping copyright video installation');
    }

    // Step 8: Verify installation
    mainWindow.webContents.send('installation-progress', {
      step: 8,
      total: steps.length,
      message: steps[7],
      percentage: 95
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!await fs.pathExists(mainModDestPath)) {
      throw new Error('Error al verificar la instalación del archivo de doblaje');
    }

    // Step 9: Finalize and cleanup
    mainWindow.webContents.send('installation-progress', {
      step: 9,
      total: steps.length,
      message: steps[8],
      percentage: 100
    });
    
    // Clean up temporary files
    if (tempDir) {
      await cleanupTempFiles(tempDir);
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));

    return { 
      success: true, 
      message: 'Doblaje instalado correctamente'
    };
  } catch (error) {
    console.error('Installation error:', error);
    
    // Clean up temporary files even on error
    if (tempDir) {
      await cleanupTempFiles(tempDir);
    }
    
    return { 
      success: false, 
      error: error.message || 'Error desconocido durante la instalación'
    };
  }
});

ipcMain.handle('launch-game', async () => {
  try {
    console.log('Attempting to launch Kingdom Hearts HD 2.8...');
    
    // Try multiple methods to launch the game
    const steamAppId = '2552440'; // Kingdom Hearts HD 2.8 Final Chapter Prologue
    
    // Method 1: Steam protocol URL
    try {
      await shell.openExternal(`steam://rungameid/${steamAppId}`);
      console.log('Game launch initiated via Steam protocol');
      return true;
    } catch (steamError) {
      console.warn('Steam protocol failed:', steamError.message);
    }
    
    // Method 2: Direct Steam command
    try {
      await new Promise((resolve, reject) => {
        exec(`start steam://rungameid/${steamAppId}`, (error, stdout, stderr) => {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
      console.log('Game launch initiated via exec command');
      return true;
    } catch (execError) {
      console.warn('Exec command failed:', execError.message);
    }
    
    // Method 3: Try to open Steam directly
    try {
      await shell.openExternal('steam://open/main');
      console.log('Opened Steam client - please launch the game manually');
      return true;
    } catch (openSteamError) {
      console.warn('Failed to open Steam:', openSteamError.message);
    }
    
    // If all methods fail
    console.error('All launch methods failed');
    return false;
    
  } catch (error) {
    console.error('Error launching game:', error);
    return false;
  }
});

ipcMain.handle('uninstall-dubbing', async (event, gamePath) => {
  try {
    const steps = [
      'Verificando instalación actual...',
      'Eliminando archivo de doblaje...',
      'Restaurando cinemáticas originales...',
      'Restaurando vídeo de copyright original...',
      'Limpiando directorios...',
      'Finalizando desinstalación...'
    ];

    // Step 1: Verify current installation
    mainWindow.webContents.send('installation-progress', {
      step: 1,
      total: steps.length,
      message: steps[0],
      percentage: 25
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Find the actual mods directory and files
    const possibleModDirs = [
      path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Paks', '~mods')
    ];
    
    let modsDir = null;
    let modFilesToRemove = [];
    
    for (const testDir of possibleModDirs) {
      if (await fs.pathExists(testDir)) {
        modsDir = testDir;
        
        // Check for dubbing mod
        const dubbingModPath = path.join(testDir, '000_Spanishmod_P.pak');
        if (await fs.pathExists(dubbingModPath)) {
          modFilesToRemove.push(dubbingModPath);
        }
        
        break;
      }
    }

    // Also check for DT file and copyright video
    const dtFilePath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'CriMovie', 'main', 'dt');
    const copyrightVideoPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Movies', 'copyright.mp4');
    
    let hasModFiles = modFilesToRemove.length > 0;
    let hasDtFile = await fs.pathExists(dtFilePath);
    let hasCopyrightVideo = await fs.pathExists(copyrightVideoPath);
    
    if (!hasModFiles && !hasDtFile && !hasCopyrightVideo) {
      throw new Error('No se encontraron mods instalados para desinstalar');
    }

    // Step 2: Remove dubbing mod file
    if (hasModFiles) {
      mainWindow.webContents.send('installation-progress', {
        step: 2,
        total: steps.length,
        message: steps[1],
        percentage: 20
      });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove all found mod files
      for (const modFile of modFilesToRemove) {
        console.log('Removing mod file:', modFile);
        
        // Try to change permissions before deletion to handle permission issues
        try {
          await fs.chmod(modFile, 0o666);
          console.log('Changed file permissions for deletion:', modFile);
        } catch (permError) {
          console.warn('Could not change file permissions for:', modFile, permError.message);
        }

        await fs.remove(modFile);
        console.log('Successfully removed:', modFile);
      }
    }

    // Step 3: Restore DT file
    mainWindow.webContents.send('installation-progress', {
      step: 3,
      total: steps.length,
      message: steps[2],
      percentage: 40
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (hasDtFile) {
      const dtBackupPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'CriMovie', 'main', 'dt.backup');
      if (await fs.pathExists(dtBackupPath)) {
        await fs.copy(dtBackupPath, dtFilePath, { overwrite: true });
        await fs.remove(dtBackupPath);
        console.log('Restored DT file from backup');
      } else {
        await fs.remove(dtFilePath);
        console.log('Removed DT file (no backup found)');
      }
    }

    // Step 4: Restore copyright video
    mainWindow.webContents.send('installation-progress', {
      step: 4,
      total: steps.length,
      message: steps[3],
      percentage: 60
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (hasCopyrightVideo) {
      const copyrightBackupPath = path.join(gamePath, 'KINGDOM HEARTS 0.2 Birth by Sleep', 'Content', 'Movies', 'copyright.mp4.backup');
      if (await fs.pathExists(copyrightBackupPath)) {
        await fs.copy(copyrightBackupPath, copyrightVideoPath, { overwrite: true });
        await fs.remove(copyrightBackupPath);
        console.log('Restored copyright video from backup');
      } else {
        await fs.remove(copyrightVideoPath);
        console.log('Removed copyright video (no backup found)');
      }
    }

    // Step 5: Clean up directories
    mainWindow.webContents.send('installation-progress', {
      step: 5,
      total: steps.length,
      message: steps[4],
      percentage: 80
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Check if mods directory is empty and remove it if so
    if (modsDir) {
      try {
        const modsContents = await fs.readdir(modsDir);
        if (modsContents.length === 0) {
          await fs.remove(modsDir);
          console.log('Removed empty mods directory:', modsDir);
        }
      } catch (error) {
        // Directory might not exist or be inaccessible, which is fine
        console.log('Could not clean up mods directory:', error.message);
      }
    }

    // Step 6: Finalize
    mainWindow.webContents.send('installation-progress', {
      step: 6,
      total: steps.length,
      message: steps[5],
      percentage: 100
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    return { 
      success: true, 
      message: 'Doblaje desinstalado correctamente'
    };
  } catch (error) {
    console.error('Uninstallation error:', error);
    return { 
      success: false, 
      error: error.message || 'Error desconocido durante la desinstalación'
    };
  }
});

ipcMain.handle('open-external-link', async (event, url) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error('Error opening external link:', error);
    return false;
  }
});

// Test extraction with local RAR files
async function testLocalRarExtraction(progressCallback) {
  const localRarDir = 'E:\\Users\\Yokimitsuro\\Downloads\\dt';
  const tempDir = path.join(os.tmpdir(), `khespmix02-dt-test-${Date.now()}`);
  
  try {
    console.log('Testing local RAR extraction...');
    console.log('Local RAR directory:', localRarDir);
    console.log('Temp directory:', tempDir);
    
    // Create temp directory
    await fs.ensureDir(tempDir);
    
    // Copy RAR files to temp directory
    progressCallback({
      step: 'extract',
      message: 'Copiando archivos RAR locales...',
      percentage: 10
    });
    
    const rarFiles = [
      'dt.part1.rar', 'dt.part2.rar', 'dt.part3.rar', 'dt.part4.rar',
      'dt.part5.rar', 'dt.part6.rar', 'dt.part7.rar'
    ];
    
    for (const rarFile of rarFiles) {
      const sourcePath = path.join(localRarDir, rarFile);
      const destPath = path.join(tempDir, rarFile);
      
      if (await fs.pathExists(sourcePath)) {
        await fs.copy(sourcePath, destPath);
        console.log(`Copied: ${rarFile}`);
      } else {
        console.warn(`File not found: ${sourcePath}`);
      }
    }
    
    // Extract using the same logic as download function
    const rarFilePath = path.join(tempDir, 'dt.part1.rar');
    const extractPath = path.join(tempDir, 'extracted');
    
    await fs.ensureDir(extractPath);
    
    progressCallback({
      step: 'extract',
      message: 'Extrayendo archivos RAR locales...',
      percentage: 50
    });
    
    await extractSplitRarFile(rarFilePath, extractPath, progressCallback);
    
    // Check extraction results
    console.log('Checking extraction results...');
    const extractedContents = await fs.readdir(extractPath);
    console.log('Extracted contents:', extractedContents);
    
    if (extractedContents.length === 0) {
      throw new Error('No files were extracted');
    }
    
    // Look for dt folder
    const possibleDtPaths = [
      path.join(extractPath, 'dt'),
      path.join(extractPath, 'DT'),
      path.join(extractPath, 'Dt')
    ];
    
    let foundDtPath = null;
    for (const dtPath of possibleDtPaths) {
      if (await fs.pathExists(dtPath)) {
        foundDtPath = dtPath;
        console.log(`Found dt folder at: ${dtPath}`);
        break;
      }
    }
    
    if (!foundDtPath) {
      // List directory structure for debugging
      console.log('DT folder not found. Full directory structure:');
      await listDirectoryRecursive(extractPath, 0);
      
      // Check if any directory contains typical DT files
      for (const item of extractedContents) {
        const itemPath = path.join(extractPath, item);
        const stat = await fs.stat(itemPath);
        
        if (stat.isDirectory()) {
          const subContents = await fs.readdir(itemPath);
          console.log(`Contents of ${item}:`, subContents);
          
          const hasTypicalDtFiles = subContents.some(file => 
            file.toLowerCase().includes('.dt') || 
            file.toLowerCase().includes('movie') ||
            file.toLowerCase().includes('video') ||
            file.toLowerCase().includes('.bik') ||
            file.toLowerCase().includes('.mp4')
          );
          
          if (hasTypicalDtFiles) {
            foundDtPath = itemPath;
            console.log(`Using directory with DT files: ${itemPath}`);
            break;
          }
        }
      }
    }
    
    if (foundDtPath) {
      progressCallback({
        step: 'extract',
        message: 'Extracción local exitosa',
        percentage: 100
      });
      
      console.log('LOCAL RAR EXTRACTION TEST SUCCESSFUL!');
      console.log('DT folder found at:', foundDtPath);
      
      // List some files in the dt folder
      const dtContents = await fs.readdir(foundDtPath);
      console.log('DT folder contents (first 10 files):', dtContents.slice(0, 10));
      
      return foundDtPath;
    } else {
      throw new Error('No se encontró la carpeta dt en los archivos extraídos locales');
    }
    
  } catch (error) {
    console.error('Local RAR extraction test failed:', error);
    throw error;
  } finally {
    // Clean up temp files
    try {
      if (await fs.pathExists(tempDir)) {
        await fs.remove(tempDir);
        console.log('Local test temp files cleaned up');
      }
    } catch (cleanupError) {
      console.warn('Could not clean up local test temp files:', cleanupError.message);
    }
  }
  
  async function listDirectoryRecursive(dir, depth) {
    if (depth > 3) return;
    
    try {
      const items = await fs.readdir(dir);
      for (const item of items) {
        const itemPath = path.join(dir, item);
        const stat = await fs.stat(itemPath);
        const indent = '  '.repeat(depth);
        
        if (stat.isDirectory()) {
          console.log(`${indent}📁 ${item}/`);
          await listDirectoryRecursive(itemPath, depth + 1);
        } else {
          console.log(`${indent}📄 ${item} (${stat.size} bytes)`);
        }
      }
    } catch (error) {
      console.warn(`Error reading directory ${dir}:`, error.message);
    }
  }
}

// Download and extract DT files from GitHub
async function downloadAndExtractDTFiles(tempDir, progressCallback) {
  // Ensure temp directory exists
  await fs.ensureDir(tempDir);
  console.log('Verified temporary directory exists:', tempDir);
  
  const dtUrls = [
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part1.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part2.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part3.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part4.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part5.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part6.rar',
    'https://github.com/EcosDelDoblaje/KHESPMIX02/releases/download/V1.0/dt.part7.rar'
  ];

  // Helper functions for formatting
  const formatSpeed = (bytesPerSec) => {
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`;
    } else if (bytesPerSec >= 1024) {
      return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
    } else {
      return `${bytesPerSec.toFixed(0)} B/s`;
    }
  };
  
  const formatTime = (seconds) => {
    if (seconds < 60) {
      return `${Math.round(seconds)}s`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    } else {
      return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    }
  };
  
  const formatSize = (bytes) => {
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    } else if (bytes >= 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    } else if (bytes >= 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    } else {
      return `${bytes} B`;
    }
  };

  // Global progress tracking
  let globalDownloadedBytes = 0;
  let globalTotalBytes = 0;
  let globalStartTime = Date.now();
  let lastGlobalUpdate = globalStartTime;
  
  // First, get file sizes for total calculation
  const fileSizes = [];
  for (const url of dtUrls) {
    try {
      const headResponse = await axios.head(url, {
        headers: { 'User-Agent': 'KHESPMIX02-Installer/1.0.0' }
      });
      const size = parseInt(headResponse.headers['content-length'] || '0');
      fileSizes.push(size);
      globalTotalBytes += size;
    } catch (error) {
      console.warn(`Could not get size for ${url}, using 0`);
      fileSizes.push(0);
    }
  }

  // Download files in parallel (max 3 concurrent downloads)
  const maxConcurrent = 3;
  const downloadedFiles = [];
  const downloadPromises = [];
  
  for (let i = 0; i < dtUrls.length; i += maxConcurrent) {
    const batch = dtUrls.slice(i, i + maxConcurrent);
    const batchPromises = batch.map(async (url, batchIndex) => {
      const globalIndex = i + batchIndex;
      const fileName = path.basename(url);
      const filePath = path.join(tempDir, fileName);
      const expectedSize = fileSizes[globalIndex];
      
      let fileDownloadedBytes = 0;
      
      try {
        const response = await axios({
          method: 'GET',
          url: url,
          responseType: 'stream',
          timeout: 300000, // 5 minutes timeout
          headers: {
            'User-Agent': 'KHESPMIX02-Installer/1.0.0'
          }
        });

        // Ensure the file path directory exists
        await fs.ensureDir(path.dirname(filePath));
        console.log(`Creating write stream for: ${filePath}`);
        
        const writer = fs.createWriteStream(filePath);
        
        // Track download progress
        response.data.on('data', (chunk) => {
          fileDownloadedBytes += chunk.length;
          globalDownloadedBytes += chunk.length;
          
          const currentTime = Date.now();
          
          // Update progress every 500ms to avoid too frequent updates
          if (currentTime - lastGlobalUpdate >= 500) {
            const elapsedTime = (currentTime - globalStartTime) / 1000; // seconds
            const averageSpeed = elapsedTime > 0 ? globalDownloadedBytes / elapsedTime : 0;
            
            // Calculate ETA for total download
            const remainingBytes = globalTotalBytes - globalDownloadedBytes;
            const eta = averageSpeed > 0 ? remainingBytes / averageSpeed : 0;
            
            const totalProgress = globalTotalBytes > 0 ? (globalDownloadedBytes / globalTotalBytes) * 100 : 0;
            const overallProgress = totalProgress * 0.5; // 50% for downloads
            
            let message = `Descargando cinemáticas...`;
            if (globalTotalBytes > 0) {
              message += `\n${formatSize(globalDownloadedBytes)} / ${formatSize(globalTotalBytes)} (${totalProgress.toFixed(1)}%)`;
              message += `\nVelocidad: ${formatSpeed(averageSpeed)}`;
              if (eta > 0 && eta < 3600) { // Only show ETA if less than 1 hour
                message += ` - ETA: ${formatTime(eta)}`;
              }
            }
            
            progressCallback({
              step: 'download',
              message: message,
              percentage: Math.round(overallProgress),
              speed: formatSpeed(averageSpeed),
              eta: eta > 0 ? formatTime(eta) : null,
              downloadedSize: formatSize(globalDownloadedBytes),
              totalSize: formatSize(globalTotalBytes)
            });
            
            lastGlobalUpdate = currentTime;
          }
        });

        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        downloadedFiles.push(filePath);
        console.log(`Downloaded: ${fileName} (${formatSize(expectedSize)})`);
        return filePath;
      } catch (error) {
        console.error(`Error downloading ${fileName}:`, error);
        console.error(`File path: ${filePath}`);
        console.error(`Temp directory: ${tempDir}`);
        console.error(`Directory exists: ${await fs.pathExists(tempDir)}`);
        throw new Error(`Error al descargar ${fileName}: ${error.message}`);
      }
    });
    
    // Wait for current batch to complete before starting next batch
    const batchResults = await Promise.all(batchPromises);
    downloadPromises.push(...batchResults);
  }
  
  // Final progress update
  progressCallback({
    step: 'download',
    message: 'Descarga completada',
    percentage: 50,
    speed: null,
    eta: null,
    downloadedSize: formatSize(globalTotalBytes),
    totalSize: formatSize(globalTotalBytes)
  });

  // Extract split RAR directly (7-Zip handles RAR split archives better)
  progressCallback({
    step: 'extract',
    message: 'Extrayendo cinemáticas...',
    percentage: 60
  });

  const rarFilePath = path.join(tempDir, 'dt.part1.rar');
  const extractPath = path.join(tempDir, 'extracted');
  
  await fs.ensureDir(extractPath);

  try {
    // Extract directly from the main RAR file (split parts will be read automatically)
    await extractSplitRarFile(rarFilePath, extractPath, progressCallback);

    console.log('DT files extracted successfully');
    
    // Debug: List all extracted contents
    console.log('Listing extracted contents...');
    const extractedContents = await fs.readdir(extractPath);
    console.log('Extracted contents:', extractedContents);
    
    // Look for dt folder in multiple ways
    const possibleDtPaths = [
      path.join(extractPath, 'dt'),
      path.join(extractPath, 'DT'),
      path.join(extractPath, 'Dt')
    ];
    
    // First, try direct paths
    for (const dtPath of possibleDtPaths) {
      if (await fs.pathExists(dtPath)) {
        console.log(`Found dt folder at: ${dtPath}`);
        return dtPath;
      }
    }
    
    // Then, look in subdirectories
    for (const item of extractedContents) {
      const itemPath = path.join(extractPath, item);
      const stat = await fs.stat(itemPath);
      
      if (stat.isDirectory()) {
        console.log(`Checking directory: ${item}`);
        
        // Check if this directory itself contains the files we need
        const subContents = await fs.readdir(itemPath);
        console.log(`Contents of ${item}:`, subContents);
        
        // Look for dt folder inside this directory
        for (const possibleName of ['dt', 'DT', 'Dt']) {
          const possibleDtPath = path.join(itemPath, possibleName);
          if (await fs.pathExists(possibleDtPath)) {
            console.log(`Found dt folder at: ${possibleDtPath}`);
            return possibleDtPath;
          }
        }
        
        // If this directory contains typical DT files, use it directly
        const hasTypicalDtFiles = subContents.some(file => 
          file.toLowerCase().includes('.dt') || 
          file.toLowerCase().includes('movie') ||
          file.toLowerCase().includes('video') ||
          file.toLowerCase().includes('.bik') ||
          file.toLowerCase().includes('.mp4')
        );
        
        if (hasTypicalDtFiles) {
          console.log(`Using directory with DT files: ${itemPath}`);
          return itemPath;
        }
      }
    }
    
    // If still not found, list everything recursively for debugging
    console.log('DT folder not found. Full directory structure:');
    await listDirectoryRecursive(extractPath, 0);
    
    throw new Error('No se encontró la carpeta dt en los archivos extraídos');
    
    async function listDirectoryRecursive(dir, depth) {
      if (depth > 3) return; // Prevent infinite recursion
      
      try {
        const items = await fs.readdir(dir);
        for (const item of items) {
          const itemPath = path.join(dir, item);
          const stat = await fs.stat(itemPath);
          const indent = '  '.repeat(depth);
          
          if (stat.isDirectory()) {
            console.log(`${indent}📁 ${item}/`);
            await listDirectoryRecursive(itemPath, depth + 1);
          } else {
            console.log(`${indent}📄 ${item} (${stat.size} bytes)`);
          }
        }
      } catch (error) {
        console.warn(`Error reading directory ${dir}:`, error.message);
      }
    }
  } catch (error) {
    console.error('Error extracting DT files:', error);
    throw new Error(`Error extrayendo las cinemáticas: ${error.message}`);
  }
}

// Extract split RAR file using 7-Zip with fallback options
async function extractSplitRarFile(rarPath, extractPath, progressCallback) {
  try {
    console.log(`Extracting split RAR file: ${rarPath} to ${extractPath}`);
    
    // Ensure extract directory exists
    await fs.ensureDir(extractPath);
    
    progressCallback({
      step: 'extract',
      message: 'Iniciando extracción...',
      percentage: 65
    });

    // Try different UnRAR extraction methods
    await extractWithUnRAR(rarPath, extractPath, progressCallback);
    
    console.log('Split RAR extraction completed successfully');
  } catch (error) {
    console.error('Error during split RAR extraction:', error);
    throw new Error(`Error extrayendo archivo RAR dividido: ${error.message}`);
  }
}

// Extract using UnRAR with multiple fallback options
async function extractWithUnRAR(rarPath, extractPath, progressCallback) {
  console.log('Using UnRAR for RAR extraction (best for split archives)');

  const extractionTools = [
    // UnRAR.exe (MEJOR OPCIÓN - diseñado específicamente para RAR)
    { path: path.join(process.resourcesPath, 'app', 'assets', 'UnRAR.exe'), type: 'unrar' },
    { path: path.join(process.resourcesPath, 'assets', 'UnRAR.exe'), type: 'unrar' },
    { path: path.join(__dirname, '..', 'assets', 'UnRAR.exe'), type: 'unrar' },
    { path: path.join(process.cwd(), 'assets', 'UnRAR.exe'), type: 'unrar' },
    // WinRAR (si está instalado)
    { path: 'C:\\Program Files\\WinRAR\\unrar.exe', type: 'unrar' },
    { path: 'C:\\Program Files (x86)\\WinRAR\\unrar.exe', type: 'unrar' },
    { path: 'C:\\Program Files\\WinRAR\\WinRAR.exe', type: 'winrar' },
    { path: 'C:\\Program Files (x86)\\WinRAR\\WinRAR.exe', type: 'winrar' },
    // 7-Zip (como fallback)
    { path: 'C:\\Program Files\\7-Zip\\7z.exe', type: '7zip' },
    { path: 'C:\\Program Files (x86)\\7-Zip\\7z.exe', type: '7zip' },
    { path: path.join(__dirname, '..', 'assets', '7za.exe'), type: '7zip' }
  ];

  let lastError = null;

  for (const tool of extractionTools) {
    try {
      console.log(`Trying ${tool.type.toUpperCase()} at: ${tool.path}`);
      
      // Check if the executable exists
      if (tool.path.includes('\\') || tool.path.includes('/')) {
        const exists = await fs.pathExists(tool.path);
        if (!exists) {
          console.log(`❌ File not found: ${tool.path}`);
          continue;
        }
        console.log(`✅ Found: ${tool.path}`);
      }
      
      progressCallback({
        step: 'extract',
        message: 'Extrayendo archivos...',
        percentage: 75
      });

      // Use appropriate extraction method
      await extractWithTool(tool, rarPath, extractPath, progressCallback);

      progressCallback({
        step: 'extract',
        message: 'Extracción completada',
        percentage: 85
      });

      console.log(`Successfully extracted using ${tool.type.toUpperCase()} at: ${tool.path}`);
      return; // Success, exit function
      
    } catch (error) {
      console.warn(`Failed with ${tool.type.toUpperCase()} at ${tool.path}:`, error.message);
      lastError = error;
      continue; // Try next path
    }
  }

  // If all 7-Zip attempts failed, try manual command line extraction
  try {
    console.log('Trying manual command line extraction...');
    await extractWithCommandLine(rarPath, extractPath, progressCallback);
  } catch (cmdError) {
    console.error('Command line extraction also failed:', cmdError);
    throw new Error(`No se pudo extraer el archivo. Último error: ${lastError?.message || cmdError.message}`);
  }
}

// Extract with appropriate tool based on type
async function extractWithTool(tool, rarPath, extractPath, progressCallback) {
  return new Promise((resolve, reject) => {
    let command;
    
    if (tool.type === 'unrar') {
      // UnRAR command: UnRAR.exe x -y "archive.part1.rar" "output_folder\\"
      command = `"${tool.path}" x -y "${rarPath}" "${extractPath}\\"`;    
    } else if (tool.type === 'winrar') {
      // WinRAR command: WinRAR.exe x -y "archive.part1.rar" "output_folder\\"
      command = `"${tool.path}" x -y "${rarPath}" "${extractPath}\\"`;    
    } else {
      // 7-Zip command: 7z.exe x "archive.part1.rar" -o"output_folder" -y
      command = `"${tool.path}" x "${rarPath}" -o"${extractPath}" -y`;
    }
    
    console.log(`Executing ${tool.type.toUpperCase()} command: ${command}`);
    
    const process = exec(command, { 
      timeout: 600000, // 10 minutes timeout
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    }, (error, stdout, stderr) => {
      console.log(`=== ${tool.type.toUpperCase()} OUTPUT ===`);
      console.log('STDOUT:', stdout);
      console.log('STDERR:', stderr);
      console.log('ERROR:', error ? error.message : 'none');
      
      if (error) {
        console.error(`${tool.type.toUpperCase()} extraction error: ${error.message}`);
        reject(new Error(`${tool.type.toUpperCase()} extraction failed: ${error.message}`));
      } else {
        console.log(`${tool.type.toUpperCase()} extraction completed successfully`);
        resolve();
      }
    });
    
    // Handle process events for better debugging
    process.on('spawn', () => {
      console.log(`${tool.type.toUpperCase()} process spawned successfully`);
    });
    
    process.on('error', (error) => {
      console.error(`Failed to spawn ${tool.type.toUpperCase()} process:`, error);
      reject(error);
    });
  });
}

// PowerShell extraction method for split archives (not used for RAR)
async function extractWithPowerShell(rarPath, extractPath, progressCallback) {
  // PowerShell doesn't handle RAR files well, this function is kept for compatibility
  // but will not be called for RAR files
  throw new Error('PowerShell extraction not supported for RAR files');
}

// Fallback: Manual command line extraction
async function extractWithCommandLine(rarPath, extractPath, progressCallback) {
  return new Promise((resolve, reject) => {
    progressCallback({
      step: 'extract',
      message: 'Intentando extracción manual...',
      percentage: 80
    });

    // Try different command line tools for RAR (prioritize UnRAR)
    const bundledUnRAR = path.join(__dirname, '..', 'assets', 'UnRAR.exe');
    const bundled7za = path.join(__dirname, '..', 'assets', '7za.exe');
    const commands = [
      `"${bundledUnRAR}" x -y "${rarPath}" "${extractPath}\\"`,  
      `"${bundled7za}" x "${rarPath}" -o"${extractPath}" -y`,
      `"C:\\Program Files\\7-Zip\\7z.exe" x "${rarPath}" -o"${extractPath}" -y`,
      `"C:\\Program Files (x86)\\7-Zip\\7z.exe" x "${rarPath}" -o"${extractPath}" -y`,
      `7z x "${rarPath}" -o"${extractPath}" -y`
    ];

    let commandIndex = 0;

    const tryNextCommand = () => {
      if (commandIndex >= commands.length) {
        reject(new Error('Todos los métodos de extracción fallaron'));
        return;
      }

      const command = commands[commandIndex];
      console.log(`Trying command: ${command}`);

      exec(command, (error, stdout, stderr) => {
        if (error) {
          console.warn(`Command failed: ${command}`, error.message);
          commandIndex++;
          tryNextCommand();
        } else {
          console.log('Manual extraction successful');
          progressCallback({
            step: 'extract',
            message: 'Extracción manual completada',
            percentage: 85
          });
          resolve();
        }
      });
    };

    tryNextCommand();
  });
}

// Clean up temporary files
async function cleanupTempFiles(tempDir) {
  try {
    if (await fs.pathExists(tempDir)) {
      await fs.remove(tempDir);
      console.log('Temporary files cleaned up successfully');
    }
  } catch (error) {
    console.warn('Could not clean up temporary files:', error.message);
  }
}
