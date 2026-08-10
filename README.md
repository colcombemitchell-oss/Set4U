# Set4U

Set4U is an installable, offline-first setlist manager made for live performance. It includes Mitch’s two current 17-song sets and a wider repertoire ready to organise.

## What it does

- Build, rename, duplicate and reorder setlists
- Keep artist, key, BPM, performance notes and your own lyrics or chords against each song
- Run a distraction-free Live Mode with previous and next controls
- Work offline once it has been opened
- Install to an Android, iPhone, tablet or computer home screen
- Export and import a JSON backup
- Store everything locally on the device, with no account required

No copyrighted lyrics are bundled with the app. The lyrics and chords field is there for material the performer is entitled to use.

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
