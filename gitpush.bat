@echo off
cd /d "%~dp0"
git add .
git commit -m "new update tai_xiu"
git push
workbox injectManifest workbox-config.js
echo Done!
pause