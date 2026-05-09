from __future__ import annotations

from contextlib import closing

from flask import request


def register_service_routes(app, context: dict):
    make_json_response = context["make_json_response"]
    run_in_transaction = context["run_in_transaction"]
    find_database_preset_by_key = context["find_database_preset_by_key"]
    to_db_config_from_preset = context["to_db_config_from_preset"]
    test_database_connection = context["test_database_connection"]
    build_database_list_payload = context["build_database_list_payload"]
    load_sql_script_text = context["load_sql_script_text"]
    run_sql_script_text = context["run_sql_script_text"]
    check_table_has_columns = context["check_table_has_columns"]
    build_table_issue_text_list = context["build_table_issue_text_list"]
    is_valid_space_id = context["is_valid_space_id"]
    connect = context["connect"]
    psycopg_import_error = context["psycopg_import_error"]
    get_current_database_key = context["get_current_database_key"]
    set_current_database_key = context["set_current_database_key"]
    get_active_database_config = context["get_active_database_config"]
    set_active_database_config = context["set_active_database_config"]
    get_is_database_switching = context["get_is_database_switching"]
    set_is_database_switching = context["set_is_database_switching"]

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

        selected_database_key = get_current_database_key()
        selected_database_config = get_active_database_config()
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
                "currentKey": get_current_database_key(),
                "items": build_database_list_payload(),
            },
        )

    @app.post("/config/database/switch")
    @app.post("/api/config/database/switch")
    def config_database_switch():
        body = request.get_json(silent=True) or {}
        next_database_key = str(body.get("databaseKey") or "").strip()
        if not next_database_key:
            return make_json_response(-1, message="databaseKey is required"), 400
        if get_is_database_switching():
            return make_json_response(-1, message="database switch is busy"), 409

        selected_preset = find_database_preset_by_key(next_database_key)
        if selected_preset is None:
            return make_json_response(-1, message=f"database key not found: {next_database_key}"), 404
        if get_current_database_key() == next_database_key:
            return make_json_response(
                0,
                data={
                    "currentKey": get_current_database_key(),
                    "items": build_database_list_payload(),
                    "messageText": "database already selected",
                },
            )
        set_is_database_switching(True)
        try:
            next_db_config = to_db_config_from_preset(selected_preset)
            test_database_connection(next_db_config)
            set_active_database_config(next_db_config)
            set_current_database_key(next_database_key)
            return make_json_response(
                0,
                data={
                    "currentKey": get_current_database_key(),
                    "items": build_database_list_payload(),
                    "messageText": f"database switched: {get_current_database_key()}",
                },
            )
        except Exception as error:
            return make_json_response(-1, message=f"database switch failed: {error}"), 500
        finally:
            set_is_database_switching(False)

    @app.post("/config/database/reinit")
    @app.post("/api/config/database/reinit")
    def config_database_reinit():
        body = request.get_json(silent=True) or {}
        is_include_example_data_raw = body.get("isIncludeExampleData")
        is_include_example_data = True if is_include_example_data_raw is None else bool(is_include_example_data_raw)
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
            db = connect(**get_active_database_config())
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
            db = connect(**get_active_database_config())
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
                    for data_type in ("text", "bytes", "json"):
                        check_items.append(
                            check_table_has_columns(
                                cursor,
                                f"space_{space_id}_object_{data_type}_status",
                                [
                                    "objectid",
                                    "type",
                                    "isdeleted",
                                    "edittype",
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
