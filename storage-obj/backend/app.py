from __future__ import annotations

import json
import os
import random
import string
import time
from contextlib import closing
from pathlib import Path
from threading import Lock
from typing import Any, Callable

from flask import Flask, jsonify, request, send_from_directory
from object import register_object_routes
from service import register_service_routes
from space import register_space_routes
from utils import lexorank_between, lexorank_initial

psycopg_import_error = None
try:
    from psycopg import connect
except Exception as error:
    connect = None
    psycopg_import_error = error

ms48_id_lock = Lock()
ms48_last_timestamp_ms = 0
ms48_offset = -1
object_type_min_value = -2147483648
object_type_max_value = 2147483647

def make_json_response(code: int, data: Any = None, message: str = ""):
    response_data = {"code": code}
    if data is not None:
        response_data["data"] = data
    if message:
        response_data["message"] = message
    return jsonify(response_data)


def get_dir_base() -> Path:
    current_dir = Path(__file__).resolve().parent
    default_base = current_dir.parent
    return Path(os.environ.get("DIR_BASE", str(default_base))).resolve()


def get_build_dir() -> Path:
    return get_dir_base() / "build"


def get_db_config() -> dict[str, Any]:
    return {
        "host": os.environ.get("DB_HOST", "127.0.0.1"),
        "port": int(os.environ.get("DB_PORT", "5432")),
        "dbname": os.environ.get("DB_NAME", "postgres"),
        "user": os.environ.get("DB_USER", "postgres"),
        "password": os.environ.get("DB_PASSWORD", "postgres"),
    }


def normalize_database_preset(raw_item: dict[str, Any], fallback_key: str):
    key = str(raw_item.get("KEY") or raw_item.get("key") or fallback_key).strip()
    label = str(raw_item.get("LABEL") or raw_item.get("label") or raw_item.get("NAME") or raw_item.get("name") or key).strip()
    host = str(raw_item.get("IP") or raw_item.get("host") or "127.0.0.1").strip()
    port_raw = raw_item.get("PORT") if raw_item.get("PORT") is not None else raw_item.get("port")
    try:
        port = int(port_raw)
    except Exception:
        port = 5432
    database_name = str(raw_item.get("DATABASE_NAME") or raw_item.get("databaseName") or "postgres").strip()
    username = str(raw_item.get("USERNAME") or raw_item.get("username") or "postgres").strip()
    password = str(raw_item.get("PASSWORD") or raw_item.get("password") or "postgres")
    return {
        "key": key,
        "label": label,
        "host": host,
        "port": port,
        "databaseName": database_name,
        "username": username,
        "password": password,
    }


def load_database_preset_list():
    raw_list_text = str(os.environ.get("DATABASE_LIST_JSON", "")).strip()
    preset_list = []
    if raw_list_text:
        try:
            parsed_list = json.loads(raw_list_text)
            if isinstance(parsed_list, list):
                for idx, raw_item in enumerate(parsed_list):
                    if isinstance(raw_item, dict):
                        preset_list.append(normalize_database_preset(raw_item, f"db_{idx + 1}"))
        except Exception:
            preset_list = []
    if not preset_list:
        default_db_config = get_db_config()
        preset_list = [
            normalize_database_preset(
                {
                    "KEY": "default",
                    "LABEL": "default",
                    "IP": default_db_config["host"],
                    "PORT": default_db_config["port"],
                    "DATABASE_NAME": default_db_config["dbname"],
                    "USERNAME": default_db_config["user"],
                    "PASSWORD": default_db_config["password"],
                },
                "default",
            )
        ]
    return preset_list


def to_db_config_from_preset(preset_item: dict[str, Any]):
    return {
        "host": str(preset_item["host"]),
        "port": int(preset_item["port"]),
        "dbname": str(preset_item["databaseName"]),
        "user": str(preset_item["username"]),
        "password": str(preset_item["password"]),
    }


def build_database_list_payload():
    return [
        {
            "key": item["key"],
            "label": item["label"],
            "host": item["host"],
            "port": item["port"],
            "databaseName": item["databaseName"],
            "username": item["username"],
            "isCurrent": item["key"] == current_database_key,
        }
        for item in database_preset_list
    ]


def find_database_preset_by_key(database_key: str):
    normalized_database_key = str(database_key or "").strip()
    if not normalized_database_key:
        return None
    return next((item for item in database_preset_list if item["key"] == normalized_database_key), None)


def test_database_connection(db_config: dict[str, Any], timeout_seconds: int = 5):
    if connect is None:
        import_error_text = str(psycopg_import_error) if psycopg_import_error else "unknown import error"
        raise RuntimeError(f"psycopg is not installed: {import_error_text}")
    db = None
    try:
        db = connect(**db_config, connect_timeout=max(1, int(timeout_seconds)))
        with closing(db.cursor()) as cursor:
            cursor.execute("select 1 as ok")
            row = cursor.fetchone()
        if not row or row[0] != 1:
            raise RuntimeError("database probe returned unexpected result")
        return {"database": "ok"}
    finally:
        if db is not None:
            db.close()


def run_sql_script_text(db, script_text: str):
    with closing(db.cursor()) as cursor:
        cursor.execute(script_text)


def load_sql_script_text(script_file_name: str):
    script_file_path = get_dir_base() / "database" / script_file_name
    if not script_file_path.is_file():
        raise RuntimeError(f"sql file not found: {script_file_path}")
    return script_file_path.read_text(encoding="utf-8")


def check_table_has_columns(cursor, table_name: str, required_column_names: list[str]):
    cursor.execute(
        """
        select column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = %s
        """,
        (table_name,),
    )
    row_list = cursor.fetchall() or []
    existing_column_name_set = {str(row[0] or "") for row in row_list}
    missing_column_names = [column_name for column_name in required_column_names if column_name not in existing_column_name_set]
    return {
        "tableName": table_name,
        "isTableFound": bool(existing_column_name_set),
        "missingColumnNames": missing_column_names,
        "isOk": bool(existing_column_name_set) and len(missing_column_names) == 0,
    }


def build_table_issue_text_list(failed_items: list[dict]):
    issue_text_list: list[str] = []
    for item in failed_items:
        table_name = str(item.get("tableName") or "")
        is_table_found = item.get("isTableFound") is True
        missing_column_names = item.get("missingColumnNames") or []
        if not is_table_found:
            issue_text_list.append(f"{table_name}: table not found")
            continue
        if len(missing_column_names) > 0:
            issue_text_list.append(f"{table_name}: missing columns [{', '.join(str(name) for name in missing_column_names)}]")
            continue
        issue_text_list.append(f"{table_name}: unknown issue")
    return issue_text_list


database_preset_list = load_database_preset_list()
database_index_raw = os.environ.get("DATABASE_INDEX", "0")
try:
    database_index = int(database_index_raw)
except Exception:
    database_index = 0
if database_index < 0 or database_index >= len(database_preset_list):
    database_index = 0

current_database_key = str(database_preset_list[database_index]["key"])
active_database_config = to_db_config_from_preset(database_preset_list[database_index])
is_database_switching = False


def run_in_transaction(action: Callable[[Any], Any]):
    db = None
    try:
        if connect is None:
            test_conda_env = os.environ.get("TEST_CONDA_ENV", "").strip()
            import_error_text = str(psycopg_import_error) if psycopg_import_error else "unknown import error"
            if test_conda_env:
                raise RuntimeError(
                    "psycopg is not installed in TEST_CONDA_ENV="
                    f"{test_conda_env}. import error: {import_error_text}. "
                    f"run: conda activate {test_conda_env} && pip install -r backend/requirements.txt"
                )
            raise RuntimeError(
                "psycopg is not installed. import error: "
                f"{import_error_text}. run: pip install -r backend/requirements.txt"
            )
        db = connect(**active_database_config)
        db.autocommit = False
        result = action(db)
        db.commit()
        return make_json_response(0, data=result)
    except Exception as error:
        if db is not None:
            db.rollback()
        return make_json_response(-1, message=str(error)), 500
    finally:
        if db is not None:
            db.close()


def ensure_metadata_table(cursor):
    cursor.execute(
        """
        create table if not exists metadata (
            tag text primary key,
            rank varchar(10),
            valueType smallint,
            valueText text,
            valueJson jsonb,
            valueBytes bytea,
            valueInt bigint,
            valueBoolean boolean,
            updatedAt timestamptz default now(),
            updatedAtTz varchar(6)
        )
        """
    )
    cursor.execute("alter table metadata add column if not exists rank varchar(10)")


def is_valid_space_id(space_id: str):
    return bool(space_id) and all(ch in string.ascii_lowercase + string.digits for ch in space_id)


def create_random_space_id(length: int = 10):
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def create_ms48_id():
    global ms48_last_timestamp_ms
    global ms48_offset
    with ms48_id_lock:
        current_timestamp_ms = int(time.time() * 1000)
        if current_timestamp_ms != ms48_last_timestamp_ms:
            ms48_last_timestamp_ms = current_timestamp_ms
            ms48_offset = 0
        else:
            ms48_offset = ms48_offset + 1
            if ms48_offset > 0xFFFF:
                while current_timestamp_ms <= ms48_last_timestamp_ms:
                    time.sleep(0.001)
                    current_timestamp_ms = int(time.time() * 1000)
                ms48_last_timestamp_ms = current_timestamp_ms
                ms48_offset = 0
        id_value = (ms48_last_timestamp_ms << 16) | (ms48_offset & 0xFFFF)
        return str(id_value)


def normalize_payload_type(data_type_raw: str):
    data_type = str(data_type_raw or "").strip().lower()
    if data_type not in ("text", "bytes", "json"):
        raise RuntimeError("dataType should be one of text/bytes/json")
    return data_type


def get_object_table_name(space_id: str, data_type: str):
    if not is_valid_space_id(space_id):
        raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
    normalized_data_type = normalize_payload_type(data_type)
    return f"space_{space_id}_object_{normalized_data_type}_status"


def get_payload_column_name(data_type: str):
    normalized_data_type = normalize_payload_type(data_type)
    if normalized_data_type == "text":
        return "valueText"
    if normalized_data_type == "bytes":
        return "valueBytes"
    return "valueJson"


def get_object_history_table_name(space_id: str, data_type: str):
    if not is_valid_space_id(space_id):
        raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
    normalized_data_type = normalize_payload_type(data_type)
    return f"space_{space_id}_object_{normalized_data_type}_history"


def normalize_object_type_value(raw_value: Any, default_value: int = -1, allow_none: bool = False):
    if raw_value is None:
        return None if allow_none else default_value
    raw_text = str(raw_value).strip()
    if raw_text == "":
        return None if allow_none else default_value
    try:
        normalized_value = int(raw_text)
    except Exception:
        raise RuntimeError("type should be a signed integer")
    if normalized_value < object_type_min_value or normalized_value > object_type_max_value:
        raise RuntimeError(f"type should be within {object_type_min_value}..{object_type_max_value}")
    return normalized_value


def parse_base64_payload(value: Any):
    encoded_text = str(value or "")
    comma_idx = encoded_text.find(",")
    raw_base64 = encoded_text[comma_idx + 1 :] if comma_idx >= 0 else encoded_text
    return raw_base64.strip()


def ensure_object_status_table(cursor, space_id: str, data_type: str):
    table_name = get_object_table_name(space_id, data_type)
    normalized_data_type = normalize_payload_type(data_type)
    value_column_name = get_payload_column_name(normalized_data_type)
    value_column_sql = "text" if normalized_data_type == "text" else "bytea" if normalized_data_type == "bytes" else "jsonb"
    cursor.execute(
        f"""
        create table if not exists {table_name} (
            objectId text primary key,
            {value_column_name} {value_column_sql},
            type integer not null default -1,
            isDeleted boolean not null default false,
            editType smallint not null default 0,
            createdAt timestamptz default now(),
            updatedAt timestamptz default now(),
            updatedAtTz varchar(6)
        )
        """
    )
    cursor.execute(f"alter table {table_name} add column if not exists {value_column_name} {value_column_sql}")
    cursor.execute(f"alter table {table_name} add column if not exists type integer not null default -1")
    cursor.execute(f"alter table {table_name} add column if not exists isDeleted boolean not null default false")
    cursor.execute(f"alter table {table_name} add column if not exists editType smallint not null default 0")
    cursor.execute(f"alter table {table_name} add column if not exists createdAt timestamptz default now()")
    cursor.execute(f"alter table {table_name} add column if not exists updatedAt timestamptz default now()")
    cursor.execute(f"alter table {table_name} add column if not exists updatedAtTz varchar(6)")
    history_table_name = get_object_history_table_name(space_id, normalized_data_type)
    cursor.execute(
        f"""
        create table if not exists {history_table_name} (
            objectId text not null,
            versionNum bigint not null,
            {value_column_name} {value_column_sql},
            isDataDeleted boolean not null default false,
            createdAt timestamptz default now(),
            primary key (objectId, versionNum)
        )
        """
    )
    cursor.execute(f"alter table {history_table_name} add column if not exists {value_column_name} {value_column_sql}")
    cursor.execute(f"alter table {history_table_name} add column if not exists isDataDeleted boolean not null default false")
    cursor.execute(f"alter table {history_table_name} add column if not exists createdAt timestamptz default now()")


def read_spaces_id_list(cursor):
    ensure_metadata_table(cursor)
    cursor.execute(
        """
        select valueJson
        from metadata
        where tag = 'spacesIdList'
        """
    )
    row = cursor.fetchone()
    if not row or row[0] is None:
        return []
    value = row[0]
    if isinstance(value, list):
        return [str(item) for item in value if isinstance(item, (str, int))]
    return []


def write_spaces_id_list(cursor, spaces_id_list):
    ensure_metadata_table(cursor)
    cursor.execute(
        """
        insert into metadata(tag, valueType, valueJson, updatedAt)
        values ('spacesIdList', 2, %s::jsonb, now())
        on conflict (tag) do update set
            valueType = excluded.valueType,
            valueJson = excluded.valueJson,
            updatedAt = now()
        """,
        (json.dumps(spaces_id_list),),
    )


def ensure_space_metadata_table(cursor, space_id: str):
    if not is_valid_space_id(space_id):
        raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
    cursor.execute(
        f"""
        create table if not exists space_{space_id}_metadata (
            tag text primary key,
            rank varchar(10),
            valueType smallint,
            valueText text,
            valueJson jsonb,
            valueBytes bytea,
            valueInt bigint,
            valueBoolean boolean,
            updatedAt timestamptz default now(),
            updatedAtTz varchar(6)
        )
        """
    )
    cursor.execute(f"alter table space_{space_id}_metadata add column if not exists rank varchar(10)")


def read_space_name(cursor, space_id: str):
    ensure_space_metadata_table(cursor, space_id)
    cursor.execute(
        f"""
        select valueText
        from space_{space_id}_metadata
        where tag = 'name'
        """
    )
    row = cursor.fetchone()
    if not row:
        return ""
    return str(row[0] or "").strip()


def read_space_metadata_rows(cursor, space_id: str):
    ensure_space_metadata_table(cursor, space_id)
    cursor.execute(
        f"""
        select tag, rank
        from space_{space_id}_metadata
        order by rank asc nulls last, tag asc
        """
    )
    row_list = cursor.fetchall() or []
    return [
        {
            "tag": str(row[0] or ""),
            "rank": str(row[1] or ""),
        }
        for row in row_list
    ]


def generate_appendable_rank(rank_text_list):
    normalized_rank_list = [str(rank_text or "").strip().lower() for rank_text in (rank_text_list or []) if str(rank_text or "").strip()]
    if not normalized_rank_list:
        return lexorank_initial()
    try:
        return lexorank_between(normalized_rank_list[-1], None)
    except ValueError:
        pass
    for idx in range(len(normalized_rank_list) - 2, -1, -1):
        rank_left = normalized_rank_list[idx]
        rank_right = normalized_rank_list[idx + 1]
        try:
            return lexorank_between(rank_left, rank_right)
        except ValueError:
            continue
    return lexorank_between(None, normalized_rank_list[0])


def resolve_space_metadata_rank(cursor, space_id: str, tag: str, requested_rank: str):
    normalized_requested_rank = str(requested_rank or "").strip().lower()
    if normalized_requested_rank:
        return normalized_requested_rank
    cursor.execute(
        f"""
        select rank
        from space_{space_id}_metadata
        where tag = %s
        limit 1
        """,
        (tag,),
    )
    existing_row = cursor.fetchone()
    existing_rank = str(existing_row[0] or "").strip().lower() if existing_row else ""
    if existing_rank:
        return existing_rank
    cursor.execute(
        f"""
        select rank
        from space_{space_id}_metadata
        where rank is not null and rank <> ''
        order by rank asc
        """
    )
    rank_row_list = cursor.fetchall() or []
    rank_text_list = [str(row[0] or "").strip().lower() for row in rank_row_list]
    return generate_appendable_rank(rank_text_list)


def get_current_database_key():
    return current_database_key


def set_current_database_key(value: str):
    global current_database_key
    current_database_key = value


def get_active_database_config():
    return active_database_config


def set_active_database_config(value: dict[str, Any]):
    global active_database_config
    active_database_config = value


def get_is_database_switching():
    return is_database_switching


def set_is_database_switching(value: bool):
    global is_database_switching
    is_database_switching = value


app = Flask(__name__)

register_service_routes(
    app,
    {
        "make_json_response": make_json_response,
        "run_in_transaction": run_in_transaction,
        "find_database_preset_by_key": find_database_preset_by_key,
        "to_db_config_from_preset": to_db_config_from_preset,
        "test_database_connection": test_database_connection,
        "build_database_list_payload": build_database_list_payload,
        "load_sql_script_text": load_sql_script_text,
        "run_sql_script_text": run_sql_script_text,
        "check_table_has_columns": check_table_has_columns,
        "build_table_issue_text_list": build_table_issue_text_list,
        "is_valid_space_id": is_valid_space_id,
        "connect": connect,
        "psycopg_import_error": psycopg_import_error,
        "get_current_database_key": get_current_database_key,
        "set_current_database_key": set_current_database_key,
        "get_active_database_config": get_active_database_config,
        "set_active_database_config": set_active_database_config,
        "get_is_database_switching": get_is_database_switching,
        "set_is_database_switching": set_is_database_switching,
    },
)

register_space_routes(
    app,
    {
        "make_json_response": make_json_response,
        "run_in_transaction": run_in_transaction,
        "is_valid_space_id": is_valid_space_id,
        "create_random_space_id": create_random_space_id,
        "read_spaces_id_list": read_spaces_id_list,
        "read_space_name": read_space_name,
        "write_spaces_id_list": write_spaces_id_list,
        "ensure_space_metadata_table": ensure_space_metadata_table,
        "ensure_object_status_table": ensure_object_status_table,
        "resolve_space_metadata_rank": resolve_space_metadata_rank,
        "read_space_metadata_rows": read_space_metadata_rows,
        "lexorank_between": lexorank_between,
    },
)

register_object_routes(
    app,
    {
        "run_in_transaction": run_in_transaction,
        "normalize_payload_type": normalize_payload_type,
        "normalize_object_type_value": normalize_object_type_value,
        "ensure_object_status_table": ensure_object_status_table,
        "get_object_table_name": get_object_table_name,
        "get_object_history_table_name": get_object_history_table_name,
        "get_payload_column_name": get_payload_column_name,
        "parse_base64_payload": parse_base64_payload,
        "create_ms48_id": create_ms48_id,
    },
)


def serve_management_page():
    build_dir = get_build_dir()
    index_file = build_dir / "index.html"
    if index_file.is_file():
        return send_from_directory(build_dir, "index.html")
    return make_json_response(-1, message=f"build not found: {build_dir}"), 404


@app.errorhandler(404)
def handle_not_found(_error):
    if request.method == "POST":
        return make_json_response(-1, message=f"POST endpoint not found: {request.path}"), 404
    if request.method == "GET":
        return serve_management_page()
    return make_json_response(-1, message=f"endpoint not found: {request.path}"), 404


@app.errorhandler(405)
def handle_method_not_allowed(_error):
    if request.method == "POST":
        return make_json_response(-1, message=f"POST method not allowed: {request.path}"), 405
    return make_json_response(-1, message=f"method not allowed: {request.path}"), 405


@app.get("/", defaults={"resource_path": ""})
@app.get("/<path:resource_path>")
def serve_frontend(resource_path: str):
    build_dir = get_build_dir()
    if resource_path:
        file_path = build_dir / resource_path
        if file_path.is_file():
            return send_from_directory(build_dir, resource_path)
    return serve_management_page()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "5107"))
    app.run(host="0.0.0.0", port=port)
