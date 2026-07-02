from __future__ import annotations

import json
from contextlib import closing

from flask import request


def register_obj_metadata_routes(app, context: dict):
    run_in_transaction = context["run_in_transaction"]
    normalize_payload_type = context["normalize_payload_type"]
    ensure_obj_status_table = context["ensure_obj_status_table"]
    ensure_obj_metadata_table = context["ensure_obj_metadata_table"]
    get_obj_table_name = context["get_obj_table_name"]
    get_obj_metadata_table_name = context["get_obj_metadata_table_name"]
    get_obj_history_table_name = context["get_obj_history_table_name"]
    read_obj_metadata_rows = context["read_obj_metadata_rows"]
    resolve_obj_metadata_rank = context["resolve_obj_metadata_rank"]
    serialize_metadata_item_row = context["serialize_metadata_item_row"]
    obj_metadata_tags_reserved = context["obj_metadata_tags_reserved"]
    lexorank_between = context["lexorank_between"]
    resolve_current_version_num = context["resolve_current_version_num"]
    edit_type_code_update_only = context["edit_type_code_update_only"]

    def build_obj_metadata_items_reserved(version_num_head, is_deleted, object_type_value, edit_type_value):
        return [
            {
                "tag": "versionIdHead",
                "rank": "",
                "valueType": 4,
                "valueText": None,
                "valueJson": None,
                "valueBytes": None,
                "valueInt": int(version_num_head) if version_num_head is not None else None,
                "valueBoolean": None,
            },
            {
                "tag": "isDeleted",
                "rank": "",
                "valueType": 5,
                "valueText": None,
                "valueJson": None,
                "valueBytes": None,
                "valueInt": None,
                "valueBoolean": bool(is_deleted),
            },
            {
                "tag": "type",
                "rank": "",
                "valueType": 4,
                "valueText": None,
                "valueJson": None,
                "valueBytes": None,
                "valueInt": int(object_type_value),
                "valueBoolean": None,
            },
            {
                "tag": "editType",
                "rank": "",
                "valueType": 4,
                "valueText": None,
                "valueJson": None,
                "valueBytes": None,
                "valueInt": int(edit_type_value),
                "valueBoolean": None,
            },
        ]

    def read_metadata_obj_status(cursor, space_id: str, normalized_data_type: str, object_id: str):
        table_name = get_obj_table_name(space_id, normalized_data_type)
        history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
        cursor.execute(
            f"""
            select versionNumHead, isDeleted, type, editType
            from {table_name}
            where objectId = %s
            limit 1
            """,
            (object_id,),
        )
        row = cursor.fetchone()
        if not row:
            raise RuntimeError(f"object not found: {object_id}")
        version_num_head = int(row[0]) if row[0] is not None else resolve_current_version_num(cursor, table_name, history_table_name, object_id)
        return build_obj_metadata_items_reserved(
            version_num_head,
            row[1],
            int(row[2] if row[2] is not None else -1),
            int(row[3] if row[3] is not None else edit_type_code_update_only),
        )

    def assert_user_obj_metadata_tag(tag: str):
        if tag in obj_metadata_tags_reserved:
            raise RuntimeError(f"tag is reserved for system metadata: {tag}")

    def upsert_obj_metadata_row(cursor, space_id: str, normalized_data_type: str, object_id: str, tag: str, body: dict):
        assert_user_obj_metadata_tag(tag)
        ensure_obj_metadata_table(cursor, space_id, normalized_data_type)
        table_name = get_obj_metadata_table_name(space_id, normalized_data_type)
        rank = resolve_obj_metadata_rank(cursor, space_id, normalized_data_type, object_id, tag, body.get("rank"))
        value_type = body.get("valueType")
        value_text = body.get("valueText")
        value_json = body.get("valueJson")
        value_bytes = body.get("valueBytes")
        value_int = body.get("valueInt")
        value_boolean = body.get("valueBoolean")
        cursor.execute(
            f"""
            insert into {table_name}(
                objectId,
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
            values (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, now())
            on conflict (objectId, tag) do update set
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
                object_id,
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
        return rank

    @app.get("/object/metadata/list")
    @app.get("/api/object/metadata/list")
    def obj_metadata_list():
        space_id = str(request.args.get("spaceId") or "").strip().lower()
        data_type = str(request.args.get("dataType") or "").strip().lower()
        object_id = str(request.args.get("objectId") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                reserved_items = read_metadata_obj_status(cursor, space_id, normalized_data_type, object_id)
                table_name = get_obj_metadata_table_name(space_id, normalized_data_type)
                ensure_obj_metadata_table(cursor, space_id, normalized_data_type)
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
                    from {table_name}
                    where objectId = %s
                    order by rank asc nulls last, tag asc
                    """,
                    (object_id,),
                )
                user_items = [serialize_metadata_item_row(row) for row in (cursor.fetchall() or [])]
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "items": reserved_items + user_items,
            }

        return run_in_transaction(action)

    @app.post("/object/metadata/upsert")
    @app.post("/api/object/metadata/upsert")
    def obj_metadata_upsert():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        tag = str(body.get("tag") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not tag:
                raise RuntimeError("tag is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                read_metadata_obj_status(cursor, space_id, normalized_data_type, object_id)
                rank = upsert_obj_metadata_row(cursor, space_id, normalized_data_type, object_id, tag, body)
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "tag": tag,
                "rank": rank,
            }

        return run_in_transaction(action)

    @app.post("/object/metadata/ensure")
    @app.post("/api/object/metadata/ensure")
    def obj_metadata_ensure():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        tag = str(body.get("tag") or "").strip()
        is_overwrite = body.get("isOverwrite")
        is_overwrite_enabled = True if is_overwrite is None else bool(is_overwrite)

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not tag:
                raise RuntimeError("tag is required")
            assert_user_obj_metadata_tag(tag)
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                read_metadata_obj_status(cursor, space_id, normalized_data_type, object_id)
                table_name = get_obj_metadata_table_name(space_id, normalized_data_type)
                ensure_obj_metadata_table(cursor, space_id, normalized_data_type)
                cursor.execute(
                    f"""
                    select tag
                    from {table_name}
                    where objectId = %s and tag = %s
                    limit 1
                    """,
                    (object_id, tag),
                )
                existing_row = cursor.fetchone()
                if existing_row and not is_overwrite_enabled:
                    return {
                        "spaceId": space_id,
                        "dataType": normalized_data_type,
                        "objectId": object_id,
                        "tag": tag,
                        "isInserted": False,
                        "isUpdated": False,
                        "isNoop": True,
                    }
                rank = upsert_obj_metadata_row(cursor, space_id, normalized_data_type, object_id, tag, body)
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "tag": tag,
                "isInserted": existing_row is None,
                "isUpdated": existing_row is not None,
                "isNoop": False,
                "rank": rank,
            }

        return run_in_transaction(action)

    @app.post("/object/metadata/delete")
    @app.post("/api/object/metadata/delete")
    def obj_metadata_delete():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        tag = str(body.get("tag") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not tag:
                raise RuntimeError("tag is required")
            assert_user_obj_metadata_tag(tag)
            with closing(db.cursor()) as cursor:
                ensure_obj_metadata_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_metadata_table_name(space_id, normalized_data_type)
                cursor.execute(
                    f"""
                    delete from {table_name}
                    where objectId = %s and tag = %s
                    """,
                    (object_id, tag),
                )
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "tag": tag,
            }

        return run_in_transaction(action)

    @app.post("/object/metadata/insert")
    @app.post("/api/object/metadata/insert")
    def obj_metadata_insert():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        tag = str(body.get("tag") or "").strip()
        target_tag = str(body.get("targetTag") or "").strip()
        position = str(body.get("position") or "tail").strip().lower()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not tag:
                raise RuntimeError("tag is required")
            if position not in ("above", "below", "tail"):
                raise RuntimeError("position should be above/below/tail")
            assert_user_obj_metadata_tag(tag)
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                read_metadata_obj_status(cursor, space_id, normalized_data_type, object_id)
                row_list = read_obj_metadata_rows(cursor, space_id, normalized_data_type, object_id)
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
                insert_body = dict(body)
                insert_body["rank"] = next_rank
                upsert_obj_metadata_row(cursor, space_id, normalized_data_type, object_id, tag, insert_body)
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "tag": tag,
                "rank": next_rank,
                "position": position,
                "targetTag": target_tag,
            }

        return run_in_transaction(action)

    @app.post("/object/metadata/move")
    @app.post("/api/object/metadata/move")
    def obj_metadata_move():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        tag = str(body.get("tag") or "").strip()
        direction = str(body.get("direction") or "").strip().lower()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not tag:
                raise RuntimeError("tag is required")
            if direction not in ("up", "down"):
                raise RuntimeError("direction should be up/down")
            assert_user_obj_metadata_tag(tag)
            with closing(db.cursor()) as cursor:
                row_list = read_obj_metadata_rows(cursor, space_id, normalized_data_type, object_id)
                target_idx = next((idx for idx, row in enumerate(row_list) if row["tag"] == tag), -1)
                if target_idx < 0:
                    raise RuntimeError(f"tag not found: {tag}")

                if direction == "up":
                    if target_idx <= 0:
                        return {
                            "spaceId": space_id,
                            "dataType": normalized_data_type,
                            "objectId": object_id,
                            "tag": tag,
                            "direction": direction,
                            "isNoop": True,
                        }
                    rank_left = row_list[target_idx - 2]["rank"] if target_idx - 2 >= 0 else None
                    rank_right = row_list[target_idx - 1]["rank"]
                    next_rank = lexorank_between(rank_left, rank_right)
                else:
                    if target_idx >= len(row_list) - 1:
                        return {
                            "spaceId": space_id,
                            "dataType": normalized_data_type,
                            "objectId": object_id,
                            "tag": tag,
                            "direction": direction,
                            "isNoop": True,
                        }
                    rank_left = row_list[target_idx + 1]["rank"]
                    rank_right = row_list[target_idx + 2]["rank"] if target_idx + 2 < len(row_list) else None
                    next_rank = lexorank_between(rank_left, rank_right)

                table_name = get_obj_metadata_table_name(space_id, normalized_data_type)
                cursor.execute(
                    f"""
                    update {table_name}
                    set rank = %s, updatedAt = now()
                    where objectId = %s and tag = %s
                    """,
                    (next_rank, object_id, tag),
                )
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "tag": tag,
                "direction": direction,
            }

        return run_in_transaction(action)
