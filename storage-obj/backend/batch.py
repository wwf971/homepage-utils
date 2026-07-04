from __future__ import annotations

from copy import deepcopy
from typing import Any

from flask import request


class BatchOpError(RuntimeError):
    def __init__(self, message: str, response_data: dict[str, Any]):
        super().__init__(message)
        self.response_data = response_data


def register_batch_routes(app, context: dict):
    run_in_transaction = context["run_in_transaction"]

    op_endpoint_allowed_set = {
        "/api/metadata/upsert",
        "/api/space/create",
        "/api/space/delete",
        "/api/space/clear",
        "/api/space/metadata/upsert",
        "/api/space/metadata/ensure",
        "/api/space/metadata/insert",
        "/api/space/metadata/delete",
        "/api/space/metadata/move",
        "/api/object/create",
        "/api/object/update",
        "/api/object/delete",
        "/api/object/restore",
        "/api/object/metadata/upsert",
        "/api/object/metadata/ensure",
        "/api/object/metadata/insert",
        "/api/object/metadata/delete",
        "/api/object/metadata/move",
        "/api/object/version/checkout",
        "/api/object/version/rollback",
        "/api/object/version/delete-data",
    }

    def normalize_op_endpoint(endpoint: Any):
        endpoint_text = str(endpoint or "").strip()
        if not endpoint_text:
            raise RuntimeError("op endpoint is required")
        if not endpoint_text.startswith("/"):
            endpoint_text = f"/{endpoint_text}"
        if not endpoint_text.startswith("/api/"):
            endpoint_text = f"/api{endpoint_text}"
        if endpoint_text not in op_endpoint_allowed_set:
            raise RuntimeError(f"op endpoint is not allowed: {endpoint_text}")
        return endpoint_text

    def read_ref_value(ref_text: str, result_by_op_id: dict[str, dict[str, Any]]):
        ref_path = ref_text[1:].split(".")
        if len(ref_path) < 2:
            raise RuntimeError(f"invalid op reference: {ref_text}")
        op_id = ref_path[0]
        if op_id not in result_by_op_id:
            raise RuntimeError(f"op reference not found: {ref_text}")
        value: Any = result_by_op_id[op_id]
        for part in ref_path[1:]:
            if isinstance(value, dict) and part in value:
                value = value[part]
                continue
            raise RuntimeError(f"op reference not found: {ref_text}")
        return value

    def resolve_refs(value: Any, result_by_op_id: dict[str, dict[str, Any]]):
        if isinstance(value, str) and value.startswith("$"):
            return read_ref_value(value, result_by_op_id)
        if isinstance(value, list):
            return [resolve_refs(item, result_by_op_id) for item in value]
        if isinstance(value, dict):
            return {key: resolve_refs(item, result_by_op_id) for key, item in value.items()}
        return value

    def execute_op(op_item: dict[str, Any], result_by_op_id: dict[str, dict[str, Any]]):
        endpoint = normalize_op_endpoint(op_item.get("endpoint"))
        body_raw = op_item.get("body")
        if body_raw is None:
            body_raw = {}
        if not isinstance(body_raw, dict):
            raise RuntimeError("op body should be an object")
        body_resolved = resolve_refs(deepcopy(body_raw), result_by_op_id)
        with app.test_request_context(endpoint, method="POST", json=body_resolved):
            response = app.make_response(app.dispatch_request())
            data = response.get_json(silent=True) or {}
        code = int(data.get("code") if data.get("code") is not None else -1)
        result_item = {
            "code": code,
        }
        if op_item.get("opId") is not None:
            result_item["opId"] = str(op_item.get("opId"))
        if data.get("data") is not None:
            result_item["data"] = data.get("data")
        if data.get("message"):
            result_item["message"] = data.get("message")
        return result_item

    @app.post("/batch/transaction")
    @app.post("/api/batch/transaction")
    def batch_transaction():
        body = request.get_json(silent=True) or {}

        def action(_db):
            op_list = body.get("ops")
            if not isinstance(op_list, list):
                raise RuntimeError("ops should be an array")

            op_id_set = set()
            for op_item in op_list:
                if not isinstance(op_item, dict):
                    raise RuntimeError("each op should be an object")
                op_id = op_item.get("opId")
                if op_id is None:
                    continue
                op_id_text = str(op_id).strip()
                if not op_id_text:
                    raise RuntimeError("opId should not be empty")
                if op_id_text in op_id_set:
                    raise RuntimeError(f"opId duplicated: {op_id_text}")
                op_id_set.add(op_id_text)

            result_list = []
            result_by_op_id = {}
            for op_idx, op_item in enumerate(op_list):
                op_id = str(op_item.get("opId")).strip() if op_item.get("opId") is not None else ""
                try:
                    result_item = execute_op(op_item, result_by_op_id)
                except Exception as error:
                    raise BatchOpError(
                        str(error),
                        {
                            "opNum": len(op_list),
                            "failedOpIndex": op_idx,
                            "failedOpId": op_id,
                            "isRolledBack": True,
                        },
                    ) from error
                if int(result_item.get("code", -1)) < 0:
                    raise BatchOpError(
                        str(result_item.get("message") or "op failed"),
                        {
                            "opNum": len(op_list),
                            "failedOpIndex": op_idx,
                            "failedOpId": op_id,
                            "isRolledBack": True,
                        },
                    )
                result_list.append(result_item)
                if op_id:
                    result_by_op_id[op_id] = result_item
            return {
                "opNum": len(op_list),
                "results": result_list,
            }

        return run_in_transaction(action)
