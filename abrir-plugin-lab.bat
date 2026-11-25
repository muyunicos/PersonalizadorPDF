@echo off
REM Abre el plugin Personalizador PDF en el lab (localhost:8091) con sesion iniciada.
REM Doble clic o:  abrir-plugin-lab.bat
setlocal
node "%~dp0scripts\abrir-plugin-lab.js" %*
endlocal