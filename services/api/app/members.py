import re
import shutil
from pathlib import Path

from fastapi import HTTPException

from app.db import DATA

MEMBERS = DATA / "members"


def member_dir(member_id: str) -> Path:
    if not re.fullmatch(r"[0-9a-f]{32}", member_id):
        raise HTTPException(status_code=422, detail="成员不正确")
    folder = (MEMBERS / member_id).resolve()
    root = MEMBERS.resolve()
    if not folder.is_relative_to(root):
        raise HTTPException(status_code=422, detail="成员不正确")
    return folder


def photo_file(member_id: str, kind: str) -> Path | None:
    if kind not in {"front", "side"}:
        return None
    try:
        folder = member_dir(member_id)
    except HTTPException:
        return None
    path = next(folder.glob(f"{kind}.*"), None)
    if (
        path is None
        or not path.is_file()
        or path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}
    ):
        return None
    return path


def remove_photos(member_id: str) -> None:
    try:
        folder = member_dir(member_id)
    except HTTPException:
        return
    if folder.is_dir():
        shutil.rmtree(folder)


def clean_member(
    name: str,
    height_cm: str,
    chest_cm: str = "",
    waist_cm: str = "",
    hip_cm: str = "",
) -> dict:
    cleaned = name.strip()
    if not cleaned:
        raise HTTPException(status_code=422, detail="名称不能为空")
    if len(cleaned) > 20:
        raise HTTPException(status_code=422, detail="名称不正确")
    return {
        "name": cleaned,
        "height_cm": whole_cm(height_cm, "身高", 50, 230, required=True),
        "chest_cm": whole_cm(chest_cm, "胸围", 40, 160, required=False),
        "waist_cm": whole_cm(waist_cm, "腰围", 40, 160, required=False),
        "hip_cm": whole_cm(hip_cm, "臀围", 40, 160, required=False),
    }


def whole_cm(
    value: str,
    label: str,
    low: int,
    high: int,
    *,
    required: bool,
) -> int | None:
    text = value.strip()
    if not text:
        if required:
            raise HTTPException(status_code=422, detail=f"{label}不正确")
        return None
    if not text.isdigit():
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    number = int(text)
    if number < low or number > high:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    return number
