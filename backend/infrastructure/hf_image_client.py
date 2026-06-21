import os
import httpx
import asyncio
import logging
import urllib.parse
from typing import Optional

logger = logging.getLogger(__name__)

HF_API_URL = "https://api-inference.huggingface.co/models"

# Primary: Stable Diffusion XL Base 1.0 — Free, very stable, no gating
DEFAULT_MODEL = "stabilityai/stable-diffusion-xl-base-1.0"
FALLBACK_MODELS = [
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-3.5-large-turbo",
    "runwayml/stable-diffusion-v1-5",
]

# Pollinations.ai — completely free, no API key required
POLLINATIONS_BASE = "https://image.pollinations.ai/prompt"


def _get_token() -> Optional[str]:
    token = os.environ.get("HF_TOKEN")
    if not token:
        token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    return token


async def _try_pollinations(prompt: str, seed: Optional[int], width: int, height: int) -> Optional[bytes]:
    """Fallback: Pollinations.ai — free, no API key, no rate limit for basic use."""
    try:
        encoded = urllib.parse.quote(prompt, safe="")
        params = f"?width={width}&height={height}&nologo=true&enhance=true"
        if seed is not None:
            params += f"&seed={seed}"
        url = f"{POLLINATIONS_BASE}/{encoded}{params}"
        async with httpx.AsyncClient(timeout=90.0, follow_redirects=True) as client:
            resp = await client.get(url)
            if resp.status_code == 200 and len(resp.content) > 500:
                logger.info(f"Pollinations image OK: {len(resp.content)} bytes")
                return resp.content
            logger.warning(f"Pollinations failed: status {resp.status_code}, size {len(resp.content)}")
    except Exception as e:
        logger.warning(f"Pollinations error: {e}")
    return None


async def generate_image(
    prompt: str,
    seed: Optional[int] = None,
    width: int = 1024,
    height: int = 768,
    model: Optional[str] = None,
    retries: int = 3,
    delay: int = 3,
) -> Optional[bytes]:
    token = _get_token()

    # Try HF only if token is available
    if token:
        models_to_try = [model] if model else [DEFAULT_MODEL] + FALLBACK_MODELS
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # FLUX.1-schnell uses different payload format
        def _build_payload(model_id: str) -> dict:
            if "FLUX" in model_id or "flux" in model_id:
                return {
                    "inputs": prompt,
                    "parameters": {
                        "num_inference_steps": 8,   # FLUX.1-schnell: 4=fast, 8=better quality
                        "guidance_scale": 0.0,       # FLUX.1-schnell is guidance-free
                        "width": width,
                        "height": height,
                    },
                }
            return {
                "inputs": prompt,
                "parameters": {
                    "negative_prompt": "text, watermark, logo, signature, ugly, deformed, blurry",
                    "num_inference_steps": 25,
                    "guidance_scale": 7.5,
                    "width": width,
                    "height": height,
                },
            }

        for model_id in models_to_try:
            if model_id is None:
                continue
            url = f"{HF_API_URL}/{model_id}"
            payload = _build_payload(model_id)
            for attempt in range(1, retries + 1):
                try:
                    async with httpx.AsyncClient(timeout=120.0) as client:
                        resp = await client.post(url, headers=headers, json=payload)

                        if resp.status_code == 503:
                            try:
                                body = resp.json()
                            except Exception:
                                body = {}
                            if "loading" in str(body).lower():
                                estimated = body.get("estimated_time", 20)
                                logger.info(f"Model {model_id} loading, waiting {estimated}s...")
                                await asyncio.sleep(min(estimated + 2, 30))
                                continue

                        if resp.status_code == 401:
                            logger.warning(f"Unauthorized for {model_id}, check HF_TOKEN")
                            break

                        if resp.status_code == 200 and len(resp.content) > 500:
                            logger.info(f"HF image from {model_id}: {len(resp.content)} bytes")
                            return resp.content

                        logger.warning(
                            f"HF attempt {attempt} on {model_id}: status {resp.status_code}, "
                            f"size {len(resp.content)}"
                        )
                except httpx.TimeoutException:
                    logger.warning(f"HF attempt {attempt} on {model_id}: timeout")
                except Exception as e:
                    logger.warning(f"HF attempt {attempt} on {model_id}: {e}")

                if attempt < retries:
                    await asyncio.sleep(delay * attempt)

        logger.warning("All HF models failed, falling back to Pollinations.ai")
    else:
        logger.info("No HF_TOKEN set — using Pollinations.ai (free, no key needed)")

    # Free fallback: Pollinations.ai — always works, no key needed
    return await _try_pollinations(prompt, seed, width, height)
