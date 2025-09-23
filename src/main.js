const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs-extra');
const { spawn, exec } = require('child_process');
const os = require('os');

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
  try {
    const steps = [
      'Verificando archivos del juego...',
      'Creando directorios necesarios...',
      'Creando copias de seguridad...',
      'Instalando archivo de doblaje...',
      'Instalando archivo DT...',
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

    // Step 4: Install dubbing mod
    mainWindow.webContents.send('installation-progress', {
      step: 4,
      total: steps.length,
      message: steps[3],
      percentage: 40
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    // Install main dubbing mod
    const mainModPaths = [
      // Packaged app locations
      path.join(process.resourcesPath, 'app', 'assets', '000_Spanishmod_P.pak'),
      path.join(process.resourcesPath, 'assets', '000_Spanishmod_P.pak'),
      // Development locations
      path.join(__dirname, '..', 'assets', '000_Spanishmod_P.pak'),
      // Current directory
      path.join(process.cwd(), 'assets', '000_Spanishmod_P.pak')
    ];

    let sourceMainMod = null;
    console.log('Searching for main dubbing mod in the following locations:');
    for (const testPath of mainModPaths) {
      console.log('Checking:', testPath);
      if (await fs.pathExists(testPath)) {
        sourceMainMod = testPath;
        console.log('Found main mod file at:', sourceMainMod);
        break;
      }
    }

    if (!sourceMainMod) {
      console.log('Main mod file not found in any of the expected locations');
      throw new Error('No se encontró el archivo del mod de doblaje. Ubicaciones verificadas: ' + mainModPaths.join(', '));
    }

    const targetMainMod = path.join(modsPath, '000_Spanishmod_P.pak');
    await fs.copy(sourceMainMod, targetMainMod, { overwrite: true });

    // Set normal file permissions for main mod
    try {
      await fs.chmod(targetMainMod, 0o644);
      console.log('Main mod file permissions set successfully');
    } catch (permError) {
      console.warn('Could not set main mod file permissions:', permError.message);
    }

    console.log('Main mod file copied successfully to:', targetMainMod);

    // Step 5: Install DT file
    mainWindow.webContents.send('installation-progress', {
      step: 5,
      total: steps.length,
      message: steps[4],
      percentage: 60
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    const dtSourcePaths = [
      // Packaged app locations
      path.join(process.resourcesPath, 'app', 'assets', 'dt'),
      path.join(process.resourcesPath, 'assets', 'dt'),
      // Development locations
      path.join(__dirname, '..', 'assets', 'dt'),
      // Current directory
      path.join(process.cwd(), 'assets', 'dt')
    ];

    let sourceDtFile = null;
    console.log('Searching for DT file in the following locations:');
    for (const testPath of dtSourcePaths) {
      console.log('Checking:', testPath);
      if (await fs.pathExists(testPath)) {
        sourceDtFile = testPath;
        console.log('Found DT file at:', sourceDtFile);
        break;
      }
    }

    if (sourceDtFile) {
      await fs.copy(sourceDtFile, dtFilePath, { overwrite: true });
      console.log('DT file copied successfully to:', dtFilePath);
    } else {
      console.warn('DT file not found, skipping DT installation');
    }

    // Step 6: Install copyright video
    mainWindow.webContents.send('installation-progress', {
      step: 6,
      total: steps.length,
      message: steps[5],
      percentage: 80
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

    // Step 7: Verify installation
    mainWindow.webContents.send('installation-progress', {
      step: 7,
      total: steps.length,
      message: steps[6],
      percentage: 90
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    if (!await fs.pathExists(targetMainMod)) {
      throw new Error('Error al verificar la instalación del archivo de doblaje');
    }

    // Step 8: Finalize
    mainWindow.webContents.send('installation-progress', {
      step: 8,
      total: steps.length,
      message: steps[7],
      percentage: 100
    });
    await new Promise(resolve => setTimeout(resolve, 500));

    return { 
      success: true, 
      installedPath: targetMainMod,
      message: 'Doblaje instalado correctamente'
    };
  } catch (error) {
    console.error('Installation error:', error);
    return { 
      success: false, 
      error: error.message || 'Error desconocido durante la instalación'
    };
  }
});

ipcMain.handle('launch-game', async () => {
  try {
    exec('start steam://rungameid/2552440');
    return true;
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
      'Restaurando archivo DT original...',
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
