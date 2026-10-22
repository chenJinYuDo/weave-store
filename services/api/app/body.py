import json
import logging
import threading
from pathlib import Path

import numpy as np
from PIL import Image

from app.db import DATA
from app.drape import _gltf
from app.members import photo_file

BODIES = DATA / "bodies"
LOGGER = logging.getLogger("uvicorn.error")
FALLBACK = [0.86, 0.72, 0.62]
_LOCK = threading.RLock()
_MODEL = None
_MEASURE = None


def prepare_body(member_id: str, height_cm: int, chest_cm: int | None, waist_cm: int | None, hip_cm: int | None) -> Path | None:
    try:
        return _prepare(member_id, height_cm, chest_cm, waist_cm, hip_cm)
    except Exception:
        LOGGER.exception("body failed")
        _remove(member_id)
        return None


def cached_body(member_id: str, height_cm: int, chest_cm: int | None, waist_cm: int | None, hip_cm: int | None) -> Path | None:
    path = BODIES / f"{member_id}.gltf"
    meta = _meta(member_id)
    if path.is_file() and meta == _stamp(member_id, height_cm, chest_cm, waist_cm, hip_cm):
        return path
    return None


def remove_body(member_id: str) -> None:
    _remove(member_id)


def _prepare(member_id: str, height_cm: int, chest_cm: int | None, waist_cm: int | None, hip_cm: int | None) -> Path | None:
    stamp = _stamp(member_id, height_cm, chest_cm, waist_cm, hip_cm)
    path = BODIES / f"{member_id}.gltf"
    if path.is_file() and _meta(member_id) == stamp:
        return path
    vertices, faces = _shape(height_cm, chest_cm, waist_cm, hip_cm)
    placed = _place(vertices, height_cm)
    color = [*_skin(photo_file(member_id, "front")), 1.0]
    document = _gltf(
        [
            {
                "position": placed.astype(np.float32),
                "uv": np.zeros((len(placed), 2), np.float32),
                "index": faces.astype(np.uint32).reshape(-1),
                "color": color,
                "texture": b"",
            }
        ]
    )
    BODIES.mkdir(parents=True, exist_ok=True)
    path.write_text(document, encoding="utf-8")
    (BODIES / f"{member_id}.json").write_text(json.dumps(stamp), encoding="utf-8")
    return path


def _shape(height_cm: int, chest_cm: int | None, waist_cm: int | None, hip_cm: int | None):
    import torch

    model = _model()
    skipped = {"african", "asian", "caucasian"}
    phenotype = {
        label: 0.5 for label in model.phenotype_labels if label not in skipped
    }
    if "age" in phenotype:
        phenotype["age"] = 0.67
    target = height_cm / 100
    low, high = 0.0, 1.0
    for _ in range(8):
        phenotype["height"] = (low + high) / 2
        measured, _ = _sample(model, phenotype, {})
        if _value(measured, "height") < target:
            low = phenotype["height"]
        else:
            high = phenotype["height"]
    phenotype["height"] = (low + high) / 2
    local: dict[str, float] = {}
    for label, centimeters, token in (
        ("measure-bust-circ-incr", chest_cm, "bust"),
        ("measure-waist-circ-incr", waist_cm, "waist"),
        ("measure-hips-circ-incr", hip_cm, "hip"),
    ):
        if centimeters is None or label not in _local_labels(model):
            continue
        try:
            local[label] = _fit_local(model, phenotype, local, label, token, centimeters / 100)
        except KeyError:
            continue
    _, vertices = _sample(model, phenotype, local)
    faces = model.faces
    if hasattr(faces, "detach"):
        faces = faces.detach().cpu().numpy()
    return vertices, np.asarray(faces)


def _fit_local(model, phenotype: dict, local: dict, label: str, token: str, target: float) -> float:
    low, high = -1.0, 1.0
    chosen = 0.0
    for _ in range(6):
        chosen = (low + high) / 2
        trial = {**local, label: chosen}
        measured, _ = _sample(model, phenotype, trial)
        if _value(measured, token) < target:
            low = chosen
        else:
            high = chosen
    return chosen


def _sample(model, phenotype: dict, local: dict):
    import torch

    kwargs = {
        "phenotype_kwargs": {
            key: torch.tensor([value], dtype=torch.float32) for key, value in phenotype.items()
        }
    }
    if local:
        kwargs["local_changes_kwargs"] = {
            key: torch.tensor([value], dtype=torch.float32) for key, value in local.items()
        }
    output = model(**kwargs)
    rest = output.get("rest_vertices", output["vertices"])
    measured = _anthropometry()(rest)
    flat = {}
    for key, value in measured.items():
        array = value.detach().cpu().numpy() if hasattr(value, "detach") else np.asarray(value)
        flat[str(key)] = float(np.reshape(array, -1)[0])
    points = rest[0].detach().cpu().numpy()
    for token, label in (("bust", "measure-bust-circ-incr"), ("hip", "measure-hips-circ-incr")):
        girth = _girth(model, points, label)
        if girth is not None:
            flat[f"{token}_circumference"] = girth
    vertices = output["vertices"][0].detach().cpu().numpy()
    return flat, vertices


def _value(measured: dict, token: str) -> float:
    if token == "height":
        for key, value in measured.items():
            if "height" in key.lower():
                return value
    else:
        needles = {"bust": ("bust", "chest"), "waist": ("waist",), "hip": ("hip",)}[token]
        for key, value in measured.items():
            lowered = key.lower()
            if "circ" in lowered and any(name in lowered for name in needles):
                return value
    raise KeyError(sorted(measured))


def _place(vertices: np.ndarray, height_cm: int) -> np.ndarray:
    points = np.asarray(vertices, dtype=np.float64)
    span = points.max(axis=0) - points.min(axis=0)
    up = int(np.argmax(span))
    if up == 2:
        points = points[:, [0, 2, 1]]
    elif up == 0:
        points = points[:, [2, 0, 1]]
    points[:, 1] -= points[:, 1].min()
    measured = float(points[:, 1].max())
    scale = (height_cm / 170) / (measured / 1.70) if measured else 1.0
    points *= scale
    hip = 0.53 * float(points[:, 1].max())
    points[:, 1] -= hip
    points[:, 0] -= points[:, 0].mean()
    points[:, 2] -= points[:, 2].mean()
    points[:, 2] *= -1
    return points


def _skin(path: Path | None) -> list[float]:
    if path is None:
        return FALLBACK
    image = Image.open(path).convert("RGB")
    image.thumbnail((96, 96))
    pixels = np.asarray(image).reshape(-1, 3)
    red, green, blue = pixels[:, 0], pixels[:, 1], pixels[:, 2]
    mask = (red > 90) & (green > 40) & (blue > 20) & (red > green) & (red > blue) & (red - green > 12)
    if int(mask.sum()) < 24:
        return FALLBACK
    return (pixels[mask].mean(axis=0) / 255).astype(float).tolist()


def _model():
    global _MODEL
    with _LOCK:
        if _MODEL is None:
            import anny

            _MODEL = anny.Anny(local_changes="default")
            _MODEL = _MODEL.to(dtype=__import__("torch").float32)
        return _MODEL


def _anthropometry():
    global _MEASURE
    with _LOCK:
        if _MEASURE is None:
            import anny.anthropometry as anthropometry

            _MEASURE = anthropometry.Anthropometry(_model())
        return _MEASURE


def _local_labels(model) -> set[str]:
    return set(getattr(model, "local_change_labels", ()))


def _girth(model, points: np.ndarray, label: str) -> float | None:
    indices = _ring_indices(model, label)
    if indices is None:
        return None
    height = float(np.median(points[indices, 2]))
    band = points[np.abs(points[:, 2] - height) < 0.015]
    if len(band) < 12:
        return None
    center = np.median(band[:, :2], axis=0)
    core = band[np.linalg.norm(band[:, :2] - center, axis=1) < 0.18]
    if len(core) < 12:
        return None
    return _hull_perimeter(core[:, :2])


def _ring_indices(model, label: str) -> np.ndarray | None:
    cached = getattr(model, "_weave_rings", None)
    if cached is None:
        cached = {}
        model._weave_rings = cached
    if label in cached:
        return cached[label]
    names = list(model.blendshape_labels)
    key = f"local_change:{label}"
    if key not in names:
        cached[label] = None
        return None
    delta = model.blendshapes[names.index(key)].detach().cpu().numpy()
    strength = np.linalg.norm(delta, axis=1)
    cached[label] = np.argsort(strength)[-80:]
    return cached[label]


def _hull_perimeter(points: np.ndarray) -> float:
    ordered = np.unique(np.round(points, 5), axis=0)
    if len(ordered) < 3:
        return 0.0
    ordered = ordered[np.lexsort((ordered[:, 1], ordered[:, 0]))]

    def cross(origin, left, right) -> float:
        return float((left[0] - origin[0]) * (right[1] - origin[1]) - (left[1] - origin[1]) * (right[0] - origin[0]))

    lower: list[np.ndarray] = []
    for point in ordered:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], point) <= 0:
            lower.pop()
        lower.append(point)
    upper: list[np.ndarray] = []
    for point in ordered[::-1]:
        while len(upper) >= 2 and cross(upper[-2], upper[-1], point) <= 0:
            upper.pop()
        upper.append(point)
    hull = np.asarray(lower[:-1] + upper[:-1], dtype=np.float64)
    if len(hull) < 3:
        return 0.0
    return float(np.linalg.norm(np.roll(hull, -1, axis=0) - hull, axis=1).sum())


def _stamp(member_id: str, height_cm: int, chest_cm: int | None, waist_cm: int | None, hip_cm: int | None) -> dict:
    front = photo_file(member_id, "front")
    return {
        "fit": 2,
        "height_cm": height_cm,
        "chest_cm": chest_cm,
        "waist_cm": waist_cm,
        "hip_cm": hip_cm,
        "photo": front.stat().st_mtime_ns if front is not None else 0,
    }


def _meta(member_id: str) -> dict | None:
    path = BODIES / f"{member_id}.json"
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def _remove(member_id: str) -> None:
    for suffix in (".gltf", ".json"):
        path = BODIES / f"{member_id}{suffix}"
        if path.is_file():
            path.unlink()
