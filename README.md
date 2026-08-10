# MemeVault

A 9GAG-style meme feed. Images, GIFs, and videos, tagged and searchable,
with public submissions and voting.

Live at: **meme.theapurva.com**

## How the backend works

The site itself is static (GitHub Pages). GitHub is the actual backend —
submissions become Issues, approved memes live in `memes.json` + `memes/`,
and vote tallies live in `votes.json`. Since GitHub requires a login to
write anything, a small Cloudflare Worker (`worker.js`, deployed at
`meme-api.theapurva.com`) holds a scoped GitHub token and relays visitor
submissions/votes into the repo on their behalf — so visitors need no
account at all.

- **Submit** (`submit.html`) → Worker `/api/submit` → uploads the file to
  `pending/` in this repo and opens a GitHub Issue labeled `submission` for
  review.
- **Vote** (up/down arrows on the feed) → Worker `/api/vote` → updates
  `votes.json` in this repo. One vote per browser (tracked via a random ID
  in localStorage).
- **Review queue** = the repo's Issues tab, filtered by the `submission`
  label. To publish one: download the attached file from the issue, run it
  through `scripts/make_image_meme.py` / `make_video_meme.py` +
  `scripts/add_meme.py` like normal, push, then close the issue.

## Structure

- `index.html`, `style.css`, `app.js` — the gallery itself
- `memes.json` — the list of memes (title, type, tags, caption, date)
- `memes/` — the actual image/gif/video files
- `scripts/make_image_meme.py` — caption an image, meme-style (top/bottom text)
- `scripts/make_video_meme.py` — trim a video clip and burn in a caption
- `scripts/add_meme.py` — register a finished file into `memes.json`

## Adding a new meme

1. Get your source image or video clip (your own, or something reuse-licensed —
   see note below on video).
2. Caption it:
   ```
   python3 scripts/make_image_meme.py --in source.jpg --out result.jpg \
     --top "TOP TEXT" --bottom "BOTTOM TEXT"
   ```
   or for video:
   ```
   python3 scripts/make_video_meme.py --in clip.mp4 --out result.mp4 \
     --start 00:00:03 --duration 5 --caption "CAPTION HERE"
   ```
3. Register it on the site:
   ```
   python3 scripts/add_meme.py --file result.jpg --title "Meme title" \
     --type image --tags "topic1,topic2" --caption "One-line joke/context"
   ```
4. Push to GitHub (see below) — the live site updates automatically.

In practice, just tell Claude the topic/idea and it'll find or generate the
source media, caption it, and add it for you.

## A note on video sources

Video clips pulled from YouTube/social media are often copyrighted. For
anything you plan to publish (not just keep private), stick to:
- your own footage
- Creative Commons–licensed clips
- stock/meme-template sites that explicitly allow reuse

Claude will flag this when sourcing video so you can decide per-clip.

## Publishing to meme.theapurva.com (GitHub Pages)

1. Push this folder to a new GitHub repo (e.g. `meme-vault`).
2. In the repo's Settings → Pages, set the source to the `main` branch, root folder.
3. This repo already includes a `CNAME` file set to `meme.theapurva.com`, which
   GitHub Pages uses to serve the custom domain.
4. At your domain registrar (wherever theapurva.com's DNS is managed), add a
   **CNAME record**: host `meme`, value `<your-github-username>.github.io`.
5. Wait for DNS to propagate (a few minutes to a few hours), then check
   "Enforce HTTPS" in the Pages settings once it's verified.

Every time you add a meme and push, the site updates — no rebuild step needed.
