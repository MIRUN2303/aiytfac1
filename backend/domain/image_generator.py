import os
import asyncio
import logging

from infrastructure.pollinations_client import generate_image as pollinations_generate
from infrastructure.puter_client import generate_image as puter_generate

logger = logging.getLogger(__name__)


async def generate_scene_images(scenes: list, project_dir: str, progress_callback=None) -> list:
    images_dir = os.path.join(project_dir, "images")
    os.makedirs(images_dir, exist_ok=True)

    prompt_cache = {}
    total = len(scenes)
    results = []

    for i, scene in enumerate(scenes):
        prompt = scene.get("image_prompt", "cinematic scene")
        filename = f"{i + 1:03d}.png"
        filepath = os.path.join(images_dir, filename)

        if prompt in prompt_cache:
            cached_path = prompt_cache[prompt]
            import shutil
            if os.path.exists(cached_path):
                shutil.copy2(cached_path, filepath)
                results.append({"scene": i + 1, "path": filepath, "prompt": prompt, "cached": True})
                if progress_callback:
                    await progress_callback("GENERATING_IMAGES", int((i + 1) / total * 100))
                continue

        if os.path.exists(filepath):
            results.append({"scene": i + 1, "path": filepath, "prompt": prompt, "cached": True})
            if progress_callback:
                await progress_callback("GENERATING_IMAGES", int((i + 1) / total * 100))
            continue

        image_data = None

        try:
            image_data = await pollinations_generate(prompt, seed=i + 1, width=1920, height=1080)
        except Exception as e:
            logger.warning(f"Pollinations failed for scene {i + 1}: {e}")

        if not image_data:
            try:
                image_data = await puter_generate(prompt, seed=i + 1, width=1920, height=1080)
            except Exception as e:
                logger.warning(f"Puter fallback failed for scene {i + 1}: {e}")

        if image_data and len(image_data) > 1000:
            with open(filepath, "wb") as f:
                f.write(image_data)
            results.append({"scene": i + 1, "path": filepath, "prompt": prompt, "cached": False})
            prompt_cache[prompt] = filepath
            logger.info(f"Scene {i + 1} image saved: {filepath}")
        else:
            placeholder = _generate_placeholder_image(filepath, i + 1, prompt)
            if placeholder:
                results.append({"scene": i + 1, "path": filepath, "prompt": prompt, "placeholder": True})
            else:
                failed_path = os.path.join(images_dir, f"{i + 1:03d}_failed.txt")
                with open(failed_path, "w", encoding="utf-8") as f:
                    f.write(f"Image generation failed for scene {i + 1}: {prompt}")
                results.append({"scene": i + 1, "path": None, "prompt": prompt, "failed": True})

        if progress_callback:
            await progress_callback("GENERATING_IMAGES", int((i + 1) / total * 100))

        await asyncio.sleep(0.5)

    return results


def _generate_placeholder_image(filepath: str, scene_num: int, prompt: str) -> bool:
    try:
        from PIL import Image, ImageDraw, ImageFont
        import textwrap

        img = Image.new("RGB", (1920, 1080), color=(20, 20, 40))
        draw = ImageDraw.Draw(img)

        try:
            font_large = ImageFont.truetype("arial.ttf", 48)
            font_small = ImageFont.truetype("arial.ttf", 24)
        except (OSError, IOError):
            font_large = ImageFont.load_default()
            font_small = ImageFont.load_default()

        draw.rectangle([0, 0, 1920, 1080], fill=(20, 20, 40))
        draw.rectangle([40, 40, 1880, 1040], outline=(60, 60, 120), width=3)

        title_text = f"Scene {scene_num}"
        try:
            bbox = draw.textbbox((0, 0), title_text, font=font_large)
            tw = bbox[2] - bbox[0]
        except (AttributeError, TypeError):
            tw = len(title_text) * 24
        draw.text(((1920 - tw) / 2, 200), title_text, fill=(200, 200, 255), font=font_large)

        wrapped = textwrap.wrap(prompt[:200], width=60)
        y = 400
        for line in wrapped:
            try:
                bbox = draw.textbbox((0, 0), line, font=font_small)
                lw = bbox[2] - bbox[0]
            except (AttributeError, TypeError):
                lw = len(line) * 12
            draw.text(((1920 - lw) / 2, y), line, fill=(180, 180, 220), font=font_small)
            y += 35

        draw.text((960, 800), "Placeholder - Image generation unavailable", fill=(100, 100, 160),
                  font=font_small, anchor="mt")

        img.save(filepath, "PNG")
        logger.info(f"Placeholder image created: {filepath}")
        return True
    except Exception as e:
        logger.error(f"Failed to create placeholder image: {e}")
        return False
