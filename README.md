# Set4U

Set4U is an installable, offline-first setlist manager made for live performance. It comes with ready-made wedding sets and spares that any musician or band can edit, replace or use as a starting point for their own show.

## What it does

- Build, rename, duplicate and reorder setlists
- Keep artist, key, BPM, performance notes and a private Performance Sheet against each song
- Upload `.txt` or `.md` sheets and auto-scroll them at a saved per-song speed in Live Mode
- Run a distraction-free Live Mode with previous and next controls
- Work offline once it has been opened
- Install to an Android, iPhone, tablet or computer home screen
- Export and import a JSON backup
- Store everything locally on the device, with no account required

Every installation is independent: one user’s songs, running orders and private Performance Sheets are never shown to another user.

No copyrighted text is bundled with the app. Performance Sheets stay on the device unless the performer deliberately includes them in a backup.

## Run locally

Serve the repository over HTTP so that modules and the service worker can load:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Checks

```bash
npm run check
```

## Deployment

Every push to `main` runs the checks and deploys the static app with GitHub Pages. The expected project URL is:

`https://colcombemitchell-oss.github.io/Set4U/`

The workflow follows GitHub’s official Pages artifact deployment pattern. GitHub Pages must use **GitHub Actions** as its publishing source in the repository settings.

The custom `Set4U.co.uk` address can be attached later once its DNS records are ready; a `CNAME` file is deliberately not included yet so it cannot interrupt the working GitHub Pages address.

