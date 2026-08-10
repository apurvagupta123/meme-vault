#!/usr/bin/env python3
"""
Register a finished meme file into memes.json and copy it into memes/.

Usage:
  python3 add_meme.py --file result.jpg --title "Market open be like" \
      --type image --tags "finance,nifty" --caption "Every single day."

  --type is one of: image, gif, video
"""
import argparse
import json
import shutil
import datetime
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent.parent
MEMES_DIR = SITE_DIR / "memes"
MANIFEST = SITE_DIR / "memes.json"


def slugify(s):
    return "".join(c.lower() if c.isalnum() else "-" for c in s).strip("-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True, help="path to the finished meme file")
    ap.add_argument("--title", required=True)
    ap.add_argument("--type", choices=["image", "gif", "video"], default="image")
    ap.add_argument("--tags", default="", help="comma-separated tags")
    ap.add_argument("--caption", default="")
    args = ap.parse_args()

    src = Path(args.file)
    if not src.exists():
        raise SystemExit(f"File not found: {src}")

    MEMES_DIR.mkdir(exist_ok=True)
    slug = slugify(args.title)[:40] or "meme"
    dest_name = f"{slug}-{int(datetime.datetime.now().timestamp())}{src.suffix}"
    dest = MEMES_DIR / dest_name
    shutil.copy2(src, dest)

    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else []
    manifest.append({
        "id": dest_name,
        "title": args.title,
        "type": args.type,
        "src": dest_name,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()],
        "caption": args.caption,
        "date": datetime.date.today().isoformat(),
    })
    MANIFEST.write_text(json.dumps(manifest, indent=2))
    print(f"Added '{args.title}' -> memes/{dest_name}")


if __name__ == "__main__":
    main()
