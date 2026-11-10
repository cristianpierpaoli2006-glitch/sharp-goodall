# 📱 Personal Life Hub

> **Web Application personale per iPhone** — sviluppata con architettura offline-first, sincronizzazione cloud ibrida, classificazione intelligente con **Google Gemini**, supporto PWA standalone e zero dati pre-caricati.

---

## 🎯 Obiettivo del Progetto

**Personal Life Hub** è progettato specificamente per l'utilizzo quotidiano da smartphone iPhone (Safari / PWA Standalone).
Combina in un unico spazio minimale, rapido e sicuro:

1. **Dashboard Intelligente**: Vista verticale con avanzamento giornaliero, prossimi impegni, compiti in ritardo, inbox e wishlist.
2. **Quick Capture universale**: Pulsante centrale accessibile ovunque per salvare istantaneamente compiti, idee, link, ricette o note con classificazione automatica via **Gemini API** o motore euristico offline.
3. **Gestione Attività**: Filtri (Tutte, Oggi, Scadute, Future, Fatte), priorità colorate, orari, categorie e completamento a un tocco.
4. **Calendario Dinamico**: Viste Mese, Settimana e Giorno con indicatori visivi degli impegni e scadenze.
5. **Archivio Multi-modulo**:
   - **Inbox Universale**: Raccolta temporanea di pensieri o note grezze.
   - **Wishlist**: Prodotti desiderati con link, immagini, prezzi e preferiti.
   - **Link e Risorse**: Archivio siti, guide e video con categorie e note.
   - **Ricettario**: Ricette da provare, provate e preferite con tempi e difficoltà.
   - **Diario Personale**: Note e riflessioni private con date e preferiti.
   - **Idee**: Incubatore di idee con stati di maturazione (grezza, in sviluppo, pronta).
6. **Architettura Ibrida Offline-First**:
   - **Livello Locale**: IndexedDB tramite **Dexie.js** per accesso istantaneo senza rete.
   - **Livello Cloud**: **Supabase PostgreSQL** con Row Level Security (RLS) e sincronizzazione bidirezionale con coda persistente e risoluzione conflitti.
7. **Protezione e Portabilità Dati**:
   - Esportazione completa in file JSON scaricabile in locale.
   - Ripristino da backup JSON.
   - Reset dati locali controllato.

---

## 🛠️ Stack Tecnologico

- **Frontend**: React 18, TypeScript, Vite.
- **Stile & Layout**: Tailwind CSS (adattato per safe areas iPhone, notch e bottom bar).
- **Database Locale**: IndexedDB tramite Dexie.js e `dexie-react-hooks`.
- **Database Remoto & Auth**: Supabase PostgreSQL & Supabase Auth.
- **Intelligenza Artificiale**: Google Gemini API per la classificazione automatica in Quick Capture.
- **PWA & Offline**: Vite PWA Plugin, Service Worker (Workbox), manifest PWA, Apple Touch Icons.
- **Hosting Consigliato**: Cloudflare Pages / Vercel (Piani gratuiti al 100%).

---

## 🚀 Guida Rapida all'Avvio

### 1. Prerequisiti
- **Node.js** (versione 18 o superiore): scaricabile da [nodejs.org](https://nodejs.org).

### 2. Installazione delle dipendenze
Dalla cartella del progetto:
```bash
npm install
```

### 3. Configurazione Variabili d'Ambiente
Copia il file `.env.example` in `.env`:
```bash
cp .env.example .env
```
Inserisci le tue credenziali (opzionali per iniziare in locale, necessarie per il cloud sync e Gemini):
```env
VITE_SUPABASE_URL=https://tuo-progetto.supabase.co
VITE_SUPABASE_ANON_KEY=tua-chiave-pubblica-anon
VITE_GEMINI_API_KEY=tua-chiave-gemini
```
> *Nota*: Puoi anche inserire la chiave API di Gemini direttamente nelle **Impostazioni** dell'app senza dover modificare il file `.env`!

### 4. Configurazione Database Supabase da Zero
Se desideri attivare la sincronizzazione cloud:
1. Crea un progetto gratuito su [supabase.com](https://supabase.com).
2. Vai su **SQL Editor** nella dashboard di Supabase.
3. Copia e incolla l'intero contenuto del file:
   `src/db/remote/migrations/001_initial_schema.sql`
4. Clicca su **Run** per creare tutte le tabelle (`tasks`, `inbox_items`, `wishlist_items`, `links`, `recipes`, `diary_entries`, `ideas`, `categories`, `user_settings`) con le relative **Policy RLS** per proteggere i tuoi dati personali.

### 5. Avvio del Server di Sviluppo
```bash
npm run dev
```

### 6. Build per la Produzione
```bash
npm run build
```
I file compilati saranno pronti nella cartella `dist/`, pronti per essere pubblicati su **Cloudflare Pages** o **Vercel** trascinando la cartella o collegando il repository GitHub.

---

## 📲 Installazione su iPhone (Safari PWA)

L'app è ottimizzata specificamente per **iOS Safari**:
1. Apri l'indirizzo dell'applicazione su **Safari** dal tuo iPhone.
2. Tocca l'icona **Condividi** (il quadrato con la freccia verso l'alto al centro della barra in basso).
3. Scorri verso il basso e seleziona **Aggiungi alla schermata Home**.
4. Tocca **Aggiungi** in alto a destra.
5. Apri l'icona **Life Hub** dalla schermata Home per godere dell'esperienza a tutto schermo, senza barre del browser e utilizzabile anche offline!
