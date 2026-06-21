import os
import httpx
import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

HF_API_URL = "https://api-inference.huggingface.co/models"
DEFAULT_MODEL = "runwayml/stable-diffusion-v1-5"
FALLBACK_MODELS = [
    "stabilityai/stable-diffusion-2-1",
    "prompthero/openjourney-v4",
]


def _get_token() -> Optional[str]:
    token = os.environ.get("HF_TOKEN")
    if not token:
        token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    return token


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
    if not token:
        logger.warning("HF_TOKEN not set, cannot use Hugging Face inference")
        return None

    models_to_try = [model] if model else [DEFAULT_MODEL] + FALLBACK_MODELS
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    payload = {
        "inputs": prompt,
        "parameters": {
            "negative_prompt": "text, watermark, logo, signature, ugly, deformed",
            "num_inference_steps": 25,
            "guidance_scale": 7.5,
        },
    }

    for model_id in models_to_try:
        if model_id is None:
            continue
        url = f"{HF_API_URL}/{model_id}"
        for attempt in range(1, retries + 1):
            try:
                async with httpx.AsyncClient(timeout=120.0) as client:
                    resp = await client.post(url, headers=headers, json=payload)

                    if resp.status_code == 503:
                        body = resp.json()
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

                    logger.warning(f"HF attempt {attempt} on {model_id}: status {resp.status_code}, size {len(resp.content)}")
            except httpx.TimeoutException:
                logger.warning(f"HF attempt {attempt} on {model_id}: timeout")
            except Exception as e:
                logger.warning(f"HF attempt {attempt} on {model_id}: {e}")

            if attempt < retries:
                await asyncio.sleep(delay * attempt)

    logger.error(f"All HF models failed for prompt: {prompt[:50]}")
    return None
