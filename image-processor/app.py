import io
import os
import re
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from rembg import new_session, remove


app = FastAPI(title="Background Remover Image Processor", version="1.0.0")


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": os.getenv("REMBG_MODEL", "u2net"),
    }


@app.post("/remove-background")
async def remove_background(
    image: UploadFile = File(...),
    background_color: str = Form("#ffffff"),
    quality: int = Form(95),
):
    if not image.content_type or not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed")

    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    try:
        cutout_bytes = remove(image_bytes, session=get_session())
        cutout = Image.open(io.BytesIO(cutout_bytes))
        cutout = ImageOps.exif_transpose(cutout).convert("RGBA")
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Could not read the uploaded image") from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Background removal failed: {exc}") from exc

    output = flatten_to_jpg(cutout, parse_color(background_color), quality)
    filename = f"{safe_stem(image.filename)}_no_bg.jpg"

    return Response(
        content=output,
        media_type="image/jpeg",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@lru_cache(maxsize=1)
def get_session():
    return new_session(os.getenv("REMBG_MODEL", "u2net"))


def flatten_to_jpg(image: Image.Image, background_color: tuple[int, int, int], quality: int) -> bytes:
    background = Image.new("RGB", image.size, background_color)
    background.paste(image, mask=image.split()[-1])

    output = io.BytesIO()
    background.save(
        output,
        "JPEG",
        quality=max(60, min(100, int(quality))),
        optimize=True,
    )
    return output.getvalue()


def parse_color(value: str) -> tuple[int, int, int]:
    value = (value or "#ffffff").strip()

    named_colors = {
        "black": (0, 0, 0),
        "white": (255, 255, 255),
    }
    if value.lower() in named_colors:
        return named_colors[value.lower()]

    match = re.fullmatch(r"#?([0-9a-fA-F]{6})", value)
    if not match:
        raise HTTPException(status_code=400, detail="background_color must be a hex color like #ffffff")

    color = match.group(1)
    return tuple(int(color[index : index + 2], 16) for index in (0, 2, 4))


def safe_stem(filename: str | None) -> str:
    stem = Path(filename or "image").stem
    safe = re.sub(r"[^A-Za-z0-9_.-]+", "_", stem).strip("._-")
    return safe or "image"


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        workers=int(os.getenv("WORKERS", "1")),
    )
