import re
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from app.capture import (
    capture_dir,
    cut_out,
    cutout_file,
    face_file,
    image_file,
    recognize,
    recognize_fabric,
    save_upload,
    stored_face,
    stored_image,
)
from app.drape import display_path, prepare_outfit_drape
from app.members import clean_member, member_dir, photo_file, remove_photos
from app.db import (
    CATEGORIES,
    CONSTRUCTIONS,
    OPACITIES,
    SEASONS,
    SHEENS,
    STRETCHES,
    THICKNESSES,
    connect,
    init_db,
)

app = FastAPI(title="家庭衣橱")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class GarmentIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    category: str
    color: str = Field(default="", max_length=20)
    pattern: str = Field(default="", max_length=20)
    season: str = ""
    fiber: str = Field(default="", max_length=40)
    owner: str = Field(default="", max_length=20)

    def validated(self) -> "GarmentIn":
        self.name = self.name.strip()
        self.color = self.color.strip()
        self.pattern = self.pattern.strip()
        self.fiber = self.fiber.strip()
        self.owner = self.owner.strip()
        if not self.name:
            raise HTTPException(status_code=422, detail="名称不能为空")
        if self.category not in CATEGORIES:
            raise HTTPException(status_code=422, detail="品类不正确")
        if self.season not in SEASONS:
            raise HTTPException(status_code=422, detail="季节不正确")
        return self


class GarmentCreate(GarmentIn):
    capture_id: str = ""


class Garment(GarmentIn):
    id: str
    image: str = ""
    created_at: str
    updated_at: str


class GarmentDraft(BaseModel):
    name: str = ""
    category: str = "上衣"
    color: str = ""
    pattern: str = ""
    season: str = ""
    fiber: str = ""
    owner: str = ""


class CaptureOut(BaseModel):
    id: str
    cutout_url: str = ""
    message: str = ""
    draft: GarmentDraft


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def to_garment(row) -> Garment:
    data = dict(row)
    stored = data.pop("image", "") or ""
    garment = Garment(**data)
    if stored:
        garment.image = f"/api/garments/{garment.id}/image"
    return garment


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/api/garments")
def list_garments(
    category: str = "",
    color: str = "",
    season: str = "",
    fiber: str = "",
    owner: str = "",
) -> list[Garment]:
    clauses: list[str] = []
    params: list[str] = []
    for column, value in (
        ("category", category),
        ("color", color),
        ("season", season),
        ("fiber", fiber),
        ("owner", owner),
    ):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with connect() as connection:
        rows = connection.execute(
            f"SELECT * FROM garments {where} ORDER BY updated_at DESC",
            params,
        ).fetchall()
    return [to_garment(row) for row in rows]


@app.post("/api/garments", status_code=201)
def create_garment(payload: GarmentCreate) -> Garment:
    garment = payload.validated()
    garment_id = uuid4().hex
    timestamp = now()
    image = stored_image(payload.capture_id)
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO garments (
                id, name, category, color, pattern, season, fiber, owner,
                image, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                garment_id,
                garment.name,
                garment.category,
                garment.color,
                garment.pattern,
                garment.season,
                garment.fiber,
                garment.owner,
                image,
                timestamp,
                timestamp,
            ),
        )
        row = connection.execute(
            "SELECT * FROM garments WHERE id = ?",
            (garment_id,),
        ).fetchone()
    return to_garment(row)


@app.get("/api/garments/{garment_id}")
def get_garment(garment_id: str) -> Garment:
    with connect() as connection:
        row = connection.execute(
            "SELECT * FROM garments WHERE id = ?",
            (garment_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="没有这件衣服")
    return to_garment(row)


@app.patch("/api/garments/{garment_id}")
def update_garment(garment_id: str, payload: GarmentIn) -> Garment:
    garment = payload.validated()
    with connect() as connection:
        existing = connection.execute(
            "SELECT id FROM garments WHERE id = ?",
            (garment_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="没有这件衣服")
        connection.execute(
            """
            UPDATE garments
            SET name = ?, category = ?, color = ?, pattern = ?, season = ?,
                fiber = ?, owner = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                garment.name,
                garment.category,
                garment.color,
                garment.pattern,
                garment.season,
                garment.fiber,
                garment.owner,
                now(),
                garment_id,
            ),
        )
        row = connection.execute(
            "SELECT * FROM garments WHERE id = ?",
            (garment_id,),
        ).fetchone()
    return to_garment(row)


@app.delete("/api/garments/{garment_id}", status_code=204)
def delete_garment(garment_id: str) -> None:
    with connect() as connection:
        cursor = connection.execute(
            "DELETE FROM garments WHERE id = ?",
            (garment_id,),
        )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="没有这件衣服")


@app.get("/api/garments/{garment_id}/image")
def garment_image(garment_id: str) -> FileResponse:
    with connect() as connection:
        row = connection.execute(
            "SELECT image FROM garments WHERE id = ?",
            (garment_id,),
        ).fetchone()
    if row is None or not row["image"]:
        raise HTTPException(status_code=404, detail="没有这张抠图")
    path = image_file(row["image"])
    if path is None:
        raise HTTPException(status_code=404, detail="没有这张抠图")
    return FileResponse(path, media_type="image/png")


@app.post("/api/captures")
async def create_capture(
    photo: UploadFile = File(...),
    label: UploadFile | None = File(None),
) -> CaptureOut:
    capture_id = uuid4().hex
    folder = capture_dir(capture_id)
    save_upload(await photo.read(), folder, "photo")
    if label is not None and label.filename:
        label_bytes = await label.read()
        if label_bytes:
            save_upload(label_bytes, folder, "label")
    has_cutout = cut_out(folder)
    fields, message = recognize(folder)
    return CaptureOut(
        id=capture_id,
        cutout_url=f"/api/captures/{capture_id}/cutout" if has_cutout else "",
        message=message,
        draft=GarmentDraft(**fields),
    )


@app.get("/api/captures/{capture_id}/cutout")
def capture_cutout(capture_id: str) -> FileResponse:
    path = cutout_file(capture_id)
    if path is None:
        raise HTTPException(status_code=404, detail="没有这张抠图")
    return FileResponse(path, media_type="image/png")


WIDTH_SQL = {
    "narrow": "width_cm IS NOT NULL AND width_cm <= 110",
    "regular": "width_cm IS NOT NULL AND width_cm > 110 AND width_cm <= 150",
    "wide": "width_cm IS NOT NULL AND width_cm > 150",
}
GSM_SQL = {
    "light": "gsm IS NOT NULL AND gsm <= 150",
    "medium": "gsm IS NOT NULL AND gsm > 150 AND gsm <= 300",
    "heavy": "gsm IS NOT NULL AND gsm > 300",
}
STOCK_SQL = {
    "in": "remaining_m > 0",
    "out": "remaining_m = 0",
}


class FabricIn(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    composition: str = Field(default="", max_length=80)
    construction: str
    width_cm: float | None = None
    gsm: int | None = None
    yarn_count: str = Field(default="", max_length=40)
    density: str = Field(default="", max_length=40)
    stretch: str = ""
    thickness: str = ""
    opacity: str = ""
    sheen: str = ""
    pattern: str = Field(default="", max_length=20)
    color: str = Field(default="", max_length=20)
    remaining_m: float

    def validated(self) -> "FabricIn":
        self.name = self.name.strip()
        self.composition = self.composition.strip()
        self.yarn_count = self.yarn_count.strip()
        self.density = self.density.strip()
        self.pattern = self.pattern.strip()
        self.color = self.color.strip()
        if not self.name:
            raise HTTPException(status_code=422, detail="名称不能为空")
        if self.construction not in CONSTRUCTIONS:
            raise HTTPException(status_code=422, detail="组织不正确")
        if self.stretch not in STRETCHES:
            raise HTTPException(status_code=422, detail="弹性不正确")
        if self.thickness not in THICKNESSES:
            raise HTTPException(status_code=422, detail="厚度不正确")
        if self.opacity not in OPACITIES:
            raise HTTPException(status_code=422, detail="透明度不正确")
        if self.sheen not in SHEENS:
            raise HTTPException(status_code=422, detail="光泽不正确")
        self.width_cm = one_decimal(self.width_cm, "门幅", positive=True, maximum=500)
        self.gsm = positive_int(self.gsm, "克重", maximum=2000)
        self.remaining_m = one_decimal(
            self.remaining_m, "剩余米数", positive=False, maximum=10000
        )
        if self.remaining_m is None:
            raise HTTPException(status_code=422, detail="剩余米数不正确")
        return self


class FabricCreate(FabricIn):
    capture_id: str = ""


class Fabric(FabricIn):
    id: str
    image: str = ""
    created_at: str
    updated_at: str


class FabricDraft(BaseModel):
    composition: str = ""
    construction: str = "梭织"
    width_cm: float | None = None
    gsm: int | None = None
    yarn_count: str = ""
    density: str = ""
    opacity: str = ""
    sheen: str = ""
    pattern: str = ""
    color: str = ""


class FabricCaptureOut(BaseModel):
    id: str
    message: str = ""
    draft: FabricDraft


def to_fabric(row) -> Fabric:
    data = dict(row)
    stored = data.pop("image", "") or ""
    fabric = Fabric(**data)
    if stored and face_file(stored) is not None:
        fabric.image = f"/api/fabrics/{fabric.id}/image"
    return fabric


def one_decimal(
    value: float | None,
    label: str,
    *,
    positive: bool,
    maximum: float,
) -> float | None:
    if value is None:
        return None
    decimal = Decimal(str(value))
    if decimal.as_tuple().exponent < -1:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    if positive and decimal <= 0:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    if not positive and decimal < 0:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    if decimal > maximum:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    return float(decimal)


def positive_int(value: int | None, label: str, *, maximum: int) -> int | None:
    if value is None:
        return None
    if value <= 0 or value > maximum:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    return value


def bucket(value: str, allowed: dict[str, str], label: str) -> str:
    if not value:
        return ""
    if value not in allowed:
        raise HTTPException(status_code=422, detail=f"{label}不正确")
    return allowed[value]


@app.get("/api/fabrics")
def list_fabrics(
    composition: str = "",
    construction: str = "",
    color: str = "",
    pattern: str = "",
    width: str = "",
    gsm: str = "",
    stock: str = "",
) -> list[Fabric]:
    clauses: list[str] = []
    params: list[str] = []
    for column, value in (
        ("composition", composition),
        ("construction", construction),
        ("color", color),
        ("pattern", pattern),
    ):
        if value:
            clauses.append(f"{column} = ?")
            params.append(value)
    for clause in (
        bucket(width, WIDTH_SQL, "门幅筛选"),
        bucket(gsm, GSM_SQL, "克重筛选"),
        bucket(stock, STOCK_SQL, "剩余筛选"),
    ):
        if clause:
            clauses.append(clause)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    with connect() as connection:
        rows = connection.execute(
            f"SELECT * FROM fabrics {where} ORDER BY updated_at DESC",
            params,
        ).fetchall()
    return [to_fabric(row) for row in rows]


@app.post("/api/fabrics", status_code=201)
def create_fabric(payload: FabricCreate) -> Fabric:
    fabric = payload.validated()
    fabric_id = uuid4().hex
    timestamp = now()
    image = stored_face(payload.capture_id)
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO fabrics (
                id, name, composition, construction, width_cm, gsm, yarn_count,
                density, stretch, thickness, opacity, sheen, pattern, color,
                remaining_m, image, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                fabric_id,
                fabric.name,
                fabric.composition,
                fabric.construction,
                fabric.width_cm,
                fabric.gsm,
                fabric.yarn_count,
                fabric.density,
                fabric.stretch,
                fabric.thickness,
                fabric.opacity,
                fabric.sheen,
                fabric.pattern,
                fabric.color,
                fabric.remaining_m,
                image,
                timestamp,
                timestamp,
            ),
        )
        row = connection.execute(
            "SELECT * FROM fabrics WHERE id = ?",
            (fabric_id,),
        ).fetchone()
    return to_fabric(row)


@app.get("/api/fabrics/{fabric_id}")
def get_fabric(fabric_id: str) -> Fabric:
    with connect() as connection:
        row = connection.execute(
            "SELECT * FROM fabrics WHERE id = ?",
            (fabric_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="没有这块布料")
    return to_fabric(row)


@app.patch("/api/fabrics/{fabric_id}")
def update_fabric(fabric_id: str, payload: FabricIn) -> Fabric:
    fabric = payload.validated()
    with connect() as connection:
        existing = connection.execute(
            "SELECT id FROM fabrics WHERE id = ?",
            (fabric_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="没有这块布料")
        connection.execute(
            """
            UPDATE fabrics
            SET name = ?, composition = ?, construction = ?, width_cm = ?,
                gsm = ?, yarn_count = ?, density = ?, stretch = ?,
                thickness = ?, opacity = ?, sheen = ?, pattern = ?, color = ?,
                remaining_m = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                fabric.name,
                fabric.composition,
                fabric.construction,
                fabric.width_cm,
                fabric.gsm,
                fabric.yarn_count,
                fabric.density,
                fabric.stretch,
                fabric.thickness,
                fabric.opacity,
                fabric.sheen,
                fabric.pattern,
                fabric.color,
                fabric.remaining_m,
                now(),
                fabric_id,
            ),
        )
        row = connection.execute(
            "SELECT * FROM fabrics WHERE id = ?",
            (fabric_id,),
        ).fetchone()
    return to_fabric(row)


@app.get("/api/fabrics/{fabric_id}/image")
def fabric_image(fabric_id: str) -> FileResponse:
    with connect() as connection:
        row = connection.execute(
            "SELECT image FROM fabrics WHERE id = ?",
            (fabric_id,),
        ).fetchone()
    if row is None or not row["image"]:
        raise HTTPException(status_code=404, detail="没有这张布面照")
    path = face_file(row["image"])
    if path is None:
        raise HTTPException(status_code=404, detail="没有这张布面照")
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/jpeg")
    return FileResponse(path, media_type=media)


@app.post("/api/fabric-captures")
async def create_fabric_capture(
    face: UploadFile = File(...),
    spec: UploadFile | None = File(None),
) -> FabricCaptureOut:
    capture_id = uuid4().hex
    folder = capture_dir(capture_id)
    save_upload(await face.read(), folder, "face")
    if spec is not None and spec.filename:
        spec_bytes = await spec.read()
        if spec_bytes:
            save_upload(spec_bytes, folder, "spec")
    fields, message = recognize_fabric(folder)
    return FabricCaptureOut(
        id=capture_id,
        message=message,
        draft=FabricDraft(**fields),
    )


@app.delete("/api/fabrics/{fabric_id}", status_code=204)
def delete_fabric(fabric_id: str) -> None:
    with connect() as connection:
        cursor = connection.execute(
            "DELETE FROM fabrics WHERE id = ?",
            (fabric_id,),
        )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="没有这块布料")


class MemberIn(BaseModel):
    name: str
    height_cm: int
    chest_cm: int | None = None
    waist_cm: int | None = None
    hip_cm: int | None = None

    def validated(self) -> dict:
        return clean_member(
            self.name,
            str(self.height_cm),
            "" if self.chest_cm is None else str(self.chest_cm),
            "" if self.waist_cm is None else str(self.waist_cm),
            "" if self.hip_cm is None else str(self.hip_cm),
        )


class Member(BaseModel):
    id: str
    name: str
    height_cm: int
    chest_cm: int | None = None
    waist_cm: int | None = None
    hip_cm: int | None = None
    front: str = ""
    side: str = ""
    created_at: str
    updated_at: str


def to_member(row) -> Member:
    data = dict(row)
    member_id = data.pop("id")
    data.pop("front", None)
    data.pop("side", None)
    member = Member(id=member_id, **data)
    if photo_file(member_id, "front") is not None:
        member.front = f"/api/members/{member_id}/front"
    if photo_file(member_id, "side") is not None:
        member.side = f"/api/members/{member_id}/side"
    return member


def photo_response(member_id: str, kind: str) -> FileResponse:
    with connect() as connection:
        row = connection.execute(
            "SELECT id FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="没有这位成员")
    path = photo_file(member_id, kind)
    if path is None:
        raise HTTPException(status_code=404, detail="没有这张照片")
    media = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(path.suffix.lower(), "image/jpeg")
    return FileResponse(path, media_type=media)


@app.get("/api/members")
def list_members() -> list[Member]:
    with connect() as connection:
        rows = connection.execute(
            "SELECT * FROM members ORDER BY updated_at DESC"
        ).fetchall()
    return [to_member(row) for row in rows]


@app.post("/api/members", status_code=201)
async def create_member(
    name: str = Form(...),
    height_cm: str = Form(...),
    chest_cm: str = Form(""),
    waist_cm: str = Form(""),
    hip_cm: str = Form(""),
    front: UploadFile = File(...),
    side: UploadFile | None = File(None),
) -> Member:
    fields = clean_member(name, height_cm, chest_cm, waist_cm, hip_cm)
    member_id = uuid4().hex
    folder = member_dir(member_id)
    try:
        save_upload(await front.read(), folder, "front")
        if side is not None and side.filename:
            side_bytes = await side.read()
            if side_bytes:
                save_upload(side_bytes, folder, "side")
    except HTTPException:
        remove_photos(member_id)
        raise
    front_path = photo_file(member_id, "front")
    side_path = photo_file(member_id, "side")
    timestamp = now()
    with connect() as connection:
        connection.execute(
            """
            INSERT INTO members (
                id, name, height_cm, chest_cm, waist_cm, hip_cm, front, side,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                member_id,
                fields["name"],
                fields["height_cm"],
                fields["chest_cm"],
                fields["waist_cm"],
                fields["hip_cm"],
                f"members/{member_id}/{front_path.name}" if front_path else "",
                f"members/{member_id}/{side_path.name}" if side_path else "",
                timestamp,
                timestamp,
            ),
        )
        row = connection.execute(
            "SELECT * FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    return to_member(row)


@app.get("/api/members/{member_id}")
def get_member(member_id: str) -> Member:
    with connect() as connection:
        row = connection.execute(
            "SELECT * FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="没有这位成员")
    return to_member(row)


@app.patch("/api/members/{member_id}")
def update_member(member_id: str, payload: MemberIn) -> Member:
    fields = payload.validated()
    with connect() as connection:
        existing = connection.execute(
            "SELECT id FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
        if existing is None:
            raise HTTPException(status_code=404, detail="没有这位成员")
        connection.execute(
            """
            UPDATE members
            SET name = ?, height_cm = ?, chest_cm = ?, waist_cm = ?, hip_cm = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (
                fields["name"],
                fields["height_cm"],
                fields["chest_cm"],
                fields["waist_cm"],
                fields["hip_cm"],
                now(),
                member_id,
            ),
        )
        row = connection.execute(
            "SELECT * FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    return to_member(row)


@app.delete("/api/members/{member_id}", status_code=204)
def delete_member(member_id: str) -> None:
    with connect() as connection:
        cursor = connection.execute(
            "DELETE FROM members WHERE id = ?",
            (member_id,),
        )
    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="没有这位成员")
    remove_photos(member_id)


@app.get("/api/members/{member_id}/front")
def member_front(member_id: str) -> FileResponse:
    return photo_response(member_id, "front")


@app.get("/api/members/{member_id}/side")
def member_side(member_id: str) -> FileResponse:
    return photo_response(member_id, "side")


class OutfitItem(BaseModel):
    slot: str
    garment_id: str


class OutfitIn(BaseModel):
    member_id: str = ""
    items: list[OutfitItem]


class Outfit(BaseModel):
    member_id: str
    items: list[OutfitItem]
    display_url: str = ""
    message: str = ""
    height_cm: int = 170


def require_member(member_id: str) -> str:
    member_id = member_id.strip()
    if not member_id:
        return ""
    if not re.fullmatch(r"[0-9a-f]{32}", member_id):
        raise HTTPException(status_code=422, detail="成员不正确")
    with connect() as connection:
        row = connection.execute(
            "SELECT id FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="没有这位成员")
    return member_id


def read_outfit(member_id: str) -> Outfit:
    with connect() as connection:
        rows = connection.execute(
            "SELECT slot, garment_id FROM outfits WHERE member_id = ?",
            (member_id,),
        ).fetchall()
        items: list[OutfitItem] = []
        for row in rows:
            garment = connection.execute(
                "SELECT category FROM garments WHERE id = ?",
                (row["garment_id"],),
            ).fetchone()
            if garment is None or garment["category"] != row["slot"]:
                connection.execute(
                    "DELETE FROM outfits WHERE member_id = ? AND slot = ?",
                    (member_id, row["slot"]),
                )
                continue
            items.append(OutfitItem(slot=row["slot"], garment_id=row["garment_id"]))
    items.sort(key=lambda item: CATEGORIES.index(item.slot))
    return _with_drape(member_id, items)


def _with_drape(member_id: str, items: list[OutfitItem]) -> Outfit:
    height = _member_height(member_id)
    url, message = prepare_outfit_drape(member_id, _drape_rows(items), height)
    return Outfit(
        member_id=member_id,
        items=items,
        display_url=url,
        message=message,
        height_cm=height,
    )


def _member_height(member_id: str) -> int:
    if not member_id:
        return 170
    with connect() as connection:
        row = connection.execute(
            "SELECT height_cm FROM members WHERE id = ?",
            (member_id,),
        ).fetchone()
    if row is None:
        return 170
    return int(row["height_cm"])


def _drape_rows(items: list[OutfitItem]) -> list[dict]:
    rows: list[dict] = []
    with connect() as connection:
        for item in items:
            garment = connection.execute(
                "SELECT id, name, category, fiber, color, image FROM garments WHERE id = ?",
                (item.garment_id,),
            ).fetchone()
            if garment is None:
                continue
            rows.append(
                {
                    "id": garment["id"],
                    "slot": item.slot,
                    "name": garment["name"],
                    "category": garment["category"],
                    "fiber": garment["fiber"] or "",
                    "color": garment["color"] or "",
                    "image": garment["image"] or "",
                }
            )
    return rows


@app.get("/api/outfits")
def get_outfit(member_id: str = "") -> Outfit:
    return read_outfit(require_member(member_id))


@app.get("/api/outfits/display.gltf")
def outfit_display(member_id: str = "") -> FileResponse:
    path = display_path(require_member(member_id))
    if path is None:
        raise HTTPException(status_code=404, detail="还没有垂坠结果")
    return FileResponse(
        path,
        media_type="model/gltf+json",
        headers={"Cache-Control": "no-cache"},
    )


@app.put("/api/outfits")
def put_outfit(payload: OutfitIn) -> Outfit:
    member_id = require_member(payload.member_id)
    seen: set[str] = set()
    cleaned: list[OutfitItem] = []
    with connect() as connection:
        for item in payload.items:
            if item.slot not in CATEGORIES or item.slot in seen:
                raise HTTPException(status_code=422, detail="槽位不正确")
            garment = connection.execute(
                "SELECT id, name, category, fiber, color, image FROM garments WHERE id = ?",
                (item.garment_id,),
            ).fetchone()
            if garment is None:
                raise HTTPException(status_code=422, detail="没有这件衣服")
            if garment["category"] != item.slot:
                raise HTTPException(status_code=422, detail="槽位不正确")
            seen.add(item.slot)
            cleaned.append(item)
        cleaned.sort(key=lambda item: CATEGORIES.index(item.slot))
        timestamp = now()
        connection.execute("DELETE FROM outfits WHERE member_id = ?", (member_id,))
        for item in cleaned:
            connection.execute(
                """
                INSERT INTO outfits (member_id, slot, garment_id, updated_at)
                VALUES (?, ?, ?, ?)
                """,
                (member_id, item.slot, item.garment_id, timestamp),
            )
    return _with_drape(member_id, cleaned)
