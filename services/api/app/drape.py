import base64
import io
import json
import logging
import re
from pathlib import Path

import numpy as np
from PIL import Image

from app.capture import image_file
from app.db import DATA

DRAPES = DATA / "drapes"
STANDARD_CM = 170
LOGGER = logging.getLogger("uvicorn.error")
STEPS = 28
ITERS = 8
MATERIALS = {
    "stiff": (2e-8, 5e-7),
    "woven": (2e-5, 2e-4),
    "knit": (4e-5, 5e-4),
    "soft": (4e-3, 3e-2),
}


class Panel:
    def __init__(self, cols, rows, half_width, length, x, radius, top):
        self.cols = cols
        self.rows = rows
        self.half_width = half_width
        self.length = length
        self.x = x
        self.radius = radius
        self.top = top


TEMPLATES = {
    "tee": [Panel(32, 36, 0.26, 0.42, 0.0, 0.18, 0.70)],
    "shirt": [Panel(36, 48, 0.24, 0.68, 0.0, 0.18, 0.70)],
    "knit": [Panel(34, 42, 0.27, 0.50, 0.0, 0.18, 0.70)],
    "jacket": [Panel(36, 44, 0.30, 0.60, 0.0, 0.21, 0.72)],
    "trousers": [
        Panel(22, 46, 0.08, 0.70, -0.11, 0.08, 0.02),
        Panel(22, 46, 0.08, 0.70, 0.11, 0.08, 0.02),
    ],
    "jeans": [
        Panel(22, 46, 0.08, 0.70, -0.11, 0.08, 0.02),
        Panel(22, 46, 0.08, 0.70, 0.11, 0.08, 0.02),
    ],
    "skirt": [Panel(40, 36, 0.30, 0.42, 0.0, 0.16, 0.02)],
    "dress": [Panel(34, 64, 0.26, 0.96, 0.0, 0.18, 0.70)],
}


def template_for(category: str, fiber: str, name: str) -> str | None:
    text = f"{name}{fiber}"
    if category in ("鞋", "配饰"):
        return None
    if category == "外套":
        return "jacket"
    if category == "半裙":
        return "skirt"
    if category == "连衣裙":
        return "dress"
    if category == "下装":
        return "jeans" if "牛仔" in text else "trousers"
    if category == "上衣":
        if "针织" in text:
            return "knit"
        if "T恤" in name or "t恤" in name.lower():
            return "tee"
        return "shirt"
    return None


def material_for(fiber: str, template: str) -> str:
    text = fiber or ""
    if any(word in text for word in ("雪纺", "真丝", "丝绸")):
        return "soft"
    if "针织" in text or template == "knit":
        return "knit"
    if any(word in text for word in ("棉", "麻", "牛仔")) or template in ("jacket", "jeans"):
        return "stiff"
    return "woven"


def hem_height(kind: str) -> float:
    grid = _pose_panel(TEMPLATES["shirt"][0], MATERIALS[kind])
    return float(grid[-1, :, 1].mean())


def update_outfit_drape(member_id: str, garments: list[dict], height_cm: int = STANDARD_CM) -> str:
    try:
        return _update_outfit_drape(member_id, garments, height_cm)
    except Exception:
        LOGGER.exception("drape failed")
        key = _member_key(member_id)
        folder = DRAPES / "outfits"
        folder.mkdir(parents=True, exist_ok=True)
        _remove(folder / f"{key}.gltf")
        slots = [f"{item['slot']}:{item['id']}" for item in garments]
        _write_meta(folder / f"{key}.json", slots, False, "垂坠没有完成", height_cm)
        return "垂坠没有完成"


def prepare_outfit_drape(member_id: str, garments: list[dict], height_cm: int) -> tuple[str, str]:
    if not _matches(member_id, garments, height_cm):
        update_outfit_drape(member_id, garments, height_cm)
    return display_state(member_id, garments, height_cm)


def _update_outfit_drape(member_id: str, garments: list[dict], height_cm: int) -> str:
    key = _member_key(member_id)
    slots = [f"{item['slot']}:{item['id']}" for item in garments]
    meshes = []
    for item in garments:
        template = template_for(item["category"], item.get("fiber", ""), item.get("name", ""))
        if template is None:
            continue
        meshes.append(_cached_mesh(item, template))
    folder = DRAPES / "outfits"
    folder.mkdir(parents=True, exist_ok=True)
    if not meshes:
        _remove(folder / f"{key}.gltf")
        message = "这几件不需要垂坠" if garments else ""
        _write_meta(folder / f"{key}.json", slots, False, message, height_cm)
        return message
    scale = height_cm / STANDARD_CM
    (folder / f"{key}.gltf").write_text(_gltf(_merge(meshes, scale)), encoding="utf-8")
    _write_meta(folder / f"{key}.json", slots, True, "", height_cm)
    return ""


def display_state(member_id: str, garments: list[dict], height_cm: int = STANDARD_CM) -> tuple[str, str]:
    key = _member_key(member_id)
    meta_path = DRAPES / "outfits" / f"{key}.json"
    gltf_path = DRAPES / "outfits" / f"{key}.gltf"
    if not meta_path.is_file():
        return "", ""
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    slots = [f"{item['slot']}:{item['id']}" for item in garments]
    if meta.get("slots") != slots or meta.get("height_cm") != height_cm:
        return "", ""
    if not meta.get("ready") or not gltf_path.is_file():
        return "", meta.get("message", "")
    version = int(gltf_path.stat().st_mtime)
    if member_id:
        url = f"/api/outfits/display.gltf?member_id={member_id}&v={version}"
    else:
        url = f"/api/outfits/display.gltf?v={version}"
    return url, ""


def display_path(member_id: str) -> Path | None:
    path = DRAPES / "outfits" / f"{_member_key(member_id)}.gltf"
    if path.is_file():
        return path
    return None


def _member_key(member_id: str) -> str:
    if member_id == "":
        return "none"
    if not re.fullmatch(r"[0-9a-f]{32}", member_id):
        raise ValueError(member_id)
    return member_id


def _cached_mesh(item: dict, template: str) -> dict:
    kind = material_for(item.get("fiber", ""), template)
    photo = image_file(item.get("image") or "")
    stamp = "0"
    if photo is not None:
        stat = photo.stat()
        stamp = f"{stat.st_size}-{int(stat.st_mtime)}"
    folder = DRAPES / "garments"
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{item['id']}-{template}-{kind}-{stamp}.npz"
    if not path.is_file():
        posed = [_pose_panel(panel, MATERIALS[kind]) for panel in TEMPLATES[template]]
        display, uvs, indices, sim_faces, display_faces = _decimate(posed)
        if display_faces > 10000 or display_faces >= sim_faces:
            raise RuntimeError("display mesh was not reduced")
        texture = _texture(photo)
        np.savez_compressed(
            path,
            position=np.concatenate([panel.reshape(-1, 3) for panel in posed]).astype(np.float32),
            display=display.astype(np.float32),
            uv=uvs.astype(np.float32),
            index=indices.astype(np.uint16),
            sim_faces=np.int32(sim_faces),
            display_faces=np.int32(display_faces),
            texture=np.frombuffer(texture, dtype=np.uint8) if texture else np.zeros(0, np.uint8),
            color=np.array(_color(item), dtype=np.float32),
        )
    saved = np.load(path)
    texture = saved["texture"].tobytes() if saved["texture"].size else None
    return {
        "display": saved["display"],
        "uv": saved["uv"],
        "index": saved["index"],
        "texture": texture,
        "color": saved["color"],
        "sim_faces": int(saved["sim_faces"]),
        "display_faces": int(saved["display_faces"]),
    }


def _pose_panel(panel: Panel, compliance: tuple[float, float]) -> np.ndarray:
    cols, rows = panel.cols, panel.rows
    xs = np.linspace(-panel.half_width, panel.half_width, cols)
    ys = np.linspace(panel.top, panel.top - panel.length, rows)
    grid_x, grid_y = np.meshgrid(xs, ys)
    theta = grid_x / panel.half_width * 0.7
    position = np.stack(
        [
            np.sin(theta) * panel.radius + panel.x,
            grid_y,
            np.cos(theta) * panel.radius,
        ],
        axis=-1,
    ).reshape(-1, 3)
    rest = position.copy()
    previous = position.copy()
    pinned = np.zeros(cols * rows, dtype=bool)
    pinned[:cols] = True
    inverse = np.where(pinned, 0.0, 1.0)
    groups, lengths = _constraints(rest, cols, rows)
    multipliers = [[np.zeros(len(edges)) for edges in group] for group in groups]
    dt = 1 / 60
    gravity = np.array([0.0, -8.0, 0.0])
    alphas = (
        compliance[0] / dt**2,
        compliance[0] / dt**2,
        compliance[1] / dt**2,
    )
    for _step in range(STEPS):
        predicted = position + 0.99 * (position - previous) + gravity * dt * dt
        previous = position.copy()
        position = predicted
        position[pinned] = rest[pinned]
        for group in multipliers:
            for values in group:
                values[:] = 0
        for _iteration in range(ITERS):
            for group, group_lengths, group_multipliers, alpha in zip(
                groups, lengths, multipliers, alphas
            ):
                for edges, length, values in zip(group, group_lengths, group_multipliers):
                    _solve(position, edges, length, values, inverse, alpha)
            radius = position[:, 0] ** 2 + position[:, 2] ** 2
            inside = (radius < 0.11**2) & (position[:, 1] > 0.02) & (position[:, 1] < 0.62) & ~pinned
            if np.any(inside):
                scale = 0.11 / np.sqrt(np.maximum(radius[inside], 1e-8))
                position[inside, 0] *= scale
                position[inside, 2] *= scale
            position[pinned] = rest[pinned]
    if not np.isfinite(position).all():
        raise RuntimeError("drape did not converge")
    return position.reshape(rows, cols, 3)


def _constraints(rest: np.ndarray, cols: int, rows: int):
    horizontal, vertical, bends = [], [], []
    for row in range(rows):
        for col in range(cols):
            index = row * cols + col
            if col + 1 < cols:
                horizontal.append((index, index + 1, col % 2))
            if row + 1 < rows:
                vertical.append((index, index + cols, row % 2))
            if row + 2 < rows:
                bends.append((index, index + 2 * cols, row % 4))
    grouped = (_buckets(horizontal, 2), _buckets(vertical, 2), _buckets(bends, 4))
    lengths = [
        [np.linalg.norm(rest[edges[:, 1]] - rest[edges[:, 0]], axis=1) for edges in group]
        for group in grouped
    ]
    return grouped, lengths


def _buckets(pairs: list[tuple[int, int, int]], colors: int) -> list[np.ndarray]:
    array = np.array(pairs, dtype=np.int32)
    return [array[array[:, 2] == color][:, :2] for color in range(colors)]


def _solve(position, edges, length, values, inverse, alpha) -> None:
    first, second = edges[:, 0], edges[:, 1]
    delta = position[second] - position[first]
    distance = np.maximum(np.linalg.norm(delta, axis=1), 1e-8)
    error = distance - length
    weight = inverse[first] + inverse[second]
    change = (-error - alpha * values) / (weight + alpha)
    values += change
    direction = delta / distance[:, None]
    position[first] -= direction * (change * inverse[first])[:, None]
    position[second] += direction * (change * inverse[second])[:, None]


def _decimate(panels: list[np.ndarray]):
    displays, uvs, indices = [], [], []
    sim_faces = 0
    offset = 0
    for panel in panels:
        rows, cols, _ = panel.shape
        sim_faces += (cols - 1) * (rows - 1) * 2
        row_index = _samples(rows)
        col_index = _samples(cols)
        coarse = panel[np.ix_(row_index, col_index)]
        point_count = coarse.shape[0] * coarse.shape[1]
        displays.append(coarse.reshape(-1, 3))
        uu, vv = np.meshgrid(
            np.linspace(0, 1, coarse.shape[1]),
            np.linspace(1, 0, coarse.shape[0]),
        )
        uvs.append(np.stack([uu, vv], axis=-1).reshape(-1, 2))
        indices.append(_faces(coarse.shape[0], coarse.shape[1]) + offset)
        offset += point_count
    return (
        np.concatenate(displays),
        np.concatenate(uvs),
        np.concatenate(indices),
        sim_faces,
        int(sum(len(face) for face in indices)),
    )


def _samples(count: int) -> list[int]:
    chosen = list(range(0, count, 2))
    if chosen[-1] != count - 1:
        chosen.append(count - 1)
    return chosen


def _faces(rows: int, cols: int) -> np.ndarray:
    faces = []
    for row in range(rows - 1):
        for col in range(cols - 1):
            a = row * cols + col
            b = a + 1
            c = a + cols
            d = c + 1
            faces.append((a, c, b))
            faces.append((b, c, d))
    return np.array(faces, dtype=np.int32)


def _texture(photo: Path | None) -> bytes | None:
    if photo is None:
        return None
    image = Image.open(photo).convert("RGB")
    image.thumbnail((1024, 1024))
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    return buffer.getvalue()


def _color(item: dict) -> list[float]:
    text = f"{item.get('name', '')}{item.get('color', '')}"
    if "白" in text:
        return [0.94, 0.94, 0.93, 1]
    if "黑" in text:
        return [0.22, 0.22, 0.24, 1]
    if "蓝" in text:
        return [0.29, 0.43, 0.65, 1]
    return [0.82, 0.78, 0.72, 1]


def _matches(member_id: str, garments: list[dict], height_cm: int) -> bool:
    key = _member_key(member_id)
    meta_path = DRAPES / "outfits" / f"{key}.json"
    if not meta_path.is_file():
        return False
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    slots = [f"{item['slot']}:{item['id']}" for item in garments]
    if meta.get("slots") != slots or meta.get("height_cm") != height_cm:
        return False
    if meta.get("ready") and not (DRAPES / "outfits" / f"{key}.gltf").is_file():
        return False
    return True


def _merge(meshes: list[dict], scale: float):
    center = np.concatenate([mesh["display"] for mesh in meshes]).mean(axis=0)
    parts = []
    for mesh in meshes:
        parts.append(
            {
                "position": ((mesh["display"] - center) * scale).astype(np.float32),
                "uv": mesh["uv"].astype(np.float32),
                "index": mesh["index"].astype(np.uint16),
                "texture": mesh["texture"],
                "color": mesh["color"],
            }
        )
    return parts


def _gltf(parts) -> str:
    blob = b""
    views = []
    accessors = []
    images = []
    gltf_textures = []
    materials = []
    primitives = []

    def push(array: np.ndarray, component: int, kind: str):
        nonlocal blob
        raw = np.ascontiguousarray(array).tobytes()
        start = len(blob)
        blob += raw
        blob += b"\x00" * ((4 - len(blob) % 4) % 4)
        views.append({"buffer": 0, "byteOffset": start, "byteLength": len(raw)})
        accessor = {
            "bufferView": len(views) - 1,
            "componentType": component,
            "count": int(array.shape[0]) if kind != "SCALAR" else int(array.size),
            "type": kind,
        }
        if kind == "VEC3":
            accessor["min"] = array.min(axis=0).astype(float).tolist()
            accessor["max"] = array.max(axis=0).astype(float).tolist()
        accessors.append(accessor)
        return len(accessors) - 1

    for part in parts:
        material = {
            "doubleSided": True,
            "pbrMetallicRoughness": {
                "baseColorFactor": [float(channel) for channel in part["color"]],
                "metallicFactor": 0,
                "roughnessFactor": 0.86,
            },
        }
        if part["texture"]:
            raw = part["texture"]
            start = len(blob)
            blob += raw
            blob += b"\x00" * ((4 - len(blob) % 4) % 4)
            views.append({"buffer": 0, "byteOffset": start, "byteLength": len(raw)})
            images.append({"bufferView": len(views) - 1, "mimeType": "image/jpeg"})
            gltf_textures.append({"source": len(images) - 1})
            material["pbrMetallicRoughness"]["baseColorTexture"] = {
                "index": len(gltf_textures) - 1
            }
        materials.append(material)
        primitives.append(
            {
                "attributes": {
                    "POSITION": push(part["position"], 5126, "VEC3"),
                    "TEXCOORD_0": push(part["uv"], 5126, "VEC2"),
                },
                "indices": push(part["index"], 5123, "SCALAR"),
                "material": len(materials) - 1,
                "mode": 4,
            }
        )
    document = {
        "asset": {"version": "2.0"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0}],
        "meshes": [{"primitives": primitives}],
        "materials": materials,
        "buffers": [
            {
                "byteLength": len(blob),
                "uri": "data:application/octet-stream;base64," + base64.b64encode(blob).decode(),
            }
        ],
        "bufferViews": views,
        "accessors": accessors,
    }
    if images:
        document["images"] = images
        document["textures"] = gltf_textures
    return json.dumps(document, ensure_ascii=False)


def _write_meta(path: Path, slots: list[str], ready: bool, message: str, height_cm: int) -> None:
    path.write_text(
        json.dumps(
            {"slots": slots, "ready": ready, "message": message, "height_cm": height_cm},
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )


def _remove(path: Path) -> None:
    if path.is_file():
        path.unlink()
