# AURA moodboard

## Provarla senza installare
    npm install
    npm start

## Creare l'installer per Windows
Doppio clic su `crea-installer.bat` (oppure `npm install` e poi `npm run dist`).
L'installer compare in `dist/` con il nome `AURA-moodboard-Setup-<versione>.exe`.
Versione portatile (senza installazione): `npm run dist:portable`.

Se compare l'errore "Cannot create symbolic link", attiva la Modalità sviluppatore di Windows
(Impostazioni > Privacy e sicurezza > Per sviluppatori) oppure apri il terminale come amministratore, poi riprova.

## Aggiornamenti automatici
Vedi `AGGIORNAMENTI.md` (guida completa).

## Dati dell'app
Canvas, cartelle e file importati restano in %APPDATA%\AURA moodboard (non vengono cancellati disinstallando).

## Scorciatoie
Ctrl+Alt+D modalità design · Ctrl+Alt+H mostra/nascondi l'app · Ctrl+Alt+C versione compatta · Alt+rotella zoom · tasto centrale o Spazio+trascina per spostarsi
Ctrl+Z / Ctrl+Alt+Z annulla e ripristina · Ctrl+C/X/V/D copia, taglia, incolla, duplica · Alt+trascina copia
Maiusc+numero (1-9) apre il canvas con quel numero · Maiusc+W presentazione (per uscire: Esc, Maiusc+W o la X in alto a destra) · tasto destro sul canvas = menu rapido
Maiusc mentre trascini = movimento dritto con calamita sui bordi/centri degli altri elementi · Maiusc mentre ruoti = scatti da 15° · Ridimensionamento: di base in proporzione, tieni premuto Maiusc mentre trascini un angolo per ridimensionare libero (vale anche per la selezione multipla); si può invertire con la casella "Ridimensiona in proporzione" nel pannello o nel menu a tasto destro (spenta = libero, Maiusc = in proporzione)
Selezione multipla: compare un riquadro con maniglie per ridimensionare in proporzione e ruotare tutto insieme (Maiusc = scatti da 15°)
Allinea: scegli disposizione (righe, griglia, cascata, riga, colonna), spazio, ordine; con più elementi selezionati puoi anche allineare i bordi e distribuire
Ctrl+U accende/spegne le guide automatiche: mentre sposti foto o video compaiono linee che si agganciano a bordi e centri degli altri elementi
Forme: doppio clic su un rettangolo/ellisse/tracciato per modificare i punti (trascina punti e lati, doppio clic su un lato aggiunge un punto, Canc toglie il punto selezionato, doppio clic su un punto = curva morbida, Esc per finire); Maiusc sul lato = spostamento libero
Penna (tasto P): clic = punto, trascina = curva, clic sul primo punto chiude, Invio finisce, Esc annulla, Maiusc = scatti da 45°
Frecce = sposta di 1 px, Maiusc+frecce = 10 px · Ctrl+] / Ctrl+[ porta avanti/indietro (con Maiusc: in primo piano / in fondo)

Nota: Fabrikat Mono è la versione "Trial" (HvD Fonts): serve la licenza completa per distribuire l'app.

Touch: un dito sposta e ridimensiona gli elementi, due dita spostano e zoomano il canvas, doppio tocco = doppio clic (modifica testo, punti di una forma, ritaglio). Se il canvas è vuoto la home mostra la pagina di benvenuto.
