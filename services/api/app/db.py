import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
DATA = ROOT / "data"
DB_PATH = DATA / "weave.sqlite"

CATEGORIES = ("上衣", "下装", "半裙", "连衣裙", "外套", "鞋", "配饰")
SEASONS = ("", "春", "夏", "秋", "冬", "四季")
CONSTRUCTIONS = ("梭织", "针织", "蕾丝", "无纺")
STRETCHES = ("", "无", "低", "中", "高")
THICKNESSES = ("", "薄", "中", "厚")
OPACITIES = ("", "透明", "半透", "不透")
SHEENS = ("", "哑光", "微光", "有光")


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def init_db() -> None:
    with connect() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS garments (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                category TEXT NOT NULL,
                color TEXT NOT NULL DEFAULT '',
                pattern TEXT NOT NULL DEFAULT '',
                season TEXT NOT NULL DEFAULT '',
                fiber TEXT NOT NULL DEFAULT '',
                owner TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        columns = {
            row[1] for row in connection.execute("PRAGMA table_info(garments)")
        }
        if "image" not in columns:
            connection.execute(
                "ALTER TABLE garments ADD COLUMN image TEXT NOT NULL DEFAULT ''"
            )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS fabrics (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                composition TEXT NOT NULL DEFAULT '',
                construction TEXT NOT NULL,
                width_cm REAL,
                gsm INTEGER,
                yarn_count TEXT NOT NULL DEFAULT '',
                density TEXT NOT NULL DEFAULT '',
                stretch TEXT NOT NULL DEFAULT '',
                thickness TEXT NOT NULL DEFAULT '',
                opacity TEXT NOT NULL DEFAULT '',
                sheen TEXT NOT NULL DEFAULT '',
                pattern TEXT NOT NULL DEFAULT '',
                color TEXT NOT NULL DEFAULT '',
                remaining_m REAL NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        fabric_columns = {
            row[1] for row in connection.execute("PRAGMA table_info(fabrics)")
        }
        if "image" not in fabric_columns:
            connection.execute(
                "ALTER TABLE fabrics ADD COLUMN image TEXT NOT NULL DEFAULT ''"
            )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                height_cm INTEGER NOT NULL,
                chest_cm INTEGER,
                waist_cm INTEGER,
                hip_cm INTEGER,
                front TEXT NOT NULL DEFAULT '',
                side TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS outfits (
                member_id TEXT NOT NULL DEFAULT '',
                slot TEXT NOT NULL,
                garment_id TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                PRIMARY KEY (member_id, slot)
            )
            """
        )
