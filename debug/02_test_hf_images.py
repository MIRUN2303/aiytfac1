"""Step 2: Test HF image generation independently."""
import sys, os, asyncio, json
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
from infrastructure.hf_image_client import generate_image

async def main():
    prompt = "A butterfly emerging from a cocoon, cinematic lighting, ultra detailed"
    print("=" * 60)
    print("Testing Hugging Face Image Generation")
    print(f"Prompt: {prompt}")
    print("=" * 60)

    # Try with explicit model
    for model in [
        "runwayml/stable-diffusion-v1-5",
        "stabilityai/stable-diffusion-2-1",
        "prompthero/openjourney-v4",
        "black-forest-labs/FLUX.1-dev",     # newer, very popular
        "stabilityai/stable-diffusion-3.5-medium",
    ]:
        print(f"\n--- Model: {model} ---")
        try:
            data = await generate_image(prompt, seed=42, model=model)
            if data and len(data) > 500:
                out = f"output_{model.split('/')[-1]}.png"
                with open(out, "wb") as f:
                    f.write(data)
                print(f"SUCCESS: {len(data)} bytes -> {out}")
            else:
                size = len(data) if data else 0
                print(f"FAILED: response {size} bytes (min 500 needed)")
        except Exception as e:
            print(f"ERROR: {e}")

    # Try default (with fallbacks)
    print("\n--- Default chain (model=None, tries with fallbacks) ---")
    try:
        data = await generate_image(prompt, seed=42)
        if data and len(data) > 500:
            out = "output_default.png"
            with open(out, "wb") as f:
                f.write(data)
            print(f"SUCCESS: {len(data)} bytes -> {out}")
        else:
            size = len(data) if data else 0
            print(f"FAILED: response {size} bytes")
    except Exception as e:
        print(f"ERROR: {e}")

    print("\nDONE")

    # Check HF token
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
    if not token:
        print("\nWARNING: No HF_TOKEN or HUGGINGFACEHUB_API_TOKEN set in environment!")
        print("Set one to: $env:HF_TOKEN='your_token_here'")
    else:
        print(f"\nHF token found: {token[:8]}...{token[-4:]}")

if __name__ == "__main__":
    asyncio.run(main())
