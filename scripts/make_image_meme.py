#!/usr/bin/env python3
"""
Caption an image in classic meme style (bold white text, black outline,
top and/or bottom banner).

Usage:
  python3 make_image_meme.py --in source.jpg --out result.jpg \
      --top "TOP TEXT" --bottom "BOTTOM TEXT"
"""
import argparse
import textwrap
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf"


def fit_font(draw, text, max_width, start_size, min_size=18):
    size = start_size
    while size > min_size:
        font = ImageFont.truetype(FONT_PATH, size)
        bbox = draw.textbbox((0, 0), text, font=font)
        if bbox[2] - bbox[0] <= max_width:
            return font
        size -= 2
    return ImageFont.truetype(FONT_PATH, min_size)


def draw_outlined_text(draw, xy, text, font, fill="white", outline="black", outline_w=3):
    x, y = xy
    for dx in range(-outline_w, outline_w + 1):
        for dy in range(-outline_w, outline_w + 1):
            if dx or dy:
                draw.text((x + dx, y + dy), text, font=font, fill=outline)
    draw.text((x, y), text, font=font, fill=fill)


def add_caption_block(img, text, position, draw):
    if not text:
        return img
    w, h = img.size
    max_width = int(w * 0.92)
    wrapped = textwrap.fill(text.upper(), width=20)
    lines = wrapped.split("\n")

    font_size = int(h * 0.11)
    font = fit_font(draw, max(lines, key=len), max_width, font_size)

    line_heights = []
    total_h = 0
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font)
        lh = bbox[3] - bbox[1]
        line_heights.append(lh)
        total_h += lh + 8

    if position == "top":
        y = int(h * 0.03)
    else:
        y = h - total_h - int(h * 0.05)

    for line, lh in zip(lines, line_heights):
        bbox = draw.textbbox((0, 0), line, font=font)
        lw = bbox[2] - bbox[0]
        x = (w - lw) / 2
        draw_outlined_text(draw, (x, y), line, font)
        y += lh + 8

    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="infile", required=True)
    ap.add_argument("--out", dest="outfile", required=True)
    ap.add_argument("--top", default="")
    ap.add_argument("--bottom", default="")
    args = ap.parse_args()

    img = Image.open(args.infile).convert("RGB")
    draw = ImageDraw.Draw(img)
    add_caption_block(img, args.top, "top", draw)
    add_caption_block(img, args.bottom, "bottom", draw)
    img.save(args.outfile, quality=92)
    print(f"Saved: {args.outfile}")


if __name__ == "__main__":
    main()
