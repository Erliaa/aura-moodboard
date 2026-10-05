@echo off
chcp 65001 >nul
setlocal
set "AURA_DIR=%~dp0"
set "AURA_PATHFILE=%TEMP%\aura_path.tmp"

rem Serve l'amministratore: electron-builder deve estrarre un archivio che contiene collegamenti simbolici
net session >nul 2>&1
if %errorlevel% neq 0 goto elevate
goto start

:elevate
echo Richiedo i permessi di amministratore...
rem Salvo il PATH di questa finestra: quella da amministratore potrebbe non averlo
powershell -NoProfile -Command "[IO.File]::WriteAllText($env:AURA_PATHFILE, $env:PATH)" >nul 2>&1
powershell -NoProfile -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
exit /b

:start
pushd "%AURA_DIR%" 2>nul
if errorlevel 1 goto nodir
if exist "%AURA_PATHFILE%" for /f "usebackq delims=" %%P in ("%AURA_PATHFILE%") do set "PATH=%%P"
del "%AURA_PATHFILE%" >nul 2>&1

rem Cerco il progetto: deve esserci package.json (anche in una sottocartella, se lo zip e' stato estratto dentro un'altra cartella)
if exist "package.json" goto okdir
if exist "aura-moodboard\package.json" goto sub
goto nopkg
:sub
cd aura-moodboard

:okdir
where npm >nul 2>&1 && goto havenpm
if exist "%ProgramFiles%\nodejs\npm.cmd" set "PATH=%ProgramFiles%\nodejs;%PATH%"
where npm >nul 2>&1 && goto havenpm
if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
where npm >nul 2>&1 && goto havenpm
if exist "%LOCALAPPDATA%\Programs\nodejs\npm.cmd" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"
where npm >nul 2>&1 && goto havenpm
goto nonode

:havenpm
taskkill /f /im "AURA moodboard.exe" >nul 2>&1
taskkill /f /im electron.exe >nul 2>&1
set "PROJ=%CD%"
rem Cartella di lavoro NUOVA ogni volta (nome casuale): non cancella mai nulla di preesistente
set "BUILD=C:\aura-work-%RANDOM%%RANDOM%"

echo.
echo  AURA moodboard - creazione dell'installer per Windows
echo  ----------------------------------------------------
echo  Cartella del progetto: %PROJ%
echo  Costruisco in una cartella di lavoro separata: %BUILD%
echo  (esclusa da Windows Defender solo per il tempo della costruzione, poi riattivata)
echo  (la prima volta puo' servire qualche minuto)
echo.
powershell -NoProfile -Command "try { Add-MpPreference -ExclusionPath '%BUILD%' } catch {}" >nul 2>&1
robocopy "%PROJ%" "%BUILD%" /E /XD node_modules dist .git /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto copyfail
cd /d "%BUILD%"
set "TRY=1"

:build
call npm install
if errorlevel 1 goto errore
call npm run dist
if errorlevel 1 goto failed
goto done

:failed
if "%TRY%"=="2" goto errore
set "TRY=2"
echo.
echo  Primo tentativo non riuscito: pulisco la cache di Electron e riprovo...
rmdir /s /q "%LOCALAPPDATA%\electron\Cache" >nul 2>&1
rmdir /s /q dist >nul 2>&1
goto build

:done
if not exist "%PROJ%\dist" mkdir "%PROJ%\dist"
copy /y dist\*.exe "%PROJ%\dist\" >nul 2>&1
copy /y dist\*.yml "%PROJ%\dist\" >nul 2>&1
copy /y dist\*.blockmap "%PROJ%\dist\" >nul 2>&1
cd /d "%PROJ%"
powershell -NoProfile -Command "try { Remove-MpPreference -ExclusionPath '%BUILD%' } catch {}" >nul 2>&1
rmdir /s /q "%BUILD%" >nul 2>&1
echo.
echo  Fatto! L'installer e' nella cartella "%PROJ%\dist".
explorer "%PROJ%\dist"
pause
exit /b 0

:copyfail
powershell -NoProfile -Command "try { Remove-MpPreference -ExclusionPath '%BUILD%' } catch {}" >nul 2>&1
rmdir /s /q "%BUILD%" >nul 2>&1
echo.
echo  Non riesco a copiare il progetto in %BUILD%.
echo  Controlla di avere spazio libero su C: e riprova.
pause
exit /b 1

:nodir
echo.
echo  Non riesco ad aprire la cartella di questo file.
echo  Se hai fatto doppio clic dentro lo zip, estrai prima tutto (tasto destro, "Estrai tutto")
echo  e lancia il file dalla cartella estratta.
pause
exit /b 1

:nopkg
echo.
echo  Non trovo package.json vicino a questo file (cartella: %CD%).
echo  Lancia crea-installer.bat dalla cartella estratta di AURA moodboard,
echo  quella che contiene package.json e la cartella src.
pause
exit /b 1

:nonode
echo.
echo  Non trovo Node.js (il comando npm).
echo  Installa la versione LTS da https://nodejs.org, poi riavvia il PC
echo  e rilancia questo file.
pause
exit /b 1

:errore
echo.
echo  --- Diagnosi ---
echo  Cartella di lavoro: %CD%
echo  File .exe presenti in dist\win-unpacked:
dir /b "dist\win-unpacked" 2>nul | findstr /i "\.exe"
echo  Ultimi rilevamenti di Windows Defender:
powershell -NoProfile -Command "try { Get-MpThreatDetection | Sort-Object InitialDetectionTime -Descending | Select-Object -First 3 | ForEach-Object { $_.Resources -join '; ' } } catch {}"
echo  ----------------
cd /d "%PROJ%"
powershell -NoProfile -Command "try { Remove-MpPreference -ExclusionPath '%BUILD%' } catch {}" >nul 2>&1
rmdir /s /q "%BUILD%" >nul 2>&1
echo.
echo  Qualcosa e' andato storto: copia il messaggio qui sopra (comprese le righe della diagnosi) e mandalo a Claude.
echo.
echo  Se l'errore parla ancora di electron.exe che non si trova, il responsabile e'
echo  quasi sempre un antivirus: se ne usi uno diverso da Windows Defender (Avast, Norton,
echo  McAfee...), disattivalo per qualche minuto e rilancia questo file.
pause
exit /b 1
