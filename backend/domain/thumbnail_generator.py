import os
import logging
import textwrap
import math

logger = logging.getLogger(__name__)


async def generate_thumbnail(story: dict, project_dir: str, progress_callback=None) -> str:
    thumb_dir = os.path.join(project_dir, "thumbnail")
    os.makedirs(thumb_dir, exist_ok=True)
    output_path = os.path.join(thumb_dir, "thumbnail.png")

    thumbnail_text = story.get("thumbnail_text", story.get("title", "Video Title"))
    topic = story.get("topic", "Topic")

    try:
        from PIL import Image, ImageDraw, ImageFont, ImageFilter

        width, height = 1280, 720

        img = Image.new("RGB", (width, height), color=(10, 10, 30))
        draw = ImageDraw.Draw(img)

        for y in range(height):
            r = int(10 + (y / height) * 30)
            g = int(10 + (y / height) * 20)
            b = int(30 + (y / height) * 60)
            for x in range(width):
                r2 = int(r + 20 * math.sin(x * 0.01) * math.sin(y * 0.01))
                g2 = int(g + 10 * math.cos(x * 0.015) * math.sin(y * 0.008))
                b2 = int(b + 30 * math.sin(x * 0.012) * math.cos(y * 0.01))
                r2 = max(0, min(255, r2))
                g2 = max(0, min(255, g2))
                b2 = max(0, min(255, b2))
                draw.point((x, y), fill=(r2, g2, b2))

        accent_color = (255, 200, 50)

        draw.rectangle([0, height - 8, width, height], fill=accent_color)

        try:
            font_title = ImageFont.truetype("arialbd.ttf", 64)
            font_sub = ImageFont.truetype("arial.ttf", 32)
            font_small = ImageFont.truetype("arial.ttf", 20)
        except (OSError, IOError):
            try:
                font_title = ImageFont.truetype("arial.ttf", 56)
                font_sub = ImageFont.truetype("arial.ttf", 28)
                font_small = ImageFont.truetype("arial.ttf", 18)
            except (OSError, IOError):
                font_title = ImageFont.load_default()
                font_sub = ImageFont.load_default()
                font_small = ImageFont.load_default()

        wrapped = textwrap.wrap(thumbnail_text, width=20)
        y_pos = 180
        for line in wrapped:
            try:
                bbox = draw.textbbox((0, 0), line, font=font_title)
                lw = bbox[2] - bbox[0]
            except (AttributeError, TypeError):
                lw = len(line) * 32
            draw.text(((width - lw) / 2, y_pos), line, fill=(255, 255, 255), font=font_title)
            y_pos += 75

        try:
            sub_text = f"Explore: {topic}"
            bbox = draw.textbbox((0, 0), sub_text, font=font_sub)
            sw = bbox[2] - bbox[0]
        except (AttributeError, TypeError):
            sw = len(sub_text) * 16
        draw.text(((width - sw) / 2, y_pos + 40), sub_text, fill=(200, 200, 255), font=font_sub)

        cta_text = "▶  WATCH NOW"
        try:
            bbox = draw.textbbox((0, 0), cta_text, font=font_sub)
            cw = bbox[2] - bbox[0]
        except (AttributeError, TypeError):
            cw = len(cta_text) * 16
        bx = (width - cw) // 2 - 20
        by = y_pos + 120
        draw.rounded_rectangle([bx - 10, by - 10, bx + cw + 30, by + 50], radius=15, fill=accent_color)
        draw.text((bx + 10, by + 5), cta_text, fill=(0, 0, 0), font=font_sub)

        accent_line_y = 80
        draw.rectangle([width // 4, accent_line_y, 3 * width // 4, accent_line_y + 4], fill=accent_color)

        img.save(output_path, "PNG", optimize=True)
        logger.info(f"Thumbnail generated: {output_path}")

    except ImportError:
        with open(os.path.join(thumb_dir, "thumbnail.txt"), "w", encoding="utf-8") as f:
            f.write(f"Thumbnail: {thumbnail_text}\n")
            f.write(f"Style: High contrast, cinematic\n")
            f.write(f"Topic: {topic}\n")
            f.write(f"Colors: Dark gradient with amber accent\n")
        output_path = os.path.join(thumb_dir, "thumbnail.txt")
        logger.info(f"Thumbnail info saved (Pillow not available): {output_path}")

    if progress_callback:
        await progress_callback("GENERATING_THUMBNAIL", 100)

    return output_path
