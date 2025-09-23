const { ipcRenderer } = require('electron');

let currentScreen = 'welcome';
let gamePath = '';
let isModInstalled = false;
let installedMods = { dubbing: false, dtFile: false, copyrightVideo: false };

// Screen management
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active', 'prev');
        if (screen.id === screenId) {
            screen.classList.add('active');
        } else if (screen.classList.contains('active')) {
            screen.classList.add('prev');
        }
    });
    currentScreen = screenId;
}

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    await checkStartupModStatus();
});

function setupEventListeners() {
    // Title bar controls
    document.getElementById('minimize-btn').addEventListener('click', () => {
        ipcRenderer.invoke('minimize-window');
    });

    document.getElementById('close-btn').addEventListener('click', () => {
        ipcRenderer.invoke('close-window');
    });

    // Welcome screen
    document.getElementById('next-btn').addEventListener('click', () => {
        showScreen('terms-screen');
    });

    // Welcome screen mod installed actions
    document.getElementById('welcome-reinstall-btn').addEventListener('click', async () => {
        await startInstallation({});
    });

    document.getElementById('welcome-uninstall-btn').addEventListener('click', async () => {
        await startUninstallation();
    });


    // Reinstall screen
    document.getElementById('reinstall-back-btn').addEventListener('click', () => {
        showScreen('welcome-screen');
    });

    document.getElementById('confirm-reinstall-btn').addEventListener('click', async () => {
        await startInstallation({});
    });

    document.getElementById('uninstall-btn').addEventListener('click', async () => {
        await startUninstallation();
    });

    // Terms screen
    document.getElementById('terms-back-btn').addEventListener('click', () => {
        showScreen('welcome-screen');
    });

    document.getElementById('accept-terms-btn').addEventListener('click', () => {
        showScreen('path-screen');
        detectSteamPath();
    });

    // Enable accept button when scrolled to bottom
    const termsScroll = document.querySelector('.terms-scroll');
    termsScroll.addEventListener('scroll', () => {
        const isScrolledToBottom = termsScroll.scrollTop + termsScroll.clientHeight >= termsScroll.scrollHeight - 10;
        const acceptBtn = document.getElementById('accept-terms-btn');
        if (isScrolledToBottom) {
            acceptBtn.disabled = false;
            acceptBtn.classList.remove('disabled');
        }
    });

    // Path screen
    document.getElementById('back-btn').addEventListener('click', () => {
        showScreen('terms-screen');
    });

    document.getElementById('browse-btn').addEventListener('click', async () => {
        const selectedPath = await ipcRenderer.invoke('browse-folder');
        if (selectedPath) {
            document.getElementById('game-path').value = selectedPath;
            await validateGamePath(selectedPath);
        }
    });

    document.getElementById('install-btn').addEventListener('click', async () => {
        await startInstallation({});
    });

    // Complete screen
    document.getElementById('play-btn').addEventListener('click', async () => {
        const success = await ipcRenderer.invoke('launch-game');
        if (success) {
            ipcRenderer.invoke('close-window');
        }
    });

    document.getElementById('finish-btn').addEventListener('click', () => {
        ipcRenderer.invoke('close-window');
    });

    // External links
    document.querySelectorAll('.social-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            ipcRenderer.invoke('open-external-link', link.href);
        });
    });
}

async function checkStartupModStatus() {
    try {
        const status = await ipcRenderer.invoke('check-startup-mod-status');
        console.log('Startup mod status:', status);
        
        if (status.found && status.modInstalled) {
            isModInstalled = true;
            installedMods = status.installedMods || { dubbing: false, dtFile: false, copyrightVideo: false };
            gamePath = status.gamePath;
            
            // Show mod installed actions and hide default actions
            document.getElementById('welcome-actions').style.display = 'none';
            document.getElementById('mod-installed-actions').style.display = 'flex';
            document.getElementById('welcome-description').innerHTML = 
                '<p>Se ha detectado una instalación previa del doblaje al castellano.<br>Elige qué acción deseas realizar:</p>';
        }
    } catch (error) {
        console.error('Error checking startup mod status:', error);
    }
}

function updateReinstallStatus() {
    const statusContainer = document.getElementById('current-status');
    const statusItems = document.createElement('div');
    statusItems.className = 'status-items';
    
    // Dubbing mod status
    const dubbingStatus = document.createElement('div');
    dubbingStatus.className = `status-item ${installedMods.dubbing ? 'installed' : 'not-installed'}`;
    dubbingStatus.innerHTML = `
        <span class="status-icon">${installedMods.dubbing ? '✓' : '✗'}</span>
        <span>Archivo de doblaje: ${installedMods.dubbing ? 'Instalado' : 'No instalado'}</span>
    `;
    
    // DT file status
    const dtStatus = document.createElement('div');
    dtStatus.className = `status-item ${installedMods.dtFile ? 'installed' : 'not-installed'}`;
    dtStatus.innerHTML = `
        <span class="status-icon">${installedMods.dtFile ? '✓' : '✗'}</span>
        <span>Archivo DT: ${installedMods.dtFile ? 'Instalado' : 'No instalado'}</span>
    `;
    
    // Copyright video status
    const copyrightStatus = document.createElement('div');
    copyrightStatus.className = `status-item ${installedMods.copyrightVideo ? 'installed' : 'not-installed'}`;
    copyrightStatus.innerHTML = `
        <span class="status-icon">${installedMods.copyrightVideo ? '✓' : '✗'}</span>
        <span>Vídeo de copyright: ${installedMods.copyrightVideo ? 'Instalado' : 'No instalado'}</span>
    `;
    
    statusItems.appendChild(dubbingStatus);
    statusItems.appendChild(dtStatus);
    statusItems.appendChild(copyrightStatus);
    statusContainer.appendChild(statusItems);
}

async function detectSteamPath() {
    const detectionStatus = document.getElementById('detection-status');
    const gamePathInput = document.getElementById('game-path');
    const installBtn = document.getElementById('install-btn');
    
    detectionStatus.textContent = 'Detectando automáticamente el juego...';
    
    try {
        const detectedPath = await ipcRenderer.invoke('detect-steam-path');
        
        if (detectedPath) {
            detectionStatus.textContent = '¡Kingdom Hearts HD 2.8 detectado automáticamente!';
            gamePathInput.value = detectedPath;
            gamePath = detectedPath;
            installBtn.disabled = false;
            installBtn.classList.remove('disabled');
        } else {
            detectionStatus.textContent = 'No se pudo detectar automáticamente. Selecciona manualmente la carpeta del juego.';
        }
    } catch (error) {
        console.error('Error detecting Steam path:', error);
        detectionStatus.textContent = 'Error en la detección automática. Selecciona manualmente la carpeta del juego.';
    }
}

async function validateGamePath(path) {
    const installBtn = document.getElementById('install-btn');
    
    try {
        const isValid = await ipcRenderer.invoke('validate-game-path', path);
        
        if (isValid) {
            gamePath = path;
            installBtn.disabled = false;
            installBtn.classList.remove('disabled');
        } else {
            installBtn.disabled = true;
            installBtn.classList.add('disabled');
            alert('La ruta seleccionada no contiene una instalación válida de Kingdom Hearts HD 2.8.');
        }
    } catch (error) {
        console.error('Error validating game path:', error);
        installBtn.disabled = true;
        installBtn.classList.add('disabled');
    }
}

async function startInstallation(options = {}) {
    showScreen('progress-screen');
    
    try {
        const result = await ipcRenderer.invoke('install-dubbing', gamePath, options);
        
        if (result.success) {
            showScreen('complete-screen');
        } else {
            alert(`Error durante la instalación: ${result.error}`);
            showScreen('path-screen');
        }
    } catch (error) {
        console.error('Installation error:', error);
        alert('Error inesperado durante la instalación.');
        showScreen('path-screen');
    }
}

async function startUninstallation() {
    showScreen('progress-screen');
    
    // Update progress screen title for uninstallation
    const progressTitle = document.querySelector('#progress-screen .screen-title');
    const originalTitle = progressTitle.textContent;
    progressTitle.textContent = 'Desinstalando Doblaje';
    
    try {
        const result = await ipcRenderer.invoke('uninstall-dubbing', gamePath);
        
        if (result.success) {
            // Update completion screen for uninstallation
            const successTitle = document.querySelector('#complete-screen .success-title');
            const successMessage = document.querySelector('#complete-screen .success-message');
            const playBtn = document.getElementById('play-btn');
            
            const originalSuccessTitle = successTitle.textContent;
            const originalSuccessMessage = successMessage.innerHTML;
            
            successTitle.textContent = '¡Desinstalación Completa!';
            successMessage.innerHTML = 'El doblaje al castellano se ha desinstalado correctamente.<br>Kingdom Hearts 0.2 vuelve a su estado original.';
            playBtn.style.display = 'none'; // Hide play button for uninstall
            
            showScreen('complete-screen');
            
            // Reset for future use
            setTimeout(() => {
                progressTitle.textContent = originalTitle;
                successTitle.textContent = originalSuccessTitle;
                successMessage.innerHTML = originalSuccessMessage;
                playBtn.style.display = 'inline-flex';
                isModInstalled = false;
                installedMods = { dubbing: false, dtFile: false, copyrightVideo: false };
                // Reset welcome screen to default state
                document.getElementById('welcome-actions').style.display = 'flex';
                document.getElementById('mod-installed-actions').style.display = 'none';
                document.getElementById('welcome-description').innerHTML = 
                    '<p>Este programa instalará el doblaje al castellano<br>para "Kingdom Hearts 0.2"</p>';
            }, 100);
        } else {
            alert(`Error durante la desinstalación: ${result.error}`);
            showScreen('reinstall-screen');
        }
    } catch (error) {
        console.error('Uninstallation error:', error);
        alert('Error inesperado durante la desinstalación.');
        showScreen('reinstall-screen');
    }
}

// Listen for installation progress updates
ipcRenderer.on('installation-progress', (event, progress) => {
    const progressMessage = document.querySelector('.progress-message');
    const progressStep = document.querySelector('.progress-step');
    const progressPercentage = document.querySelector('.progress-percentage');
    const progressFill = document.querySelector('.progress-fill');
    
    if (progressMessage) progressMessage.textContent = progress.message;
    if (progressStep) progressStep.textContent = `Paso ${progress.step} de ${progress.total}`;
    if (progressPercentage) progressPercentage.textContent = `${progress.percentage}%`;
    if (progressFill) progressFill.style.width = `${progress.percentage}%`;
});
