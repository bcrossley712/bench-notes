# Bench Notes

A troubleshooting reference and work-order log for small engine repair —
built to capture 40+ years of hands-on knowledge before it walks out the
door, and to keep growing as new problems get solved.

Two apps, one shared data shape:

| | Where it runs | Best for |
|---|---|---|
| **[`/desktop`](./desktop)** | Windows desktop (Electron) | Lookup + detailed entry work at the bench, direct file storage |
| **[`/pwa`](./pwa)** | Android + iPhone (installed web app) | Adding entries and photos on the spot, works offline |

Each has its own README with setup/build/deploy instructions specific to
that app.

## Why two apps share a repo

They're not really two separate products — they're two front ends on the
same idea, and the entry format (title, causes, diagnostic steps, fix,
customer info, photos, etc.) needs to stay identical on both sides so
data can eventually move between them. Keeping them in one repo makes
that shared contract easy to see and hard to accidentally drift apart.

## Status

- [x] Desktop app — built, photo support added, not yet tested on real hardware
- [x] Mobile PWA — built, camera capture + offline support, not yet deployed/tested
- [x] Customer info fields (name, phone, equipment/serial, date received,
      customer request) added to both apps identically
- [ ] Sync between devices (planned: OneDrive-based, see each app's README)

## Repo structure

```
bench-notes/
├── pwa/            → deployed automatically to GitHub Pages via
│                      .github/workflows/deploy-pages.yml on every push
└── desktop/         → not deployed anywhere; built locally into a
                        Windows installer (see desktop/README.md)
```

## One-time GitHub Pages setup

After the first push to this repo:
1. Go to **Settings → Pages**
2. Under **Build and deployment → Source**, choose **GitHub Actions**
   (not "Deploy from a branch")
3. The included workflow will run automatically and give you a live URL
   within a minute or two

From then on, any push that touches files inside `/pwa` redeploys
automatically.
