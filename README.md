# Ecos del Doblaje - Kingdom Hearts 0.2 Installer

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

## 📖 Descripción

Instalador oficial del doblaje al castellano para **Kingdom Hearts 0.2: Birth by Sleep - A Fragmentary Passage**. Este proyecto permite a los usuarios instalar fácilmente el mod de doblaje español desarrollado por el equipo de Ecos del Doblaje.

## ✨ Características

- 🎮 Instalación automática del doblaje español
- 🖥️ Interfaz gráfica intuitiva y fácil de usar
- 📁 Detección automática del directorio del juego
- ✅ Verificación de integridad de archivos
- 🔄 Proceso de instalación con barra de progreso
- 🛡️ Respaldo automático de archivos originales

## 🔧 Tecnologías Utilizadas

- **Electron** - Framework para aplicaciones de escritorio
- **Node.js** - Runtime de JavaScript
- **HTML/CSS/JavaScript** - Interfaz de usuario
- **fs-extra** - Operaciones avanzadas del sistema de archivos

## 📋 Requisitos del Sistema

- **Sistema Operativo:** Windows 7/8/10/11 (64-bit)
- **Espacio en Disco:** Al menos 2 GB libres
- **Kingdom Hearts 0.2:** Debe estar instalado previamente
- **Permisos:** Acceso de administrador (recomendado)

## 🚀 Instalación y Uso

### Para Usuarios

1. Descarga el archivo `KH02-EcosDelDoblaje.exe` desde la sección de releases
2. Ejecuta el instalador como administrador
3. Sigue las instrucciones en pantalla
4. Selecciona el directorio donde está instalado Kingdom Hearts 0.2
5. Haz clic en "Instalar" y espera a que termine el proceso

### Para Desarrolladores

#### Prerrequisitos

- Node.js (versión 16 o superior)
- npm o yarn
- Git

#### Configuración del Entorno de Desarrollo

```bash
# Clonar el repositorio
git clone [URL_DEL_REPOSITORIO]
cd KHESPMIX02

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm start

# Construir la aplicación
npm run build

# Crear distributable
npm run dist
```

## 📁 Estructura del Proyecto

```
KHESPMIX02/
├── src/
│   ├── main.js          # Proceso principal de Electron
│   ├── renderer.js      # Lógica del renderizador
│   ├── index.html       # Interfaz principal
│   └── styles.css       # Estilos de la aplicación
├── assets/
│   └── icon.ico         # Icono de la aplicación
├── package.json         # Configuración del proyecto
├── .gitignore          # Archivos ignorados por Git
└── README.md           # Este archivo
```

## 🛠️ Scripts Disponibles

- `npm start` - Ejecuta la aplicación en modo desarrollo
- `npm run build` - Construye la aplicación para producción
- `npm run dist` - Crea el ejecutable distribuible

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Para contribuir:

1. Haz fork del proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Changelog

### v1.0.0
- Lanzamiento inicial del instalador
- Interfaz gráfica completa
- Instalación automática del doblaje
- Verificación de integridad de archivos

## 🐛 Reporte de Errores

Si encuentras algún problema:

1. Verifica que tu sistema cumple con los requisitos mínimos
2. Busca en los issues existentes si el problema ya fue reportado
3. Si no existe, crea un nuevo issue con:
   - Descripción detallada del problema
   - Pasos para reproducir el error
   - Información del sistema (OS, versión del juego, etc.)
   - Screenshots si es aplicable

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Equipo

**Ecos del Doblaje** - Equipo de doblaje español para videojuegos

## 🙏 Agradecimientos

- Al equipo de desarrollo de Kingdom Hearts
- A la comunidad de modding de Kingdom Hearts
- A todos los colaboradores y testers del proyecto

## 📞 Contacto

Para más información sobre el proyecto o el equipo de Ecos del Doblaje, visita nuestras redes sociales.

---

⭐ Si este proyecto te ha sido útil, ¡no olvides darle una estrella!
