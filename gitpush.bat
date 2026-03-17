@echo off
cd /d "%~dp0"
git add .
git commit -m "update animation UI Vocab Checker SlideBar"
git push
workbox injectManifest workbox-config.js
echo Done!
pause