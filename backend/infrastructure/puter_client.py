import httpx
import asyncio
import logging
from typing import Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

PUTER_API_URL = "https://api.puter.com/v2/images/generate"


async def generate_image(
    prompt: str,
    seed: Optional[int] = None,
    width: int = 1920,
    height: int = 1080,
    retries: int = 3,
    delay: int = 2,
) -> Optional[bytes]:
    for attempt in range(1, retries + 1):
        try:
            payload = {
                "prompt": prompt,
                "width": width,
                "height": height,
                "model": "dall-e-3",
                "n": 1,
            }
            if seed is not None:
                payload["seed"] = seed

            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(PUTER_API_URL, json=payload)
                if resp.status_code == 200:
                    data = resp.json()
                    if "data" in data and len(data["data"]) > 0:
                        image_url = data["data"][0].get("url")
                        if image_url:
                            img_resp = await client.get(image_url)
                            if img_resp.status_code == 200 and len(img_resp.content) > 1000:
                                logger.info(f"Puter image generated (attempt {attempt}): {len(img_resp.content)} bytes")
                                return img_resp.content
                else:
                    logger.warning(f"Puter attempt {attempt}: status {resp.status_code}")
        except httpx.TimeoutException:
            logger.warning(f"Puter attempt {attempt}: timeout")
        except Exception as e:
            logger.warning(f"Puter attempt {attempt}: {e}")
        if attempt < retries:
            await asyncio.sleep(delay * attempt)

    logger.error(f"All Puter attempts failed for prompt: {prompt[:50]}")
    return None
