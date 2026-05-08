from __future__ import annotations

import json
import os
import random
import string
import time
import base64
from contextlib import closing
from pathlib import Path
from typing import Any, Callable

from flask import Flask, jsonify, request, send_from_directory
from utils import lexorank_between, lexorank_initial

psycopg_import_error = None
try:
    from psycopg import connect
except Exception as error:
    connect = None
    psycopg_import_error = error


def make_json_response(code: int, data: Any = None, message: str = ""):
    payload = {"code": code}
    if data is not None:
        payload["data"] = data
    if message:
        payload["message"] = message
    return jsonify(payload)


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


def create_random_object_id(length: int = 16):
    chars = string.ascii_lowercase + string.digits
    return "".join(random.choice(chars) for _ in range(length))


def normalize_payload_type(payload_type_raw: str):
    payload_type = str(payload_type_raw or "").strip().lower()
    if payload_type not in ("text", "bytes", "json"):
        raise RuntimeError("dataType should be one of text/bytes/json")
    return payload_type


def get_object_table_name(space_id: str, payload_type: str):
    if not is_valid_space_id(space_id):
        raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
    normalized_payload_type = normalize_payload_type(payload_type)
    return f"space_{space_id}_object_{normalized_payload_type}_status"


def get_payload_column_name(payload_type: str):
    normalized_payload_type = normalize_payload_type(payload_type)
    if normalized_payload_type == "text":
        return "valueText"
    if normalized_payload_type == "bytes":
        return "valueBytes"
    return "valueJson"


def get_object_history_table_name(space_id: str, payload_type: str):
    if not is_valid_space_id(space_id):
        raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
    normalized_payload_type = normalize_payload_type(payload_type)
    return f"space_{space_id}_object_{normalized_payload_type}_history"


def normalize_object_type_value(raw_value: Any, default_value: int = -1, allow_none: bool = False):
    if raw_value is None:
        return None if allow_none else default_value
    raw_text = str(raw_value).strip()
    if raw_text == "":
        return None if allow_none else default_value
    try:
        return int(raw_text)
    except Exception:
        raise RuntimeError("type should be a signed integer")


def parse_base64_payload(value: Any):
    payload_text = str(value or "")
    comma_idx = payload_text.find(",")
    raw_base64 = payload_text[comma_idx + 1 :] if comma_idx >= 0 else payload_text
    return raw_base64.strip()


def ensure_object_status_table(cursor, space_id: str, payload_type: str):
    table_name = get_object_table_name(space_id, payload_type)
    normalized_payload_type = normalize_payload_type(payload_type)
    payload_column_name = get_payload_column_name(normalized_payload_type)
    payload_column_sql = "text" if normalized_payload_type == "text" else "bytea" if normalized_payload_type == "bytes" else "jsonb"
    cursor.execute(
        f"""
        create table if not exists {table_name} (
            objectId text primary key,
            {payload_column_name} {payload_column_sql},
            type integer not null default -1,
            isDeleted boolean not null default false,
            createdAt timestamptz default now(),
            updatedAt timestamptz default now(),
            updatedAtTz varchar(6)
        )
        """
    )
    cursor.execute(f"alter table {table_name} add column if not exists {payload_column_name} {payload_column_sql}")
    cursor.execute(f"alter table {table_name} add column if not exists type integer not null default -1")
    cursor.execute(f"alter table {table_name} add column if not exists isDeleted boolean not null default false")
    cursor.execute(f"alter table {table_name} add column if not exists createdAt timestamptz default now()")
    cursor.execute(f"alter table {table_name} add column if not exists updatedAt timestamptz default now()")
    cursor.execute(f"alter table {table_name} add column if not exists updatedAtTz varchar(6)")
    history_table_name = get_object_history_table_name(space_id, normalized_payload_type)
    cursor.execute(
        f"""
        create table if not exists {history_table_name} (
            objectId text not null,
            versionNum bigint not null,
            {payload_column_name} {payload_column_sql},
            isDataDeleted boolean not null default false,
            createdAt timestamptz default now(),
            primary key (objectId, versionNum)
        )
        """
    )
    cursor.execute(f"alter table {history_table_name} add column if not exists {payload_column_name} {payload_column_sql}")
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


app = Flask(__name__)


@app.get("/health/test")
@app.get("/api/health/test")
def health_test():
    requested_database_key = str(request.args.get("databaseKey") or "").strip()
    timeout_seconds_raw = str(request.args.get("timeoutSeconds") or "").strip()
    try:
        timeout_seconds = int(timeout_seconds_raw) if timeout_seconds_raw else 5
    except Exception:
        timeout_seconds = 5
    timeout_seconds = max(1, min(timeout_seconds, 30))

    selected_database_key = current_database_key
    selected_database_config = active_database_config
    if requested_database_key:
        preset_item = find_database_preset_by_key(requested_database_key)
        if preset_item is None:
            return make_json_response(-1, message=f"database key not found: {requested_database_key}"), 404
        selected_database_key = str(preset_item["key"])
        selected_database_config = to_db_config_from_preset(preset_item)
    try:
        test_result = test_database_connection(selected_database_config, timeout_seconds=timeout_seconds)
        return make_json_response(
            0,
            data={
                **test_result,
                "databaseKey": selected_database_key,
                "timeoutSeconds": timeout_seconds,
            },
        )
    except Exception as error:
        return make_json_response(-1, message=f"database test failed: {error}"), 500


@app.post("/config/database/test")
@app.post("/api/config/database/test")
def config_database_test():
    body = request.get_json(silent=True) or {}
    requested_database_key = str(body.get("databaseKey") or "").strip()
    if not requested_database_key:
        return make_json_response(-1, message="databaseKey is required"), 400
    timeout_seconds_raw = body.get("timeoutSeconds")
    try:
        timeout_seconds = int(timeout_seconds_raw) if timeout_seconds_raw is not None else 5
    except Exception:
        timeout_seconds = 5
    timeout_seconds = max(1, min(timeout_seconds, 30))

    preset_item = find_database_preset_by_key(requested_database_key)
    if preset_item is None:
        return make_json_response(-1, message=f"database key not found: {requested_database_key}"), 404
    try:
        test_result = test_database_connection(
            to_db_config_from_preset(preset_item),
            timeout_seconds=timeout_seconds,
        )
        return make_json_response(
            0,
            data={
                **test_result,
                "databaseKey": requested_database_key,
                "timeoutSeconds": timeout_seconds,
            },
        )
    except Exception as error:
        return make_json_response(-1, message=f"database test failed: {error}"), 500


@app.post("/echo")
@app.post("/api/echo")
def echo():
    body = request.get_json(silent=True) or {}

    def action(db):
        with closing(db.cursor()) as cursor:
            cursor.execute("select %s::text as payload", (str(body),))
            row = cursor.fetchone()
        return {"echo": row[0] if row else str(body)}

    return run_in_transaction(action)


@app.get("/health/ping")
@app.get("/api/health/ping")
def health_ping():
    return make_json_response(0, data={"status": "ok"})


@app.get("/config/database/list")
@app.get("/api/config/database/list")
def config_database_list():
    return make_json_response(
        0,
        data={
            "currentKey": current_database_key,
            "items": build_database_list_payload(),
        },
    )


@app.post("/config/database/switch")
@app.post("/api/config/database/switch")
def config_database_switch():
    global current_database_key
    global active_database_config
    global is_database_switching

    body = request.get_json(silent=True) or {}
    next_database_key = str(body.get("databaseKey") or "").strip()
    if not next_database_key:
        return make_json_response(-1, message="databaseKey is required"), 400
    if is_database_switching:
        return make_json_response(-1, message="database switch is busy"), 409

    selected_preset = find_database_preset_by_key(next_database_key)
    if selected_preset is None:
        return make_json_response(-1, message=f"database key not found: {next_database_key}"), 404
    if current_database_key == next_database_key:
        return make_json_response(
            0,
            data={
                "currentKey": current_database_key,
                "items": build_database_list_payload(),
                "messageText": "database already selected",
            },
        )
    is_database_switching = True
    try:
        next_db_config = to_db_config_from_preset(selected_preset)
        test_database_connection(next_db_config)
        active_database_config = next_db_config
        current_database_key = next_database_key
        return make_json_response(
            0,
            data={
                "currentKey": current_database_key,
                "items": build_database_list_payload(),
                "messageText": f"database switched: {current_database_key}",
            },
        )
    except Exception as error:
        return make_json_response(-1, message=f"database switch failed: {error}"), 500
    finally:
        is_database_switching = False


@app.post("/config/database/reinit")
@app.post("/api/config/database/reinit")
def config_database_reinit():
    body = request.get_json(silent=True) or {}
    isIncludeExampleData = body.get("isIncludeExampleData")
    is_include_example_data = True if isIncludeExampleData is None else bool(isIncludeExampleData)
    if connect is None:
        import_error_text = str(psycopg_import_error) if psycopg_import_error else "unknown import error"
        return make_json_response(-1, message=f"psycopg is not installed: {import_error_text}"), 500
    db = None
    try:
        init_db_script_text = load_sql_script_text("init_db.sql")
        init_data_script_text = load_sql_script_text("init_data_example.sql") if is_include_example_data else ""
    except Exception as error:
        return make_json_response(-1, message=f"failed to load sql script: {error}"), 500
    try:
        db = connect(**active_database_config)
        db.autocommit = True
        run_sql_script_text(db, init_db_script_text)
        if not is_include_example_data:
            return make_json_response(
                0,
                data={
                    "isInitDbSuccess": True,
                    "isInitExampleDataRequested": False,
                    "isInitExampleDataSuccess": False,
                    "messageText": "database re-initialized (example data skipped)",
                },
            )
        try:
            run_sql_script_text(db, init_data_script_text)
            return make_json_response(
                0,
                data={
                    "isInitDbSuccess": True,
                    "isInitExampleDataRequested": True,
                    "isInitExampleDataSuccess": True,
                    "messageText": "database and example data re-initialized",
                },
            )
        except Exception as error:
            return make_json_response(
                1,
                data={
                    "isInitDbSuccess": True,
                    "isInitExampleDataRequested": True,
                    "isInitExampleDataSuccess": False,
                    "messageText": f"database re-initialized, but example data init failed: {error}",
                },
                message=f"database re-initialized, but example data init failed: {error}",
            )
    except Exception as error:
        return make_json_response(-1, message=f"database re-init failed: {error}"), 500
    finally:
        if db is not None:
            db.close()


@app.post("/config/database/check")
@app.post("/api/config/database/check")
def config_database_check():
    if connect is None:
        import_error_text = str(psycopg_import_error) if psycopg_import_error else "unknown import error"
        return make_json_response(-1, message=f"psycopg is not installed: {import_error_text}"), 500
    db = None
    try:
        db = connect(**active_database_config)
        db.autocommit = True
        with closing(db.cursor()) as cursor:
            check_items = []
            check_items.append(
                check_table_has_columns(
                    cursor,
                    "metadata",
                    [
                        "tag",
                        "rank",
                        "valuetype",
                        "valuetext",
                        "valuejson",
                        "valuebytes",
                        "valueint",
                        "valueboolean",
                        "updatedat",
                        "updatedattz",
                    ],
                )
            )
            check_items.append(
                check_table_has_columns(
                    cursor,
                    "change_log",
                    [
                        "changelogid",
                        "createdat",
                        "createdattz",
                        "commenttext",
                        "commentjson",
                    ],
                )
            )
            spaces_id_list = []
            cursor.execute(
                """
                select valueJson
                from metadata
                where tag = 'spacesIdList'
                """
            )
            row = cursor.fetchone()
            if row and row[0] is not None and isinstance(row[0], list):
                spaces_id_list = [str(item) for item in row[0] if isinstance(item, (str, int))]
            for space_id in spaces_id_list:
                if not is_valid_space_id(space_id):
                    continue
                check_items.append(
                    check_table_has_columns(
                        cursor,
                        f"space_{space_id}_metadata",
                        [
                            "tag",
                            "rank",
                            "valuetype",
                            "valuetext",
                            "valuejson",
                            "valuebytes",
                            "valueint",
                            "valueboolean",
                            "updatedat",
                            "updatedattz",
                        ],
                    )
                )
                for payload_type in ("text", "bytes", "json"):
                    check_items.append(
                        check_table_has_columns(
                            cursor,
                            f"space_{space_id}_object_{payload_type}_status",
                            [
                                "objectid",
                                "type",
                                "isdeleted",
                                "updatedat",
                            ],
                        )
                    )
            failed_items = [item for item in check_items if item.get("isOk") is not True]
            issue_text_list = build_table_issue_text_list(failed_items)
            failure_message_text = "database schema check failed: " + " | ".join(issue_text_list) if len(issue_text_list) > 0 else "database schema check failed"
            return make_json_response(
                0,
                data={
                    "isSchemaOk": len(failed_items) == 0,
                    "tableCheckItems": check_items,
                    "failedTableCheckItems": failed_items,
                    "issueTextList": issue_text_list,
                    "messageText": "database schema ok" if len(failed_items) == 0 else failure_message_text,
                },
            )
    except Exception as error:
        return make_json_response(-1, message=f"database check failed: {error}"), 500
    finally:
        if db is not None:
            db.close()


@app.get("/space/list")
@app.get("/api/space/list")
def space_list():
    def action(db):
        with closing(db.cursor()) as cursor:
            spaces_id_list = read_spaces_id_list(cursor)
            space_item_list = []
            for space_id in spaces_id_list:
                space_name = read_space_name(cursor, space_id)
                display_name = f"{space_name} {space_id}" if space_name else f"ANONY {space_id}"
                space_item_list.append(
                    {
                        "spaceId": space_id,
                        "name": space_name,
                        "displayName": display_name,
                    }
                )
        return {
            "spaces": spaces_id_list,
            "spaceItems": space_item_list,
            "spaceNum": len(spaces_id_list),
        }

    return run_in_transaction(action)


@app.get("/space/find-by-name")
@app.get("/api/space/find-by-name")
def space_find_by_name():
    name = str(request.args.get("name") or "").strip()
    if not name:
        return make_json_response(-1, message="name is required"), 400

    def action(db):
        with closing(db.cursor()) as cursor:
            spaces_id_list = read_spaces_id_list(cursor)
            normalized_name = name.strip().lower()
            for space_id in spaces_id_list:
                if not is_valid_space_id(space_id):
                    continue
                space_name = read_space_name(cursor, space_id)
                if str(space_name or "").strip().lower() != normalized_name:
                    continue
                return {
                    "spaceId": space_id,
                    "name": space_name,
                }
        raise RuntimeError(f"space not found by name: {name}")

    return run_in_transaction(action)


@app.post("/space/create")
@app.post("/api/space/create")
def space_create():
    body = request.get_json(silent=True) or {}

    def action(db):
        with closing(db.cursor()) as cursor:
            spaces_id_list = read_spaces_id_list(cursor)

            space_id = str(body.get("spaceId") or "").strip().lower()
            if not space_id:
                for _ in range(20):
                    candidate = create_random_space_id()
                    if candidate not in spaces_id_list:
                        space_id = candidate
                        break
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if space_id in spaces_id_list:
                raise RuntimeError(f"space already exists: {space_id}")

            spaces_id_list.append(space_id)
            spaces_id_list = sorted(set(spaces_id_list))
            write_spaces_id_list(cursor, spaces_id_list)
            ensure_space_metadata_table(cursor, space_id)
            ensure_object_status_table(cursor, space_id, "text")
            ensure_object_status_table(cursor, space_id, "bytes")
            ensure_object_status_table(cursor, space_id, "json")

        return {
            "spaceId": space_id,
            "spaces": spaces_id_list,
            "spaceNum": len(spaces_id_list),
        }

    return run_in_transaction(action)


@app.get("/space/metadata/list")
@app.get("/api/space/metadata/list")
def space_metadata_list():
    space_id = str(request.args.get("spaceId") or "").strip().lower()

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            ensure_space_metadata_table(cursor, space_id)
            cursor.execute(
                f"""
                select
                    tag,
                    rank,
                    valueType,
                    valueText,
                    valueJson,
                    valueBytes,
                    valueInt,
                    valueBoolean
                from space_{space_id}_metadata
                order by rank asc nulls last, tag asc
                """
            )
            row_list = cursor.fetchall() or []
            metadata_item_list = []
            for row in row_list:
                metadata_item_list.append(
                    {
                        "tag": row[0],
                        "rank": row[1],
                        "valueType": row[2],
                        "valueText": row[3],
                        "valueJson": row[4],
                        "valueBytes": row[5],
                        "valueInt": row[6],
                        "valueBoolean": row[7],
                    }
                )
        return {
            "spaceId": space_id,
            "items": metadata_item_list,
        }

    return run_in_transaction(action)


@app.post("/space/metadata/upsert")
@app.post("/api/space/metadata/upsert")
def space_metadata_upsert():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    tag = str(body.get("tag") or "").strip()

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if not tag:
                raise RuntimeError("tag is required")
            ensure_space_metadata_table(cursor, space_id)

            rank = resolve_space_metadata_rank(cursor, space_id, tag, body.get("rank"))

            value_type = body.get("valueType")
            value_text = body.get("valueText")
            value_json = body.get("valueJson")
            value_bytes = body.get("valueBytes")
            value_int = body.get("valueInt")
            value_boolean = body.get("valueBoolean")
            cursor.execute(
                f"""
                insert into space_{space_id}_metadata(
                    tag,
                    rank,
                    valueType,
                    valueText,
                    valueJson,
                    valueBytes,
                    valueInt,
                    valueBoolean,
                    updatedAt
                )
                values (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
                on conflict (tag) do update set
                    rank = excluded.rank,
                    valueType = excluded.valueType,
                    valueText = excluded.valueText,
                    valueJson = excluded.valueJson,
                    valueBytes = excluded.valueBytes,
                    valueInt = excluded.valueInt,
                    valueBoolean = excluded.valueBoolean,
                    updatedAt = now()
                """,
                (
                    tag,
                    rank,
                    value_type,
                    value_text,
                    json.dumps(value_json) if value_json is not None else None,
                    value_bytes,
                    value_int,
                    value_boolean,
                ),
            )
        return {
            "spaceId": space_id,
            "tag": tag,
            "rank": rank,
        }

    return run_in_transaction(action)


@app.post("/space/metadata/ensure")
@app.post("/api/space/metadata/ensure")
def space_metadata_ensure():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    tag = str(body.get("tag") or "").strip()
    is_overwrite = body.get("isOverwrite")
    is_overwrite_enabled = True if is_overwrite is None else bool(is_overwrite)

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if not tag:
                raise RuntimeError("tag is required")
            ensure_space_metadata_table(cursor, space_id)

            cursor.execute(
                f"""
                select tag
                from space_{space_id}_metadata
                where tag = %s
                limit 1
                """,
                (tag,),
            )
            existing_row = cursor.fetchone()
            if existing_row and not is_overwrite_enabled:
                return {
                    "spaceId": space_id,
                    "tag": tag,
                    "isInserted": False,
                    "isUpdated": False,
                    "isNoop": True,
                }

            rank = resolve_space_metadata_rank(cursor, space_id, tag, body.get("rank"))

            value_type = body.get("valueType")
            value_text = body.get("valueText")
            value_json = body.get("valueJson")
            value_bytes = body.get("valueBytes")
            value_int = body.get("valueInt")
            value_boolean = body.get("valueBoolean")
            cursor.execute(
                f"""
                insert into space_{space_id}_metadata(
                    tag,
                    rank,
                    valueType,
                    valueText,
                    valueJson,
                    valueBytes,
                    valueInt,
                    valueBoolean,
                    updatedAt
                )
                values (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
                on conflict (tag) do update set
                    rank = excluded.rank,
                    valueType = excluded.valueType,
                    valueText = excluded.valueText,
                    valueJson = excluded.valueJson,
                    valueBytes = excluded.valueBytes,
                    valueInt = excluded.valueInt,
                    valueBoolean = excluded.valueBoolean,
                    updatedAt = now()
                """,
                (
                    tag,
                    rank,
                    value_type,
                    value_text,
                    json.dumps(value_json) if value_json is not None else None,
                    value_bytes,
                    value_int,
                    value_boolean,
                ),
            )
        return {
            "spaceId": space_id,
            "tag": tag,
            "isInserted": existing_row is None,
            "isUpdated": existing_row is not None,
            "isNoop": False,
        }

    return run_in_transaction(action)


@app.post("/space/metadata/delete")
@app.post("/api/space/metadata/delete")
def space_metadata_delete():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    tag = str(body.get("tag") or "").strip()

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if not tag:
                raise RuntimeError("tag is required")
            ensure_space_metadata_table(cursor, space_id)
            cursor.execute(
                f"""
                delete from space_{space_id}_metadata
                where tag = %s
                """,
                (tag,),
            )
        return {
            "spaceId": space_id,
            "tag": tag,
        }

    return run_in_transaction(action)


@app.post("/space/metadata/insert")
@app.post("/api/space/metadata/insert")
def space_metadata_insert():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    tag = str(body.get("tag") or "").strip()
    target_tag = str(body.get("targetTag") or "").strip()
    position = str(body.get("position") or "tail").strip().lower()

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if not tag:
                raise RuntimeError("tag is required")
            if position not in ("above", "below", "tail"):
                raise RuntimeError("position should be above/below/tail")

            row_list = read_space_metadata_rows(cursor, space_id)
            if any(row["tag"] == tag for row in row_list):
                raise RuntimeError(f"tag already exists: {tag}")

            rank_left = None
            rank_right = None

            if position == "tail" or not target_tag:
                rank_left = row_list[-1]["rank"] if row_list else None
                rank_right = None
            else:
                target_idx = next((idx for idx, row in enumerate(row_list) if row["tag"] == target_tag), -1)
                if target_idx < 0:
                    raise RuntimeError(f"targetTag not found: {target_tag}")
                if position == "above":
                    rank_left = row_list[target_idx - 1]["rank"] if target_idx - 1 >= 0 else None
                    rank_right = row_list[target_idx]["rank"]
                else:
                    rank_left = row_list[target_idx]["rank"]
                    rank_right = row_list[target_idx + 1]["rank"] if target_idx + 1 < len(row_list) else None

            next_rank = lexorank_between(rank_left, rank_right)
            value_type = body.get("valueType")
            value_text = body.get("valueText")
            value_json = body.get("valueJson")
            value_bytes = body.get("valueBytes")
            value_int = body.get("valueInt")
            value_boolean = body.get("valueBoolean")

            cursor.execute(
                f"""
                insert into space_{space_id}_metadata(
                    tag,
                    rank,
                    valueType,
                    valueText,
                    valueJson,
                    valueBytes,
                    valueInt,
                    valueBoolean,
                    updatedAt
                )
                values (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
                """,
                (
                    tag,
                    next_rank,
                    value_type,
                    value_text,
                    json.dumps(value_json) if value_json is not None else None,
                    value_bytes,
                    value_int,
                    value_boolean,
                ),
            )
        return {
            "spaceId": space_id,
            "tag": tag,
            "rank": next_rank,
            "position": position,
            "targetTag": target_tag,
        }

    return run_in_transaction(action)


@app.post("/space/metadata/move")
@app.post("/api/space/metadata/move")
def space_metadata_move():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    tag = str(body.get("tag") or "").strip()
    direction = str(body.get("direction") or "").strip().lower()

    def action(db):
        with closing(db.cursor()) as cursor:
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if not tag:
                raise RuntimeError("tag is required")
            if direction not in ("up", "down"):
                raise RuntimeError("direction should be up/down")

            row_list = read_space_metadata_rows(cursor, space_id)
            target_idx = next((idx for idx, row in enumerate(row_list) if row["tag"] == tag), -1)
            if target_idx < 0:
                raise RuntimeError(f"tag not found: {tag}")

            if direction == "up":
                if target_idx <= 0:
                    return {"spaceId": space_id, "tag": tag, "direction": direction, "isNoop": True}
                rank_left = row_list[target_idx - 2]["rank"] if target_idx - 2 >= 0 else None
                rank_right = row_list[target_idx - 1]["rank"]
                next_rank = lexorank_between(rank_left, rank_right)
            else:
                if target_idx >= len(row_list) - 1:
                    return {"spaceId": space_id, "tag": tag, "direction": direction, "isNoop": True}
                rank_left = row_list[target_idx + 1]["rank"]
                rank_right = row_list[target_idx + 2]["rank"] if target_idx + 2 < len(row_list) else None
                next_rank = lexorank_between(rank_left, rank_right)

            cursor.execute(
                f"""
                update space_{space_id}_metadata
                set rank = %s, updatedAt = now()
                where tag = %s
                """,
                (next_rank, tag),
            )
        return {
            "spaceId": space_id,
            "tag": tag,
            "direction": direction,
        }

    return run_in_transaction(action)


@app.post("/space/delete")
@app.post("/api/space/delete")
def space_delete():
    body = request.get_json(silent=True) or {}

    def action(db):
        with closing(db.cursor()) as cursor:
            spaces_id_list = read_spaces_id_list(cursor)
            space_id = str(body.get("spaceId") or "").strip().lower()
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if space_id not in spaces_id_list:
                raise RuntimeError(f"space does not exist: {space_id}")

            spaces_id_list = [item for item in spaces_id_list if item != space_id]
            write_spaces_id_list(cursor, spaces_id_list)
            cursor.execute(f"drop table if exists space_{space_id}_metadata")
            cursor.execute(f"drop table if exists space_{space_id}_object_text_status")
            cursor.execute(f"drop table if exists space_{space_id}_object_bytes_status")
            cursor.execute(f"drop table if exists space_{space_id}_object_json_status")

        return {
            "spaceId": space_id,
            "spaces": spaces_id_list,
            "spaceNum": len(spaces_id_list),
        }

    return run_in_transaction(action)


@app.post("/space/clear")
@app.post("/api/space/clear")
def space_clear():
    body = request.get_json(silent=True) or {}

    def action(db):
        with closing(db.cursor()) as cursor:
            spaces_id_list = read_spaces_id_list(cursor)
            space_id = str(body.get("spaceId") or "").strip().lower()
            if not is_valid_space_id(space_id):
                raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
            if space_id not in spaces_id_list:
                raise RuntimeError(f"space does not exist: {space_id}")

            ensure_space_metadata_table(cursor, space_id)
            ensure_object_status_table(cursor, space_id, "text")
            ensure_object_status_table(cursor, space_id, "bytes")
            ensure_object_status_table(cursor, space_id, "json")

            cursor.execute(f"delete from space_{space_id}_metadata")
            deleted_metadata_num = int(cursor.rowcount or 0)
            cursor.execute(f"delete from space_{space_id}_object_text_status")
            deleted_text_num = int(cursor.rowcount or 0)
            cursor.execute(f"delete from space_{space_id}_object_bytes_status")
            deleted_bytes_num = int(cursor.rowcount or 0)
            cursor.execute(f"delete from space_{space_id}_object_json_status")
            deleted_json_num = int(cursor.rowcount or 0)

        return {
            "spaceId": space_id,
            "deletedMetadataNum": deleted_metadata_num,
            "deletedTextNum": deleted_text_num,
            "deletedBytesNum": deleted_bytes_num,
            "deletedJsonNum": deleted_json_num,
            "deletedTotalNum": deleted_metadata_num + deleted_text_num + deleted_bytes_num + deleted_json_num,
        }

    return run_in_transaction(action)


@app.get("/object/list")
@app.get("/api/object/list")
def object_list():
    space_id = str(request.args.get("spaceId") or "").strip().lower()
    payload_type = str(request.args.get("dataType") or "").strip().lower()
    search_text = str(request.args.get("searchText") or "").strip()
    object_type_raw = request.args.get("type")
    object_type_filter = normalize_object_type_value(object_type_raw, allow_none=True)
    page_index_raw = str(request.args.get("pageIndex") or "").strip()
    page_size_raw = str(request.args.get("pageSize") or "").strip()
    try:
        page_index = int(page_index_raw) if page_index_raw else 1
    except Exception:
        page_index = 1
    try:
        page_size = int(page_size_raw) if page_size_raw else 20
    except Exception:
        page_size = 20
    page_index = max(1, page_index)
    page_size = max(1, min(page_size, 200))

    def action(db):
        normalized_payload_type = normalize_payload_type(payload_type)
        with closing(db.cursor()) as cursor:
            ensure_object_status_table(cursor, space_id, normalized_payload_type)
            table_name = get_object_table_name(space_id, normalized_payload_type)
            payload_column_name = get_payload_column_name(normalized_payload_type)
            query_params = []
            where_clause = "where isDeleted = false"
            if search_text:
                where_clause += " and objectId ilike %s"
                query_params.append(f"%{search_text}%")
            if object_type_filter is not None:
                where_clause += " and type = %s"
                query_params.append(object_type_filter)
            cursor.execute(
                f"""
                select count(1)
                from {table_name}
                {where_clause}
                """,
                tuple(query_params),
            )
            count_row = cursor.fetchone()
            total_count = int(count_row[0] if count_row and count_row[0] is not None else 0)
            offset = (page_index - 1) * page_size
            cursor.execute(
                f"""
                select objectId, {payload_column_name}, type, createdAt, updatedAt
                from {table_name}
                {where_clause}
                order by createdAt desc, objectId desc
                limit %s offset %s
                """,
                tuple(query_params + [page_size, offset]),
            )
            row_list = cursor.fetchall() or []
            item_list = []
            for row in row_list:
                row_payload = row[1]
                value_text = row_payload if normalized_payload_type == "text" else ""
                value_json = row_payload if normalized_payload_type == "json" else None
                value_base64 = base64.b64encode(row_payload).decode("utf-8") if normalized_payload_type == "bytes" and row_payload is not None else ""
                item_list.append(
                    {
                        "objectId": str(row[0] or ""),
                        "dataType": normalized_payload_type,
                        "type": int(row[2] if row[2] is not None else -1),
                        "valueText": value_text if value_text is not None else "",
                        "valueJson": value_json,
                        "valueBase64": value_base64,
                        "createdAt": str(row[3] or ""),
                        "updatedAt": str(row[4] or ""),
                    }
                )
        return {
            "spaceId": space_id,
            "dataType": normalized_payload_type,
            "pageIndex": page_index,
            "pageSize": page_size,
            "totalCount": total_count,
            "items": item_list,
        }

    return run_in_transaction(action)


@app.get("/object/get")
@app.get("/api/object/get")
def object_get():
    space_id = str(request.args.get("spaceId") or "").strip().lower()
    payload_type = str(request.args.get("dataType") or "").strip().lower()
    object_id = str(request.args.get("objectId") or "").strip()

    def action(db):
        normalized_payload_type = normalize_payload_type(payload_type)
        if not object_id:
            raise RuntimeError("objectId is required")
        with closing(db.cursor()) as cursor:
            ensure_object_status_table(cursor, space_id, normalized_payload_type)
            table_name = get_object_table_name(space_id, normalized_payload_type)
            payload_column_name = get_payload_column_name(normalized_payload_type)
            cursor.execute(
                f"""
                select objectId, {payload_column_name}, type, createdAt, updatedAt
                from {table_name}
                where objectId = %s and isDeleted = false
                limit 1
                """,
                (object_id,),
            )
            row = cursor.fetchone()
            if not row:
                raise RuntimeError(f"object not found: {object_id}")
            row_payload = row[1]
            return {
                "spaceId": space_id,
                "dataType": normalized_payload_type,
                "objectId": str(row[0] or ""),
                "type": int(row[2] if row[2] is not None else -1),
                "valueText": row_payload if normalized_payload_type == "text" and row_payload is not None else "",
                "valueJson": row_payload if normalized_payload_type == "json" else None,
                "valueBase64": base64.b64encode(row_payload).decode("utf-8") if normalized_payload_type == "bytes" and row_payload is not None else "",
                "createdAt": str(row[3] or ""),
                "updatedAt": str(row[4] or ""),
            }

    return run_in_transaction(action)


@app.post("/object/create")
@app.post("/api/object/create")
def object_create():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    payload_type = str(body.get("dataType") or "").strip().lower()
    object_type_value = normalize_object_type_value(body.get("type"), default_value=-1)
    created_at_tz = str(body.get("createdAtTz") or "").strip()

    def action(db):
        normalized_payload_type = normalize_payload_type(payload_type)
        with closing(db.cursor()) as cursor:
            ensure_object_status_table(cursor, space_id, normalized_payload_type)
            table_name = get_object_table_name(space_id, normalized_payload_type)
            history_table_name = get_object_history_table_name(space_id, normalized_payload_type)
            payload_column_name = get_payload_column_name(normalized_payload_type)
            object_id = f"{int(time.time() * 1000)}_{create_random_object_id(6)}"
            payload_value = None
            payload_value_placeholder = "%s"
            if normalized_payload_type == "text":
                payload_value = body.get("valueText")
            elif normalized_payload_type == "bytes":
                value_base64 = parse_base64_payload(body.get("valueBase64"))
                payload_value = base64.b64decode(value_base64.encode("utf-8")) if value_base64 else b""
            elif normalized_payload_type == "json":
                payload_value = json.dumps(body.get("valueJson"))
                payload_value_placeholder = "%s::jsonb"
            cursor.execute(
                f"""
                select 1
                from {table_name}
                where objectId = %s
                limit 1
                """,
                (object_id,),
            )
            existing_row = cursor.fetchone()
            if existing_row:
                raise RuntimeError(f"object already exists: {object_id}")
            cursor.execute(
                f"""
                insert into {table_name}(objectId, {payload_column_name}, type, isDeleted, createdAt, updatedAt, updatedAtTz)
                values (%s, {payload_value_placeholder}, %s, false, now(), now(), %s)
                """,
                (object_id, payload_value, object_type_value, created_at_tz or None),
            )
            cursor.execute(
                f"""
                insert into {history_table_name}(objectId, versionNum, {payload_column_name}, isDataDeleted, createdAt)
                values (%s, %s, {payload_value_placeholder}, false, now())
                """,
                (object_id, 1, payload_value),
            )
        return {
            "spaceId": space_id,
            "dataType": normalized_payload_type,
            "objectId": object_id,
            "type": object_type_value,
        }

    return run_in_transaction(action)


@app.post("/object/update")
@app.post("/api/object/update")
def object_update():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    payload_type = str(body.get("dataType") or "").strip().lower()
    object_id = str(body.get("objectId") or "").strip()
    object_type_value = normalize_object_type_value(body.get("type"), allow_none=True)
    is_delete_previous_data = body.get("isDeletePreviousData") is True
    updated_at_tz = str(body.get("updatedAtTz") or "").strip()

    def action(db):
        normalized_payload_type = normalize_payload_type(payload_type)
        if not object_id:
            raise RuntimeError("objectId is required")
        with closing(db.cursor()) as cursor:
            ensure_object_status_table(cursor, space_id, normalized_payload_type)
            table_name = get_object_table_name(space_id, normalized_payload_type)
            history_table_name = get_object_history_table_name(space_id, normalized_payload_type)
            payload_column_name = get_payload_column_name(normalized_payload_type)
            payload_value = None
            payload_value_placeholder = "%s"
            if normalized_payload_type == "text":
                payload_value = body.get("valueText")
            elif normalized_payload_type == "bytes":
                value_base64 = parse_base64_payload(body.get("valueBase64"))
                payload_value = base64.b64decode(value_base64.encode("utf-8")) if value_base64 else b""
            elif normalized_payload_type == "json":
                payload_value = json.dumps(body.get("valueJson"))
                payload_value_placeholder = "%s::jsonb"
            cursor.execute(
                f"""
                select {payload_column_name}
                from {table_name}
                where objectId = %s and isDeleted = false
                limit 1
                """,
                (object_id,),
            )
            previous_row = cursor.fetchone()
            if not previous_row:
                raise RuntimeError(f"object not found: {object_id}")
            previous_payload_value = previous_row[0]
            if normalized_payload_type == "json":
                previous_payload_value = json.dumps(previous_payload_value)
            cursor.execute(
                f"""
                select versionNum
                from {history_table_name}
                where objectId = %s
                order by versionNum desc
                limit 1
                """,
                (object_id,),
            )
            version_row = cursor.fetchone()
            previous_version_num = int(version_row[0]) if version_row and version_row[0] is not None else 1
            if not version_row:
                cursor.execute(
                    f"""
                    insert into {history_table_name}(objectId, versionNum, {payload_column_name}, isDataDeleted, createdAt)
                    values (%s, %s, {payload_value_placeholder}, false, now())
                    """,
                    (object_id, previous_version_num, previous_payload_value),
                )
            next_version_num = previous_version_num + 1
            cursor.execute(
                f"""
                update {table_name}
                set {payload_column_name} = {payload_value_placeholder},
                    type = coalesce(%s, type),
                    isDeleted = false,
                    updatedAt = now(),
                    updatedAtTz = %s
                where objectId = %s
                """,
                (payload_value, object_type_value, updated_at_tz or None, object_id),
            )
            if cursor.rowcount <= 0:
                raise RuntimeError(f"object not found: {object_id}")
            cursor.execute(
                f"""
                insert into {history_table_name}(objectId, versionNum, {payload_column_name}, isDataDeleted, createdAt)
                values (%s, %s, {payload_value_placeholder}, false, now())
                """,
                (object_id, next_version_num, payload_value),
            )
            if is_delete_previous_data:
                cursor.execute(
                    f"""
                    update {history_table_name}
                    set {payload_column_name} = null,
                        isDataDeleted = true
                    where objectId = %s and versionNum = %s
                    """,
                    (object_id, previous_version_num),
                )
        return {
            "spaceId": space_id,
            "dataType": normalized_payload_type,
            "objectId": object_id,
            "type": object_type_value,
            "isDeletePreviousData": is_delete_previous_data,
        }

    return run_in_transaction(action)


@app.post("/object/delete")
@app.post("/api/object/delete")
def object_delete():
    body = request.get_json(silent=True) or {}
    space_id = str(body.get("spaceId") or "").strip().lower()
    payload_type = str(body.get("dataType") or "").strip().lower()
    object_ids = body.get("objectIds")
    if not isinstance(object_ids, list):
        object_ids = []
    object_id_single = str(body.get("objectId") or "").strip()
    if object_id_single:
        object_ids.append(object_id_single)
    normalized_object_ids = sorted(set(str(item or "").strip() for item in object_ids if str(item or "").strip()))

    def action(db):
        normalized_payload_type = normalize_payload_type(payload_type)
        if not normalized_object_ids:
            raise RuntimeError("objectIds is required")
        with closing(db.cursor()) as cursor:
            ensure_object_status_table(cursor, space_id, normalized_payload_type)
            table_name = get_object_table_name(space_id, normalized_payload_type)
            cursor.execute(
                f"""
                update {table_name}
                set isDeleted = true,
                    updatedAt = now()
                where objectId = any(%s)
                """,
                (normalized_object_ids,),
            )
        return {
            "spaceId": space_id,
            "dataType": normalized_payload_type,
            "objectIds": normalized_object_ids,
            "deletedNum": len(normalized_object_ids),
        }

    return run_in_transaction(action)


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
