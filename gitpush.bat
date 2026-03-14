@echo off
cd /d "%~dp0"
git add .
git commit -m "update security"
git push
echo Done!
pause