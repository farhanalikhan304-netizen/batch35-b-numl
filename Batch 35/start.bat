@echo off
title CLASS HUB - Batch 35 BSSE
echo Starting CLASS HUB Local Server...
start http://localhost:3000/login.html
node server.js
pause
