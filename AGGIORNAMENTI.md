# Aggiornamenti automatici di AURA moodboard: la guida dalla A alla Z

## Come funziona (in breve)
1. Tu pubblichi una nuova versione su GitHub (nella sezione "Releases").
2. L'app installata sul tuo PC (o di altri) controlla all'avvio se c'è una versione più nuova.
3. Se c'è, la scarica in background e mostra in basso a sinistra "Versione X pronta · Riavvia e aggiorna".
4. Se non clicchi, si installa da sola alla chiusura successiva. I tuoi dati (canvas, immagini, brani) non vengono toccati.

Gli aggiornamenti funzionano **solo nell'app installata** (non con `npm start`) e solo dopo aver configurato il repository (passo 3).

## Cosa ti serve
- Un account GitHub gratuito (github.com).
- Un repository **pubblico** (ci metti solo gli installer, non serve caricare il codice).
- Un "token" di GitHub per pubblicare dal tuo PC.

## Configurazione, una volta sola
1. **Crea l'account** su github.com e accedi.
2. **Crea un repository**: pulsante "New", nome `aura-moodboard`, visibilità **Public**, senza README. Clic su "Create repository".
3. **Scrivi il tuo nome utente** nel file `package.json`: nella sezione `build > publish` sostituisci `TUO-UTENTE-GITHUB` con il tuo nome utente GitHub (e controlla che `repo` sia `aura-moodboard`). Finché resta il segnaposto, gli aggiornamenti sono disattivati.
4. **Crea il token**: GitHub > tua foto in alto a destra > Settings > Developer settings > Personal access tokens > *Tokens (classic)* > Generate new token (classic). Nome a piacere, scadenza a piacere, spunta **repo**. Copia il token (lo vedi una volta sola).
5. **Salvalo sul PC**: apri PowerShell e scrivi (con il tuo token) `setx GH_TOKEN "il_tuo_token"`. Poi **chiudi e riapri** VS Code/il terminale.

## Pubblicare una versione (ogni volta)
1. In `package.json` **aumenta il numero di `version`** (es. da 0.3.0 a 0.3.1). Deve essere sempre maggiore di quella installata, altrimenti l'app non vede l'aggiornamento.
2. Nel terminale (come amministratore, come per l'installer) scrivi: `npm run release`.
3. Il programma costruisce l'installer e lo carica su GitHub come **bozza** di release, insieme ai file `latest.yml` e `.blockmap` (servono all'app per riconoscere l'aggiornamento: non cancellarli).
4. Vai su github.com/TUO-UTENTE/aura-moodboard/releases, apri la bozza e premi **Publish release**.
5. Fatto: chi ha l'app installata riceverà l'aggiornamento al prossimo avvio.

## La prima installazione
Chi non ha ancora l'app deve installarla una volta dall'installer `AURA-moodboard-Setup-x.y.z.exe` (scaricabile dalla pagina Releases). Solo le versioni installate **dopo** aver configurato il passo 3 sanno aggiornarsi: se hai già installato la 0.2.0 o una build senza repository, reinstalla una volta a mano.

## Cose da sapere
- **SmartScreen**: Windows mostra "Windows ha protetto il PC" alla prima installazione perché l'installer non è firmato (la firma costa circa 100–400 euro l'anno). Gli aggiornamenti successivi, fatti dall'app, non mostrano l'avviso.
- **Licenza dei font**: Fabrikat Mono è la versione *Trial*. Se pubblichi l'app su un repository pubblico la stai distribuendo: prima compra la licenza completa, oppure sostituisci il font.
- **Copyright dei contenuti**: i brani e le immagini che importi restano sul tuo PC, non vengono mai caricati.
- **Connessione**: senza internet l'app funziona normalmente, semplicemente non controlla gli aggiornamenti.
- **Se non vuoi aggiornamenti automatici**: lascia `TUO-UTENTE-GITHUB` e reinstalla a mano quando vuoi.
- **Repository privato**: possibile, ma ogni copia dell'app dovrebbe contenere il token; per questo non lo consiglio.
- **Problemi**: Impostazioni (ingranaggio in alto a destra) > "Controlla aggiornamenti" ti dice se la funzione è attiva. Se `npm run release` dà errore di autenticazione, controlla che `GH_TOKEN` sia impostato (riapri il terminale dopo `setx`).
