import httpx
import asyncio
import logging
from typing import Optional
from urllib.parse import quote

logger = logging.getLogger(__name__)

POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/"


async def generate_image(
    prompt: str,
    seed: Optional[int] = None,
    width: int = 1920,
    height: int = 1080,
    retries: int = 3,
    delay: int = 2,
) -> Optional[bytes]:
    encoded = quote(prompt)
    url = f"{POLLINATIONS_BASE.rstrip('/')}/{encoded}"
    params = {}
    if seed is not None:
        params["seed"] = seed
    params["width"] = width
    params["height"] = height
    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"

    for attempt in range(1, retries + 1):
        try:
            async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
                resp = await client.get(url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    logger.info(f"Image generated (attempt {attempt}): {len(resp.content)} bytes")
                    return resp.content
                else:
                    logger.warning(f"Attempt {attempt}: status {resp.status_code}, size {len(resp.content)}")
        except httpx.TimeoutException:
            logger.warning(f"Attempt {attempt}: timeout for prompt: {prompt[:50]}")
        except Exception as e:
            logger.warning(f"Attempt {attempt}: {e}")
        if attempt < retries:
            await asyncio.sleep(delay * attempt)

    logger.error(f"All {retries} attempts failed for prompt: {prompt[:50]}")
    return None
