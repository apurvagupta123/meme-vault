#!/usr/bin/env python3
"""
Trim a video clip and burn in a meme caption using ffmpeg.

Usage:
  python3 make_video_meme.py --in source.mp4 --out result.mp4 \
      --start 00:00:03 --duration 5 --caption "WHEN THE MARKET OPENS"

Requires ffmpeg on PATH.
Only use video you have the rights to use / that's licensed for reuse
(YouTube Creative Commons, stock sites, or your own footage) — check
before publishing anything sourced from a random upload.
"""
import argparse
import subprocess
import shlex

FONT_PATH = "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", required=True)
    ap.add_argument("--out", dest="outfile", required=True)
    ap.add_argument("--start", default="00:00:00", help="start timestamp, e.g. 00:00:03")
    ap.add_argument("--duration", default="5", help="clip length in seconds")
    ap.add_argument("--caption", default="", help="text burned in at the bottom")
    ap.add_argument("--max-width", default="720", help="output width in px (height auto)")
    args = ap.parse_args()

    vf_parts = [f"scale={args.max_width}:-2"]
    if args.caption:
        text = args.caption.upper().replace("'", "’").replace(":", "\\:")
        drawtext = (
            f"drawtext=fontfile={FONT_PATH}:text='{text}':"
            "fontcolor=white:fontsize=h/14:borderw=4:bordercolor=black:"
            "x=(w-text_w)/2:y=h-th-30"
        )
        vf_parts.append(drawtext)

    vf = ",".join(vf_parts)

    cmd = [
        "ffmpeg", "-y",
        "-ss", args.start,
        "-i", args.infile,
        "-t", str(args.duration),
        "-vf", vf,
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        args.outfile,
    ]
    print("Running:", " ".join(shlex.quote(c) for c in cmd))
    subprocess.run(cmd, check=True)
    print(f"Saved: {args.outfile}")


if __name__ == "__main__":
    main()
