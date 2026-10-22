from collections import Counter


def suggest_rows(rows: list[dict]) -> list[dict]:
    sets = [_dress(row, rows, jacket=False) for row in rows if row["category"] == "套装"]
    if sets:
        return _best(sets)
    dresses = [_dress(row, rows, jacket=False) for row in rows if row["category"] == "连衣裙"]
    if dresses:
        return _best(dresses)
    tops = [row for row in rows if row["category"] == "上衣"]
    bottoms = [row for row in rows if row["category"] in {"下装", "半裙"}]
    pairs = [_dress(top, rows, jacket=True, extra=bottom) for top in tops for bottom in bottoms]
    return _best(pairs) if pairs else []


def _best(looks: list[list[dict]]) -> list[dict]:
    return max(looks, key=lambda rows: (_points(rows), " ".join(row["name"] for row in rows)))


def _dress(core: dict, rows: list[dict], jacket: bool, extra: dict | None = None) -> list[dict]:
    chosen = [core] if extra is None else [core, extra]
    if jacket and _cool(chosen):
        chosen = _add(chosen, rows, "外套")
    chosen = _add(chosen, rows, "鞋")
    return _add(chosen, rows, "配饰")


def _add(chosen: list[dict], rows: list[dict], category: str) -> list[dict]:
    base = _points(chosen)
    best: dict | None = None
    best_key: tuple[int, str] | None = None
    for row in rows:
        if row["category"] != category:
            continue
        score = _points(chosen + [row])
        key = (score, row["name"])
        if score >= base and (best_key is None or key > best_key):
            best = row
            best_key = key
    return chosen if best is None else chosen + [best]


def _cool(rows: list[dict]) -> bool:
    specific = [row.get("season") or "" for row in rows]
    specific = [season for season in specific if season and season != "四季"]
    if not specific:
        return False
    target = Counter(specific).most_common(1)[0][0]
    return target in {"秋", "冬"}


def _points(rows: list[dict]) -> int:
    seasons = [row.get("season") or "" for row in rows]
    specific = [season for season in seasons if season and season != "四季"]
    target = Counter(specific).most_common(1)[0][0] if specific else ""
    season_score = 0
    for season in seasons:
        if not season or season == "四季" or not target or season == target:
            season_score += 2
        else:
            season_score -= 3
    colors = [row.get("color") or "" for row in rows if row.get("color")]
    color_score = 1 if len(set(colors)) <= 1 else 0
    return season_score * 10 + color_score
