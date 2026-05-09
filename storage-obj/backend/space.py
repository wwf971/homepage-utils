from __future__ import annotations

import json
from contextlib import closing

from flask import request


def register_space_routes(app, context: dict):
    make_json_response = context["make_json_response"]
    run_in_transaction = context["run_in_transaction"]
    is_valid_space_id = context["is_valid_space_id"]
    create_random_space_id = context["create_random_space_id"]
    read_spaces_id_list = context["read_spaces_id_list"]
    read_space_name = context["read_space_name"]
    write_spaces_id_list = context["write_spaces_id_list"]
    ensure_space_metadata_table = context["ensure_space_metadata_table"]
    ensure_object_status_table = context["ensure_object_status_table"]
    resolve_space_metadata_rank = context["resolve_space_metadata_rank"]
    read_space_metadata_rows = context["read_space_metadata_rows"]
    lexorank_between = context["lexorank_between"]

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
