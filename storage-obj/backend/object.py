from __future__ import annotations

import base64
import json
from contextlib import closing

from flask import request
from config import EDIT_TYPE_CODE
from obj_metadata import register_obj_metadata_routes


def register_object_routes(app, context: dict):
    run_in_transaction = context["run_in_transaction"]
    normalize_payload_type = context["normalize_payload_type"]
    normalize_obj_type_value = context["normalize_obj_type_value"]
    ensure_obj_status_table = context["ensure_obj_status_table"]
    get_obj_table_name = context["get_obj_table_name"]
    get_obj_history_table_name = context["get_obj_history_table_name"]
    get_payload_col_name = context["get_payload_col_name"]
    parse_base64_payload = context["parse_base64_payload"]
    create_ms48_id = context["create_ms48_id"]
    ensure_obj_metadata_table = context["ensure_obj_metadata_table"]
    get_obj_metadata_table_name = context["get_obj_metadata_table_name"]
    read_obj_metadata_rows = context["read_obj_metadata_rows"]
    resolve_obj_metadata_rank = context["resolve_obj_metadata_rank"]
    serialize_metadata_item_row = context["serialize_metadata_item_row"]
    obj_metadata_tags_reserved = context["obj_metadata_tags_reserved"]
    lexorank_between = context["lexorank_between"]
    edit_type_code_update_only = int(EDIT_TYPE_CODE["UPDATE-ONLY"])
    edit_type_code_update_and_edit = int(EDIT_TYPE_CODE["UPDATE-AND-EDIT"])
    edit_type_code_edit_only = int(EDIT_TYPE_CODE["EDIT-ONLY"])
    edit_type_values_allowed = {edit_type_code_update_only, edit_type_code_update_and_edit, edit_type_code_edit_only}

    def parse_edit_type_value(raw_value, default_edit_type_value: int):
        if raw_value is None:
            return default_edit_type_value
        try:
            edit_type_value = int(raw_value)
        except Exception:
            raise RuntimeError("editType should be one of 0/1/2")
        if edit_type_value not in edit_type_values_allowed:
            raise RuntimeError("editType should be one of 0/1/2")
        return edit_type_value

    def parse_nullable_boolean(raw_value, field_name: str):
        if raw_value is None:
            return None
        if isinstance(raw_value, bool):
            return raw_value
        if isinstance(raw_value, str):
            normalized_text = raw_value.strip().lower()
            if normalized_text in ("true", "1", "yes", "y", "on"):
                return True
            if normalized_text in ("false", "0", "no", "n", "off"):
                return False
        raise RuntimeError(f"{field_name} should be boolean or null")

    def parse_version_num(raw_value, field_name: str = "versionId"):
        raw_text = str(raw_value or "").strip()
        if not raw_text:
            raise RuntimeError(f"{field_name} is required")
        try:
            version_num = int(raw_text)
        except Exception:
            raise RuntimeError(f"{field_name} should be a positive integer")
        if version_num <= 0:
            raise RuntimeError(f"{field_name} should be a positive integer")
        return version_num

    def read_version_num_from_body(body: dict, field_name: str = "versionId"):
        return parse_version_num(body.get(field_name), field_name)

    def read_value_from_body(body: dict, normalized_data_type: str):
        value_placeholder = "%s"
        if normalized_data_type == "text":
            return body.get("valueText"), value_placeholder
        if normalized_data_type == "bytes":
            value_base64 = parse_base64_payload(body.get("valueBase64"))
            return base64.b64decode(value_base64.encode("utf-8")) if value_base64 else b"", value_placeholder
        value_placeholder = "%s::jsonb"
        return json.dumps(body.get("valueJson")), value_placeholder

    def encode_value_for_response(row_value, normalized_data_type: str):
        return {
            "valueText": row_value if normalized_data_type == "text" and row_value is not None else "",
            "valueJson": row_value if normalized_data_type == "json" else None,
            "valueBase64": base64.b64encode(row_value).decode("utf-8") if normalized_data_type == "bytes" and row_value is not None else "",
        }

    def read_latest_version_num(cursor, history_table_name: str, object_id: str):
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
        row = cursor.fetchone()
        return int(row[0]) if row and row[0] is not None else None

    def resolve_current_version_num(cursor, table_name: str, history_table_name: str, object_id: str):
        cursor.execute(
            f"""
            select versionNumHead
            from {table_name}
            where objectId = %s
            limit 1
            """,
            (object_id,),
        )
        row = cursor.fetchone()
        if row and row[0] is not None:
            return int(row[0])
        return read_latest_version_num(cursor, history_table_name, object_id)

    @app.get("/object/list")
    @app.get("/api/object/list")
    def object_list():
        space_id = str(request.args.get("spaceId") or "").strip().lower()
        data_type = str(request.args.get("dataType") or "").strip().lower()
        search_text = str(request.args.get("searchText") or "").strip()
        object_type_raw = request.args.get("type")
        object_type_filter = normalize_obj_type_value(object_type_raw, allow_none=True)
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
            normalized_data_type = normalize_payload_type(data_type)
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_col_name(normalized_data_type)
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
                    select objectId, {value_column_name}, type, editType, createdAt, updatedAt, versionNumHead
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
                    row_value = row[1]
                    value_text = row_value if normalized_data_type == "text" else ""
                    value_json = row_value if normalized_data_type == "json" else None
                    value_base64 = base64.b64encode(row_value).decode("utf-8") if normalized_data_type == "bytes" and row_value is not None else ""
                    item_list.append(
                        {
                            "objectId": str(row[0] or ""),
                            "dataType": normalized_data_type,
                            "type": int(row[2] if row[2] is not None else -1),
                            "editType": int(row[3] if row[3] is not None else edit_type_code_update_only),
                            "valueText": value_text if value_text is not None else "",
                            "valueJson": value_json,
                            "valueBase64": value_base64,
                            "createdAt": str(row[4] or ""),
                            "updatedAt": str(row[5] or ""),
                            "versionId": str(row[6] or ""),
                        }
                    )
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
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
        data_type = str(request.args.get("dataType") or "").strip().lower()
        object_id = str(request.args.get("objectId") or "").strip()
        version_id_text = str(request.args.get("versionId") or request.args.get("versionNum") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_col_name(normalized_data_type)
                if version_id_text:
                    version_num = parse_version_num(version_id_text)
                    cursor.execute(
                        f"""
                        select h.objectId, h.versionNum, h.{value_column_name}, h.isDataDeleted, h.createdAt, s.type, s.editType
                        from {history_table_name} h
                        left join {table_name} s on s.objectId = h.objectId
                        where h.objectId = %s and h.versionNum = %s
                        limit 1
                        """,
                        (object_id, version_num),
                    )
                    row = cursor.fetchone()
                    if not row:
                        raise RuntimeError(f"history version not found: {object_id}@{version_num}")
                    if row[3] is True:
                        raise RuntimeError(f"history version data deleted: {object_id}@{version_num}")
                    row_value = row[2]
                    return {
                        "spaceId": space_id,
                        "dataType": normalized_data_type,
                        "objectId": str(row[0] or ""),
                        "versionId": str(row[1] or ""),
                        "type": int(row[5] if row[5] is not None else -1),
                        "editType": int(row[6] if row[6] is not None else edit_type_code_update_only),
                        **encode_value_for_response(row_value, normalized_data_type),
                        "isDataDeleted": bool(row[3]),
                        "createdAt": str(row[4] or ""),
                    }
                cursor.execute(
                    f"""
                    select objectId, {value_column_name}, type, editType, createdAt, updatedAt, versionNumHead
                    from {table_name}
                    where objectId = %s and isDeleted = false
                    limit 1
                    """,
                    (object_id,),
                )
                row = cursor.fetchone()
                if not row:
                    raise RuntimeError(f"object not found: {object_id}")
                row_value = row[1]
                version_num_head = int(row[6]) if row[6] is not None else resolve_current_version_num(cursor, table_name, history_table_name, object_id)
                return {
                    "spaceId": space_id,
                    "dataType": normalized_data_type,
                    "objectId": str(row[0] or ""),
                    "versionId": str(version_num_head or ""),
                    "type": int(row[2] if row[2] is not None else -1),
                    "editType": int(row[3] if row[3] is not None else edit_type_code_update_only),
                    **encode_value_for_response(row_value, normalized_data_type),
                    "createdAt": str(row[4] or ""),
                    "updatedAt": str(row[5] or ""),
                }

        return run_in_transaction(action)

    @app.post("/object/create")
    @app.post("/api/object/create")
    def object_create():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_type_value = normalize_obj_type_value(body.get("type"), default_value=-1)
        edit_type_value = parse_edit_type_value(body.get("editType"), edit_type_code_update_only)
        created_at_tz = str(body.get("createdAtTz") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_col_name(normalized_data_type)
                object_id = create_ms48_id()
                value, value_placeholder = read_value_from_body(body, normalized_data_type)
                version_num = 1
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
                    insert into {table_name}(objectId, {value_column_name}, type, isDeleted, editType, versionNumHead, createdAt, updatedAt, updatedAtTz)
                    values (%s, {value_placeholder}, %s, false, %s, %s, now(), now(), %s)
                    """,
                    (object_id, value, object_type_value, edit_type_value, version_num, created_at_tz or None),
                )
                cursor.execute(
                    f"""
                    insert into {history_table_name}(objectId, versionNum, versionNumPrev, {value_column_name}, isDataDeleted, createdAt)
                    values (%s, %s, null, {value_placeholder}, false, now())
                    """,
                    (object_id, version_num, value),
                )
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "versionId": str(version_num),
                "type": object_type_value,
                "editType": edit_type_value,
            }

        return run_in_transaction(action)

    @app.post("/object/update")
    @app.post("/api/object/update")
    def object_update():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        object_type_value = normalize_obj_type_value(body.get("type"), allow_none=True)
        # For append-version writes, this clears the previous version's stored value
        # and keeps only version topology via isDataDeleted=true.
        is_delete_previous_data = body.get("isDeletePrevVersionData") is True
        is_update_version = parse_nullable_boolean(body.get("isUpdateVersion"), "isUpdateVersion")
        updated_at_tz = str(body.get("updatedAtTz") or "").strip()

        def action(db):
            resolved_is_update_version = is_update_version
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_col_name(normalized_data_type)
                value, value_placeholder = read_value_from_body(body, normalized_data_type)
                cursor.execute(
                    f"""
                    select {value_column_name}, editType, versionNumHead
                    from {table_name}
                    where objectId = %s and isDeleted = false
                    limit 1
                    """,
                    (object_id,),
                )
                previous_row = cursor.fetchone()
                if not previous_row:
                    raise RuntimeError(f"object not found: {object_id}")
                previous_value = previous_row[0]
                edit_type_value = int(previous_row[1] if previous_row[1] is not None else edit_type_code_update_only)
                version_num_head = int(previous_row[2]) if previous_row[2] is not None else None
                if normalized_data_type == "json":
                    previous_value = json.dumps(previous_value)
                if edit_type_value == edit_type_code_update_only:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = True
                    if resolved_is_update_version is False:
                        raise RuntimeError("isUpdateVersion=false is not allowed in UPDATE-ONLY mode")
                elif edit_type_value == edit_type_code_edit_only:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = False
                    if resolved_is_update_version is True:
                        raise RuntimeError("isUpdateVersion=true is not allowed in EDIT-ONLY mode")
                elif edit_type_value == edit_type_code_update_and_edit:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = False
                else:
                    raise RuntimeError(f"unsupported editType: {edit_type_value}")
                latest_version_num = read_latest_version_num(cursor, history_table_name, object_id)
                previous_version_num = version_num_head or latest_version_num or 1
                if latest_version_num is None:
                    cursor.execute(
                        f"""
                        insert into {history_table_name}(objectId, versionNum, versionNumPrev, {value_column_name}, isDataDeleted, createdAt)
                        values (%s, %s, null, {value_placeholder}, false, now())
                        """,
                        (object_id, previous_version_num, previous_value),
                    )
                    latest_version_num = previous_version_num
                next_version_num = latest_version_num + 1
                cursor.execute(
                    f"""
                    update {table_name}
                    set {value_column_name} = {value_placeholder},
                        type = coalesce(%s, type),
                        isDeleted = false,
                        versionNumHead = %s,
                        updatedAt = now(),
                        updatedAtTz = %s
                    where objectId = %s
                    """,
                    (
                        value,
                        object_type_value,
                        next_version_num if resolved_is_update_version else previous_version_num,
                        updated_at_tz or None,
                        object_id,
                    ),
                )
                if cursor.rowcount <= 0:
                    raise RuntimeError(f"object not found: {object_id}")
                if resolved_is_update_version:
                    cursor.execute(
                        f"""
                        insert into {history_table_name}(objectId, versionNum, versionNumPrev, {value_column_name}, isDataDeleted, createdAt)
                        values (%s, %s, %s, {value_placeholder}, false, now())
                        """,
                        (object_id, next_version_num, previous_version_num, value),
                    )
                    if is_delete_previous_data:
                        # Release previous version data only on append-version writes.
                        cursor.execute(
                            f"""
                            update {history_table_name}
                            set {value_column_name} = null,
                                isDataDeleted = true
                            where objectId = %s and versionNum = %s
                            """,
                            (object_id, previous_version_num),
                        )
                else:
                    if is_delete_previous_data:
                        # In-version edit does not create a previous-version boundary to clean up.
                        raise RuntimeError("isDeletePrevVersionData=true requires isUpdateVersion=true")
                    cursor.execute(
                        f"""
                        update {history_table_name}
                        set {value_column_name} = {value_placeholder},
                            isDataDeleted = false
                        where objectId = %s and versionNum = %s
                        """,
                        (value, object_id, previous_version_num),
                    )
                    if cursor.rowcount <= 0:
                        raise RuntimeError(f"history version not found: {object_id}@{previous_version_num}")
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "type": object_type_value,
                "editType": edit_type_value,
                "versionId": str(next_version_num if resolved_is_update_version else previous_version_num),
                "isUpdateVersion": resolved_is_update_version,
                "isDeletePrevVersionData": is_delete_previous_data,
            }

        return run_in_transaction(action)

    @app.post("/object/delete")
    @app.post("/api/object/delete")
    def object_delete():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_ids = body.get("objectIds")
        if not isinstance(object_ids, list):
            object_ids = []
        object_id_single = str(body.get("objectId") or "").strip()
        if object_id_single:
            object_ids.append(object_id_single)
        normalized_object_ids = sorted(set(str(item or "").strip() for item in object_ids if str(item or "").strip()))

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not normalized_object_ids:
                raise RuntimeError("objectIds is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
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
                "dataType": normalized_data_type,
                "objectIds": normalized_object_ids,
                "deletedNum": len(normalized_object_ids),
            }

        return run_in_transaction(action)

    def restore_object_from_version(cursor, space_id: str, normalized_data_type: str, object_id: str, version_num: int):
        table_name = get_obj_table_name(space_id, normalized_data_type)
        history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
        value_column_name = get_payload_col_name(normalized_data_type)
        value_placeholder = "%s::jsonb" if normalized_data_type == "json" else "%s"
        cursor.execute(
            f"""
            select versionNum, {value_column_name}, isDataDeleted
            from {history_table_name}
            where objectId = %s and versionNum = %s
            limit 1
            """,
            (object_id, version_num),
        )
        history_row = cursor.fetchone()
        if not history_row:
            raise RuntimeError(f"history version not found: {object_id}@{version_num}")
        if history_row[2] is True:
            raise RuntimeError(f"history version data deleted: {object_id}@{version_num}")
        value = json.dumps(history_row[1]) if normalized_data_type == "json" else history_row[1]
        cursor.execute(
            f"""
            insert into {table_name}(objectId, {value_column_name}, type, isDeleted, editType, versionNumHead, createdAt, updatedAt)
            values (%s, {value_placeholder}, -1, false, %s, %s, now(), now())
            on conflict (objectId) do update set
                {value_column_name} = excluded.{value_column_name},
                isDeleted = false,
                versionNumHead = excluded.versionNumHead,
                updatedAt = now()
            """,
            (object_id, value, edit_type_code_update_only, version_num),
        )
        return {
            "spaceId": space_id,
            "dataType": normalized_data_type,
            "objectId": object_id,
            "versionId": str(version_num),
        }

    @app.post("/object/restore")
    @app.post("/api/object/restore")
    def object_restore():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                version_num = resolve_current_version_num(cursor, table_name, history_table_name, object_id)
                if version_num is None:
                    raise RuntimeError(f"object history not found: {object_id}")
                return restore_object_from_version(cursor, space_id, normalized_data_type, object_id, version_num)

        return run_in_transaction(action)

    @app.get("/object/version/list")
    @app.get("/api/object/version/list")
    def object_version_list():
        space_id = str(request.args.get("spaceId") or "").strip().lower()
        data_type = str(request.args.get("dataType") or "").strip().lower()
        object_id = str(request.args.get("objectId") or "").strip()
        page_index_raw = str(request.args.get("pageIndex") or "").strip()
        page_size_raw = str(request.args.get("pageSize") or "").strip()
        try:
            page_index = int(page_index_raw) if page_index_raw else 1
        except Exception:
            page_index = 1
        try:
            page_size = int(page_size_raw) if page_size_raw else 100
        except Exception:
            page_size = 100
        page_index = max(1, page_index)
        page_size = max(1, min(page_size, 500))

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                table_name = get_obj_table_name(space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                cursor.execute(
                    f"""
                    select count(1)
                    from {history_table_name}
                    where objectId = %s
                    """,
                    (object_id,),
                )
                count_row = cursor.fetchone()
                total_count = int(count_row[0] if count_row and count_row[0] is not None else 0)
                version_num_head = resolve_current_version_num(cursor, table_name, history_table_name, object_id)
                offset = (page_index - 1) * page_size
                cursor.execute(
                    f"""
                    select versionNum, versionNumPrev, isDataDeleted, createdAt
                    from {history_table_name}
                    where objectId = %s
                    order by versionNum desc
                    limit %s offset %s
                    """,
                    (object_id, page_size, offset),
                )
                row_list = cursor.fetchall() or []
                item_list = [
                    {
                        "objectId": object_id,
                        "versionId": str(row[0] or ""),
                        "versionIdPrev": str(row[1] or ""),
                        "isDataDeleted": bool(row[2]),
                        "isHead": version_num_head is not None and int(row[0]) == version_num_head,
                        "createdAt": str(row[3] or ""),
                    }
                    for row in row_list
                ]
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "versionIdHead": str(version_num_head or ""),
                "pageIndex": page_index,
                "pageSize": page_size,
                "totalCount": total_count,
                "items": item_list,
            }

        return run_in_transaction(action)

    def checkout_object_version(body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        version_num = read_version_num_from_body(body)

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                return restore_object_from_version(cursor, space_id, normalized_data_type, object_id, version_num)

        return run_in_transaction(action)

    @app.post("/object/version/checkout")
    @app.post("/api/object/version/checkout")
    def object_version_checkout():
        body = request.get_json(silent=True) or {}
        return checkout_object_version(body)

    @app.post("/object/version/rollback")
    @app.post("/api/object/version/rollback")
    def object_version_rollback():
        body = request.get_json(silent=True) or {}
        return checkout_object_version(body)

    @app.post("/object/version/delete-data")
    @app.post("/api/object/version/delete-data")
    def object_version_delete_data():
        body = request.get_json(silent=True) or {}
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        raw_version_ids = body.get("versionIds")
        if not isinstance(raw_version_ids, list):
            raw_version_ids = []
        if body.get("versionId") is not None:
            raw_version_ids.append(body.get("versionId"))
        version_num_list = sorted(set(parse_version_num(item) for item in raw_version_ids))

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            if not version_num_list:
                raise RuntimeError("versionId is required")
            with closing(db.cursor()) as cursor:
                ensure_obj_status_table(cursor, space_id, normalized_data_type)
                history_table_name = get_obj_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_col_name(normalized_data_type)
                cursor.execute(
                    f"""
                    update {history_table_name}
                    set {value_column_name} = null,
                        isDataDeleted = true
                    where objectId = %s and versionNum = any(%s)
                    """,
                    (object_id, version_num_list),
                )
                updated_count = int(cursor.rowcount or 0)
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
                "versionIds": [str(item) for item in version_num_list],
                "deletedNum": updated_count,
            }

        return run_in_transaction(action)

    register_obj_metadata_routes(
        app,
        {
            "run_in_transaction": run_in_transaction,
            "normalize_payload_type": normalize_payload_type,
            "ensure_obj_status_table": ensure_obj_status_table,
            "ensure_obj_metadata_table": ensure_obj_metadata_table,
            "get_obj_table_name": get_obj_table_name,
            "get_obj_metadata_table_name": get_obj_metadata_table_name,
            "get_obj_history_table_name": get_obj_history_table_name,
            "read_obj_metadata_rows": read_obj_metadata_rows,
            "resolve_obj_metadata_rank": resolve_obj_metadata_rank,
            "serialize_metadata_item_row": serialize_metadata_item_row,
            "obj_metadata_tags_reserved": obj_metadata_tags_reserved,
            "lexorank_between": lexorank_between,
            "resolve_current_version_num": resolve_current_version_num,
            "edit_type_code_update_only": edit_type_code_update_only,
        },
    )
