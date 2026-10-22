import base64
import io
import json
import logging
import os
import re
import ssl
import threading
import urllib.request

import certifi
import numpy as np
from decimal import Decimal
from pathlib import Path

from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError

from app.db import CATEGORIES, CONSTRUCTIONS, DATA, OPACITIES, SEASONS, SHEENS

CAPTURES = DATA / "captures"
MODEL = Path.home() / ".rembg/models/birefnet-general-lite/birefnet-general-lite.onnx"
CLOTH_MODEL = Path.home() / ".rembg/models/u2net_cloth_seg/u2net_cloth_seg.onnx"
MAX_BYTES = 12 * 1024 * 1024
EXTENSIONS = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}
LOGGER = logging.getLogger("uvicorn.error")
_SESSION = None
_CLOTH = None
_LOCK = threading.Lock()


def capture_dir(capture_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}", capture_id):
        raise HTTPException(status_code=422, detail="照片不正确")
    folder = (CAPTURES / capture_id).resolve()
    root = CAPTURES.resolve()
    if not folder.is_relative_to(root):
        raise HTTPException(status_code=422, detail="照片不正确")
    return folder


def save_upload(data: bytes, folder: Path, stem: str) -> None:
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="照片太大")
    try:
        image = Image.open(io.BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError) as error:
        raise HTTPException(status_code=422, detail="请上传图片") from error
    extension = EXTENSIONS.get(image.format or "")
    if extension is None:
        raise HTTPException(status_code=422, detail="请上传图片")
    folder.mkdir(parents=True, exist_ok=True)
    (folder / f"{stem}.{extension}").write_bytes(data)


def cut_out(folder: Path) -> bool:
    photo = next(folder.glob("photo.*"), None)
    if photo is None:
        return False
    dest = folder / "cutout.png"
    if not MODEL.is_file():
        LOGGER.warning("BiRefNet weight is not ready")
        return False
    try:
        from rembg import remove

        result = remove(photo.read_bytes(), session=session())
        cutout = Image.open(io.BytesIO(result)).convert("RGBA")
        cutout = drop_wearer(Image.open(photo).convert("RGB"), cutout)
        cutout.save(dest, format="PNG")
        return dest.is_file() and dest.stat().st_size > 0
    except Exception:
        LOGGER.exception("cutout failed")
        return False


def session():
    global _SESSION
    with _LOCK:
        if _SESSION is None:
            from rembg import new_session

            _SESSION = new_session("birefnet-general-lite")
        return _SESSION


def cloth_session():
    global _CLOTH
    with _LOCK:
        if _CLOTH is None:
            from rembg import new_session

            _CLOTH = new_session("u2net_cloth_seg")
        return _CLOTH


def drop_wearer(photo: Image.Image, cutout: Image.Image) -> Image.Image:
    if not CLOTH_MODEL.is_file():
        return cutout
    try:
        masks = cloth_session().predict(photo.convert("RGB"), cloth_category="attire")
    except Exception:
        LOGGER.exception("cloth mask failed")
        return cutout
    if not masks:
        return cutout
    from scipy.ndimage import binary_closing, binary_dilation, binary_fill_holes, label

    cloth = np.asarray(masks[0].resize(cutout.size, Image.Resampling.NEAREST)) > 32
    rgba = np.array(cutout.convert("RGBA"))
    alpha = rgba[:, :, 3]
    foreground = alpha > 20
    foreground_count = int(foreground.sum())
    if foreground_count < 400:
        return cutout
    rgb = np.asarray(photo.convert("RGB").resize(cutout.size, Image.Resampling.BILINEAR))
    ycc = np.asarray(Image.fromarray(rgb).convert("YCbCr"))
    red = rgb[:, :, 0].astype(np.int16)
    blue = rgb[:, :, 2].astype(np.int16)
    skin = (
        (ycc[:, :, 2] >= 133)
        & (ycc[:, :, 2] <= 165)
        & (ycc[:, :, 1] >= 112)
        & (ycc[:, :, 1] <= 140)
        & (ycc[:, :, 0] >= 130)
        & ((red - blue) > 12)
    )
    closed = binary_closing(cloth, iterations=5)
    interior = binary_fill_holes(closed)
    repaired = closed | (np.logical_and(interior, ~closed) & ~skin)
    grown = binary_dilation(repaired, iterations=8)
    clothes = (repaired | (grown & foreground & ~skin & ~repaired)) & foreground
    labeled, count = label(clothes)
    if count:
        sizes = np.bincount(labeled.ravel())
        keep = sizes >= 1500
        keep[0] = False
        clothes = keep[labeled]
    kept = int(np.logical_and(foreground, clothes).sum())
    if kept < foreground_count * 0.35 or foreground_count - kept < foreground_count * 0.05:
        return cutout
    rgba[:, :, 3] = np.where(clothes, alpha, 0)
    return Image.fromarray(rgba)


def stored_image(capture_id: str) -> str:
    if not capture_id:
        return ""
    try:
        folder = capture_dir(capture_id)
    except HTTPException:
        return ""
    path = folder / "cutout.png"
    if not path.is_file():
        return ""
    return f"captures/{capture_id}/cutout.png"


def cutout_file(capture_id: str) -> Path | None:
    folder = capture_dir(capture_id)
    path = folder / "cutout.png"
    if not path.is_file():
        return None
    return path


def stored_face(capture_id: str) -> str:
    if not capture_id:
        return ""
    try:
        folder = capture_dir(capture_id)
    except HTTPException:
        return ""
    face = next(folder.glob("face.*"), None)
    if face is None or not face.is_file():
        return ""
    return f"captures/{capture_id}/{face.name}"


def face_file(relative: str) -> Path | None:
    if not relative or ".." in relative:
        return None
    path = (DATA / relative).resolve()
    root = CAPTURES.resolve()
    if (
        not path.is_relative_to(root)
        or not path.is_file()
        or not path.name.startswith("face.")
        or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}
    ):
        return None
    return path


def image_file(relative: str) -> Path | None:
    if not relative or ".." in relative:
        return None
    path = (DATA / relative).resolve()
    root = CAPTURES.resolve()
    if not path.is_relative_to(root) or path.name != "cutout.png" or not path.is_file():
        return None
    return path


def recognize(folder: Path) -> tuple[dict[str, str], str]:
    cutout = folder / "cutout.png"
    if not cutout.is_file():
        return {}, "还不能抠图，请自己填写"
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return {}, "还没有配置识别密钥"
    try:
        draft = ask_json(
            key,
            cutout.read_bytes(),
            "image/png",
            (
                "看这张衣服抠图。只返回 JSON，不要其他文字。"
                "字段只有 category、color、pattern、season。"
                "category 只能是上衣、下装、半裙、连衣裙、外套、鞋、配饰之一。"
                "season 只能是空字符串、春、夏、秋、冬、四季之一。"
                "color 和 pattern 用简短中文，看不出来就用空字符串。"
                "不要填写纤维，不要猜测姓名。"
            ),
        )
        label = next(folder.glob("label.*"), None)
        if label is not None:
            fiber = ask_json(
                key,
                label.read_bytes(),
                mime_for(label),
                "这是衣服洗标。只返回 JSON：{\"fiber\":\"\"}。fiber 是纤维成分的简短中文，看不清就用空字符串。",
            )
            draft["fiber"] = str(fiber.get("fiber", ""))[:40]
        return clean_draft(draft), ""
    except Exception:
        LOGGER.exception("recognize failed")
        return {}, "识别没有完成，请自己填写"


def clean_draft(raw: dict) -> dict[str, str]:
    category = str(raw.get("category", "")).strip()
    season = str(raw.get("season", "")).strip()
    return {
        "category": category if category in CATEGORIES else "上衣",
        "color": str(raw.get("color", "")).strip()[:20],
        "pattern": str(raw.get("pattern", "")).strip()[:20],
        "season": season if season in SEASONS else "",
        "fiber": str(raw.get("fiber", "")).strip()[:40],
    }


def mime_for(path: Path) -> str:
    return {
        ".jpg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/jpeg")


def ask_json(key: str, image: bytes, mime: str, prompt: str) -> dict:
    encoded = base64.b64encode(image).decode()
    payload = {
        "model": "deepseek-flash",
        "thinking": {"type": "disabled"},
        "max_tokens": 300,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime};base64,{encoded}"},
                    },
                ],
            }
        ],
    }
    request = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    context = ssl.create_default_context(cafile=certifi.where())
    with urllib.request.urlopen(request, timeout=40, context=context) as response:
        body = json.load(response)
    text = str(body["choices"][0]["message"]["content"]).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("no json")
    parsed = json.loads(text[start : end + 1])
    if not isinstance(parsed, dict):
        raise ValueError("json was not an object")
    return parsed


def recognize_fabric(folder: Path) -> tuple[dict, str]:
    face = next(folder.glob("face.*"), None)
    if face is None:
        return {}, "识别没有完成，请自己填写"
    key = os.environ.get("DEEPSEEK_API_KEY", "").strip()
    if not key:
        return {}, "还没有配置识别密钥"
    try:
        image, mime = request_image(face)
        draft = ask_json(
            key,
            image,
            mime,
            (
                "看这块布面。只返回 JSON，不要其他文字。"
                "字段只有 construction、color、pattern、sheen、opacity。"
                "construction 只能是梭织、针织、蕾丝、无纺之一。"
                "sheen 只能是空字符串、哑光、微光、有光之一。"
                "opacity 只能是空字符串、透明、半透、不透之一。"
                "color 和 pattern 用简短中文，看不出来就用空字符串。"
                "不要填写成分、门幅、克重、剩余米数，不要猜测姓名。"
            ),
        )
        spec = next(folder.glob("spec.*"), None)
        if spec is not None:
            spec_image, spec_mime = request_image(spec)
            label = ask_json(
                key,
                spec_image,
                spec_mime,
                (
                    "这是布料规格标签或布头文字。只返回 JSON，不要其他文字。"
                    "字段只有 composition、width_cm、gsm、yarn_count、density。"
                    "composition、yarn_count、density 用简短中文，看不清就用空字符串。"
                    "width_cm 是门幅厘米，看不清就用 null。"
                    "gsm 是克重的整数，看不清就用 null。"
                    "不要填写剩余米数，不要猜测姓名。"
                ),
            )
            draft.update(label)
        return clean_fabric(draft), ""
    except Exception:
        LOGGER.exception("fabric recognize failed")
        return {}, "识别没有完成，请自己填写"


def clean_fabric(raw: dict) -> dict:
    construction = str(raw.get("construction", "")).strip()
    sheen = str(raw.get("sheen", "")).strip()
    opacity = str(raw.get("opacity", "")).strip()
    return {
        "composition": str(raw.get("composition", "")).strip()[:80],
        "construction": construction if construction in CONSTRUCTIONS else "梭织",
        "width_cm": optional_width(raw.get("width_cm")),
        "gsm": optional_gsm(raw.get("gsm")),
        "yarn_count": str(raw.get("yarn_count", "")).strip()[:40],
        "density": str(raw.get("density", "")).strip()[:40],
        "opacity": opacity if opacity in OPACITIES else "",
        "sheen": sheen if sheen in SHEENS else "",
        "pattern": str(raw.get("pattern", "")).strip()[:20],
        "color": str(raw.get("color", "")).strip()[:20],
    }


def optional_width(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        number = Decimal(str(value))
    except Exception:
        return None
    if number <= 0 or number > 500:
        return None
    return float(number.quantize(Decimal("0.1")))


def optional_gsm(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        number = int(Decimal(str(value)))
    except Exception:
        return None
    if number <= 0 or number > 2000:
        return None
    return number


def request_image(path: Path) -> tuple[bytes, str]:
    image = Image.open(path)
    image.load()
    image = image.convert("RGB")
    image.thumbnail((1280, 1280))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue(), "image/jpeg"
