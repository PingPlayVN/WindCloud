@echo off
cd /d "%~dp0"
git add .
git commit -m "improve"
git push
workbox injectManifest workbox-config.js
echo Done!
pause