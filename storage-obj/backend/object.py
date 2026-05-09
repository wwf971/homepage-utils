from __future__ import annotations

import base64
import json
from contextlib import closing

from flask import request
from config import EDIT_TYPE_CODE


def register_object_routes(app, context: dict):
    run_in_transaction = context["run_in_transaction"]
    normalize_payload_type = context["normalize_payload_type"]
    normalize_object_type_value = context["normalize_object_type_value"]
    ensure_object_status_table = context["ensure_object_status_table"]
    get_object_table_name = context["get_object_table_name"]
    get_object_history_table_name = context["get_object_history_table_name"]
    get_payload_column_name = context["get_payload_column_name"]
    parse_base64_payload = context["parse_base64_payload"]
    create_ms48_id = context["create_ms48_id"]
    update_only_edit_type_code = int(EDIT_TYPE_CODE["UPDATE-ONLY"])
    update_and_edit_edit_type_code = int(EDIT_TYPE_CODE["UPDATE-AND-EDIT"])
    edit_only_edit_type_code = int(EDIT_TYPE_CODE["EDIT-ONLY"])
    allowed_edit_type_values = {update_only_edit_type_code, update_and_edit_edit_type_code, edit_only_edit_type_code}

    def parse_edit_type_value(raw_value, default_edit_type_value: int):
        if raw_value is None:
            return default_edit_type_value
        try:
            edit_type_value = int(raw_value)
        except Exception:
            raise RuntimeError("editType should be one of 0/1/2")
        if edit_type_value not in allowed_edit_type_values:
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

    @app.get("/object/list")
    @app.get("/api/object/list")
    def object_list():
        space_id = str(request.args.get("spaceId") or "").strip().lower()
        data_type = str(request.args.get("dataType") or "").strip().lower()
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
            normalized_data_type = normalize_payload_type(data_type)
            with closing(db.cursor()) as cursor:
                ensure_object_status_table(cursor, space_id, normalized_data_type)
                table_name = get_object_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_column_name(normalized_data_type)
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
                    select objectId, {value_column_name}, type, editType, createdAt, updatedAt
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
                            "editType": int(row[3] if row[3] is not None else update_only_edit_type_code),
                            "valueText": value_text if value_text is not None else "",
                            "valueJson": value_json,
                            "valueBase64": value_base64,
                            "createdAt": str(row[4] or ""),
                            "updatedAt": str(row[5] or ""),
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

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_object_status_table(cursor, space_id, normalized_data_type)
                table_name = get_object_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_column_name(normalized_data_type)
                cursor.execute(
                    f"""
                    select objectId, {value_column_name}, type, editType, createdAt, updatedAt
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
                return {
                    "spaceId": space_id,
                    "dataType": normalized_data_type,
                    "objectId": str(row[0] or ""),
                    "type": int(row[2] if row[2] is not None else -1),
                    "editType": int(row[3] if row[3] is not None else update_only_edit_type_code),
                    "valueText": row_value if normalized_data_type == "text" and row_value is not None else "",
                    "valueJson": row_value if normalized_data_type == "json" else None,
                    "valueBase64": base64.b64encode(row_value).decode("utf-8") if normalized_data_type == "bytes" and row_value is not None else "",
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
        object_type_value = normalize_object_type_value(body.get("type"), default_value=-1)
        edit_type_value = parse_edit_type_value(body.get("editType"), update_only_edit_type_code)
        created_at_tz = str(body.get("createdAtTz") or "").strip()

        def action(db):
            normalized_data_type = normalize_payload_type(data_type)
            with closing(db.cursor()) as cursor:
                ensure_object_status_table(cursor, space_id, normalized_data_type)
                table_name = get_object_table_name(space_id, normalized_data_type)
                history_table_name = get_object_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_column_name(normalized_data_type)
                object_id = create_ms48_id()
                value = None
                value_placeholder = "%s"
                if normalized_data_type == "text":
                    value = body.get("valueText")
                elif normalized_data_type == "bytes":
                    value_base64 = parse_base64_payload(body.get("valueBase64"))
                    value = base64.b64decode(value_base64.encode("utf-8")) if value_base64 else b""
                elif normalized_data_type == "json":
                    value = json.dumps(body.get("valueJson"))
                    value_placeholder = "%s::jsonb"
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
                    insert into {table_name}(objectId, {value_column_name}, type, isDeleted, editType, createdAt, updatedAt, updatedAtTz)
                    values (%s, {value_placeholder}, %s, false, %s, now(), now(), %s)
                    """,
                    (object_id, value, object_type_value, edit_type_value, created_at_tz or None),
                )
                cursor.execute(
                    f"""
                    insert into {history_table_name}(objectId, versionNum, {value_column_name}, isDataDeleted, createdAt)
                    values (%s, %s, {value_placeholder}, false, now())
                    """,
                    (object_id, 1, value),
                )
            return {
                "spaceId": space_id,
                "dataType": normalized_data_type,
                "objectId": object_id,
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
        object_type_value = normalize_object_type_value(body.get("type"), allow_none=True)
        is_delete_previous_data = body.get("isDeletePreviousData") is True
        is_update_version = parse_nullable_boolean(body.get("isUpdateVersion"), "isUpdateVersion")
        updated_at_tz = str(body.get("updatedAtTz") or "").strip()

        def action(db):
            resolved_is_update_version = is_update_version
            normalized_data_type = normalize_payload_type(data_type)
            if not object_id:
                raise RuntimeError("objectId is required")
            with closing(db.cursor()) as cursor:
                ensure_object_status_table(cursor, space_id, normalized_data_type)
                table_name = get_object_table_name(space_id, normalized_data_type)
                history_table_name = get_object_history_table_name(space_id, normalized_data_type)
                value_column_name = get_payload_column_name(normalized_data_type)
                value = None
                value_placeholder = "%s"
                if normalized_data_type == "text":
                    value = body.get("valueText")
                elif normalized_data_type == "bytes":
                    value_base64 = parse_base64_payload(body.get("valueBase64"))
                    value = base64.b64decode(value_base64.encode("utf-8")) if value_base64 else b""
                elif normalized_data_type == "json":
                    value = json.dumps(body.get("valueJson"))
                    value_placeholder = "%s::jsonb"
                cursor.execute(
                    f"""
                    select {value_column_name}, editType
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
                edit_type_value = int(previous_row[1] if previous_row[1] is not None else update_only_edit_type_code)
                if normalized_data_type == "json":
                    previous_value = json.dumps(previous_value)
                if edit_type_value == update_only_edit_type_code:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = True
                    if resolved_is_update_version is False:
                        raise RuntimeError("isUpdateVersion=false is not allowed in UPDATE-ONLY mode")
                elif edit_type_value == edit_only_edit_type_code:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = False
                    if resolved_is_update_version is True:
                        raise RuntimeError("isUpdateVersion=true is not allowed in EDIT-ONLY mode")
                elif edit_type_value == update_and_edit_edit_type_code:
                    if resolved_is_update_version is None:
                        resolved_is_update_version = False
                else:
                    raise RuntimeError(f"unsupported editType: {edit_type_value}")
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
                        insert into {history_table_name}(objectId, versionNum, {value_column_name}, isDataDeleted, createdAt)
                        values (%s, %s, {value_placeholder}, false, now())
                        """,
                        (object_id, previous_version_num, previous_value),
                    )
                next_version_num = previous_version_num + 1
                cursor.execute(
                    f"""
                    update {table_name}
                    set {value_column_name} = {value_placeholder},
                        type = coalesce(%s, type),
                        isDeleted = false,
                        updatedAt = now(),
                        updatedAtTz = %s
                    where objectId = %s
                    """,
                    (value, object_type_value, updated_at_tz or None, object_id),
                )
                if cursor.rowcount <= 0:
                    raise RuntimeError(f"object not found: {object_id}")
                if resolved_is_update_version:
                    cursor.execute(
                        f"""
                        insert into {history_table_name}(objectId, versionNum, {value_column_name}, isDataDeleted, createdAt)
                        values (%s, %s, {value_placeholder}, false, now())
                        """,
                        (object_id, next_version_num, value),
                    )
                    if is_delete_previous_data:
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
                        raise RuntimeError("isDeletePreviousData=true requires isUpdateVersion=true")
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
                "isUpdateVersion": resolved_is_update_version,
                "isDeletePreviousData": is_delete_previous_data,
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
                ensure_object_status_table(cursor, space_id, normalized_data_type)
                table_name = get_object_table_name(space_id, normalized_data_type)
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
