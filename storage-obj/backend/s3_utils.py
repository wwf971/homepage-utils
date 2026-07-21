from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

from config_loader import build_storage_endpoint_registry_from_config, load_project_config

boto3_import_error = None
try:
    import boto3
    from botocore.config import Config as BotoConfig
except Exception as error:
    boto3 = None
    BotoConfig = None
    boto3_import_error = error


def load_aws_s3_config(dir_base: Path):
    project_config = load_project_config(dir_base)
    registry, default_key = build_storage_endpoint_registry_from_config(project_config)
    default_item = registry.get(default_key) or {}
    if default_item.get("type") == "s3_aws":
        return default_item
    return next((item for item in registry.values() if item.get("type") == "s3_aws"), {})


def normalize_s3_path_prefix(path_prefix: Any):
    return str(path_prefix or "").strip().strip("/")


def build_s3_object_key(path_prefix: Any, path_relative: str):
    prefix = normalize_s3_path_prefix(path_prefix)
    relative = str(path_relative or "").strip().lstrip("/")
    return f"{prefix}/{relative}" if prefix else relative


def create_s3_client(config: dict[str, Any], timeout_seconds: int = 10):
    if boto3 is None or BotoConfig is None:
        import_error_text = str(boto3_import_error) if boto3_import_error else "unknown import error"
        raise RuntimeError(f"boto3 is not installed: {import_error_text}")

    access_key_id = str(config.get("access_key_id") or "").strip()
    secret_access_key = str(config.get("secret_access_key") or "").strip()
    if bool(access_key_id) != bool(secret_access_key):
        raise RuntimeError("S3 access_key_id and secret_access_key must be set together")

    client_args: dict[str, Any] = {
        "config": BotoConfig(
            connect_timeout=timeout_seconds,
            read_timeout=timeout_seconds,
            retries={"max_attempts": 1},
        ),
    }
    region_name = str(config.get("region_name") or "").strip()
    endpoint_url = str(config.get("endpoint_url") or "").strip()
    session_token = str(config.get("session_token") or "").strip()
    if region_name:
        client_args["region_name"] = region_name
    if endpoint_url:
        client_args["endpoint_url"] = endpoint_url
    if access_key_id:
        client_args["aws_access_key_id"] = access_key_id
        client_args["aws_secret_access_key"] = secret_access_key
    if session_token:
        client_args["aws_session_token"] = session_token
    return boto3.client("s3", **client_args)


def test_s3_read_write_access(config: dict[str, Any], timeout_seconds: int = 10):
    bucket_name = str(config.get("bucket_name") or "").strip()
    if not bucket_name:
        raise RuntimeError("S3 bucket_name is required")

    path_prefix = normalize_s3_path_prefix(config.get("path_prefix"))
    test_id = uuid.uuid4().hex
    object_key = build_s3_object_key(path_prefix, f"__test__/read-write/{test_id}.txt")
    content_written = f"storage-obj s3 access test {test_id}".encode("utf-8")
    client = create_s3_client(config, timeout_seconds=timeout_seconds)
    is_written = False
    error_primary = None
    error_cleanup = None

    try:
        client.put_object(
            Bucket=bucket_name,
            Key=object_key,
            Body=content_written,
            ContentType="text/plain; charset=utf-8",
        )
        is_written = True
        response = client.get_object(Bucket=bucket_name, Key=object_key)
        response_body = response["Body"]
        try:
            content_read = response_body.read()
        finally:
            response_body.close()
        if content_read != content_written:
            raise RuntimeError("S3 read content does not match written content")
    except Exception as error:
        error_primary = error
    finally:
        if is_written:
            try:
                client.delete_object(Bucket=bucket_name, Key=object_key)
            except Exception as error:
                error_cleanup = error

    if error_primary is not None:
        if error_cleanup is not None:
            raise RuntimeError(f"{error_primary}; test object cleanup failed: {error_cleanup}") from error_primary
        raise error_primary
    if error_cleanup is not None:
        raise RuntimeError(f"S3 read/write succeeded, but test object cleanup failed: {error_cleanup}") from error_cleanup

    return {
        "bucketName": bucket_name,
        "regionName": str(config.get("region_name") or "").strip(),
        "pathPrefix": path_prefix,
        "objectKey": object_key,
        "isWriteVerified": True,
        "isReadVerified": True,
        "isCleanupVerified": True,
    }


def _utc_now_text():
    return datetime.now(timezone.utc).isoformat()


class S3StorageBackend:
    def __init__(self, config: dict[str, Any], create_id, lexorank_between):
        self.config = config
        self.bucket_name = str(config.get("bucket_name") or "").strip()
        if not self.bucket_name:
            raise RuntimeError("S3 bucket_name is required")
        self.path_prefix = normalize_s3_path_prefix(config.get("path_prefix"))
        self.client = create_s3_client(config)
        self.create_id = create_id
        self.lexorank_between = lexorank_between

    def key(self, relative: str):
        return build_s3_object_key(self.path_prefix, relative)

    def get_bytes(self, relative: str):
        try:
            response = self.client.get_object(Bucket=self.bucket_name, Key=self.key(relative))
        except Exception as error:
            response_error = getattr(error, "response", {})
            error_code = str((response_error.get("Error") or {}).get("Code") or "")
            if error_code in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        response_body = response["Body"]
        try:
            return response_body.read()
        finally:
            close = getattr(response_body, "close", None)
            if close:
                close()

    def put_bytes(self, relative: str, content: bytes, content_type: str = "application/octet-stream", is_create_only: bool = False):
        arguments = {
            "Bucket": self.bucket_name,
            "Key": self.key(relative),
            "Body": content,
            "ContentType": content_type,
        }
        if is_create_only:
            arguments["IfNoneMatch"] = "*"
        return self.client.put_object(**arguments)

    def get_json(self, relative: str, default=None):
        content = self.get_bytes(relative)
        if content is None:
            return default
        return json.loads(content.decode("utf-8"))

    def put_json(self, relative: str, value: Any, is_create_only: bool = False):
        return self.put_bytes(
            relative,
            json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8"),
            "application/json",
            is_create_only=is_create_only,
        )

    def delete(self, relative: str):
        self.client.delete_object(Bucket=self.bucket_name, Key=self.key(relative))

    def list_relative_keys(self, relative_prefix: str):
        full_prefix = self.key(relative_prefix)
        continuation_token = None
        result = []
        while True:
            arguments = {"Bucket": self.bucket_name, "Prefix": full_prefix}
            if continuation_token:
                arguments["ContinuationToken"] = continuation_token
            response = self.client.list_objects_v2(**arguments)
            for item in response.get("Contents") or []:
                full_key = str(item.get("Key") or "")
                if self.path_prefix:
                    prefix_with_separator = f"{self.path_prefix}/"
                    if not full_key.startswith(prefix_with_separator):
                        continue
                    full_key = full_key[len(prefix_with_separator) :]
                result.append(full_key)
            if not response.get("IsTruncated"):
                return result
            continuation_token = response.get("NextContinuationToken")

    def delete_prefix(self, relative_prefix: str):
        keys = self.list_relative_keys(relative_prefix)
        for relative_key in keys:
            self.delete(relative_key)
        return len(keys)

    def spaces(self):
        value = self.get_json("__metadata__/spaces.json", [])
        return [str(item) for item in value] if isinstance(value, list) else []

    def write_spaces(self, spaces: list[str]):
        self.put_json("__metadata__/spaces.json", sorted(set(spaces)))

    def metadata_prefix(self, scope: str, space_id: str = "", data_type: str = "", object_id: str = ""):
        if scope == "global":
            return "__metadata__/items"
        if scope == "space":
            return f"{space_id}/__metadata__/items"
        return f"{space_id}/{data_type}/{object_id}/__metadata__/items"

    def metadata_key(self, scope: str, tag: str, space_id: str = "", data_type: str = "", object_id: str = ""):
        tag_encoded = quote(tag, safe="")
        return f"{self.metadata_prefix(scope, space_id, data_type, object_id)}/{tag_encoded}.json"

    def metadata_items(self, scope: str, space_id: str = "", data_type: str = "", object_id: str = ""):
        prefix = f"{self.metadata_prefix(scope, space_id, data_type, object_id)}/"
        items = []
        for key in self.list_relative_keys(prefix):
            item = self.get_json(key)
            if isinstance(item, dict):
                items.append(item)
        return sorted(items, key=lambda item: (str(item.get("rank") or ""), str(item.get("tag") or "")))

    def resolve_rank(self, items: list[dict], tag: str, requested_rank: Any):
        rank = str(requested_rank or "").strip().lower()
        if rank:
            return rank
        existing = next((item for item in items if item.get("tag") == tag), None)
        if existing and str(existing.get("rank") or ""):
            return str(existing["rank"])
        rank_left = str(items[-1].get("rank") or "") if items else None
        return self.lexorank_between(rank_left, None)

    def metadata_value(self, body: dict, tag: str, rank: str):
        return {
            "tag": tag,
            "rank": rank,
            "valueType": body.get("valueType"),
            "valueText": body.get("valueText"),
            "valueJson": body.get("valueJson"),
            "valueBytes": body.get("valueBytes"),
            "valueInt": body.get("valueInt"),
            "valueBoolean": body.get("valueBoolean"),
        }

    def object_root(self, space_id: str, data_type: str, object_id: str):
        return f"{space_id}/{data_type}/{object_id}"

    def status(self, space_id: str, data_type: str, object_id: str):
        return self.get_json(f"{self.object_root(space_id, data_type, object_id)}/__status__.json")

    def write_status(self, space_id: str, data_type: str, object_id: str, status: dict):
        self.put_json(f"{self.object_root(space_id, data_type, object_id)}/__status__.json", status)

    def encode_data(self, body: dict, data_type: str):
        if data_type == "text":
            return str(body.get("valueText") or "").encode("utf-8")
        if data_type == "bytes":
            raw_text = str(body.get("valueBase64") or "")
            raw_text = raw_text.split(",", 1)[1] if "," in raw_text else raw_text
            return base64.b64decode(raw_text.encode("utf-8")) if raw_text else b""
        return json.dumps(body.get("valueJson"), ensure_ascii=False, separators=(",", ":")).encode("utf-8")

    def decode_data(self, content: bytes, data_type: str):
        return {
            "valueText": content.decode("utf-8") if data_type == "text" else "",
            "valueJson": json.loads(content.decode("utf-8")) if data_type == "json" else None,
            "valueBase64": base64.b64encode(content).decode("utf-8") if data_type == "bytes" else "",
        }

    def version_root(self, space_id: str, data_type: str, object_id: str, version_id: str):
        return f"{self.object_root(space_id, data_type, object_id)}/versions/{version_id}"

    def read_version(self, space_id: str, data_type: str, object_id: str, version_id: str):
        root = self.version_root(space_id, data_type, object_id, version_id)
        info = self.get_json(f"{root}/info.json")
        if not isinstance(info, dict):
            raise RuntimeError(f"history version not found: {object_id}@{version_id}")
        content = self.get_bytes(f"{root}/data")
        if info.get("isDataDeleted") is True or content is None:
            raise RuntimeError(f"history version data deleted: {object_id}@{version_id}")
        return info, content

    def write_current(self, space_id: str, data_type: str, object_id: str, version_id: str, content: bytes, created_at: str):
        root = self.object_root(space_id, data_type, object_id)
        self.put_bytes(f"{root}/current/data", content)
        self.put_json(f"{root}/current/info.json", {"versionId": version_id, "createdAt": created_at, "updatedAt": _utc_now_text()})

    def require_object(self, space_id: str, data_type: str, object_id: str, is_allow_deleted: bool = False):
        status = self.status(space_id, data_type, object_id)
        if not isinstance(status, dict) or (status.get("isDeleted") is True and not is_allow_deleted):
            raise RuntimeError(f"object not found: {object_id}")
        return status

    def list_status_items(self, space_id: str, data_type: str):
        prefix = f"{space_id}/{data_type}/"
        suffix = "/__status__.json"
        items = []
        for key in self.list_relative_keys(prefix):
            if not key.endswith(suffix):
                continue
            status = self.get_json(key)
            if isinstance(status, dict):
                status = dict(status)
                status["objectId"] = key[len(prefix) : -len(suffix)]
                items.append(status)
        return items

    def dispatch(self, path: str, body: dict, args: dict):
        route = path[4:] if path.startswith("/api/") else path
        if not route.startswith("/"):
            route = f"/{route}"
        if route == "/space/list":
            return self.space_list()
        if route == "/space/find-by-name":
            return self.space_find(str(args.get("name") or ""))
        if route == "/space/create":
            return self.space_create(body)
        if route == "/space/delete":
            return self.space_delete(body)
        if route == "/space/clear":
            return self.space_clear(body)
        if route.startswith("/space/metadata/"):
            return self.metadata_dispatch("space", route.rsplit("/", 1)[-1], body, args)
        if route.startswith("/object/metadata/"):
            return self.metadata_dispatch("object", route.rsplit("/", 1)[-1], body, args)
        if route == "/metadata/list":
            return {"items": self.metadata_items("global")}
        if route == "/metadata/upsert":
            return self.metadata_upsert("global", body)
        if route == "/object/list":
            return self.object_list(args)
        if route == "/object/get":
            return self.object_get(args)
        if route == "/object/create":
            return self.object_create(body)
        if route == "/object/update":
            return self.object_update(body)
        if route == "/object/delete":
            return self.object_delete(body)
        if route == "/object/restore":
            return self.object_restore(body)
        if route == "/object/version/list":
            return self.object_version_list(args)
        if route in ("/object/version/checkout", "/object/version/rollback"):
            return self.object_checkout(body)
        if route == "/object/version/delete-data":
            return self.object_version_delete_data(body)
        raise RuntimeError(f"S3 backend does not support endpoint: {path}")

    def space_list(self):
        spaces = self.spaces()
        items = []
        for space_id in spaces:
            name_item = self.get_json(self.metadata_key("space", "name", space_id=space_id), {})
            name = str((name_item or {}).get("valueText") or "").strip()
            items.append({"spaceId": space_id, "name": name, "displayName": f"{name} {space_id}" if name else f"ANONY {space_id}"})
        return {"spaces": spaces, "spaceItems": items, "spaceNum": len(spaces)}

    def space_find(self, name: str):
        normalized_name = name.strip().lower()
        if not normalized_name:
            raise RuntimeError("name is required")
        for item in self.space_list()["spaceItems"]:
            if str(item["name"]).lower() == normalized_name:
                return {"spaceId": item["spaceId"], "name": item["name"]}
        raise RuntimeError(f"space not found by name: {name}")

    def space_create(self, body: dict):
        spaces = self.spaces()
        space_id = str(body.get("spaceId") or "").strip().lower()
        if not space_id:
            space_id = uuid.uuid4().hex[:10]
        if not space_id or any(character not in "abcdefghijklmnopqrstuvwxyz0123456789" for character in space_id):
            raise RuntimeError("invalid spaceId, expected lowercase 0-9a-z")
        if space_id in spaces:
            raise RuntimeError(f"space already exists: {space_id}")
        spaces.append(space_id)
        self.write_spaces(spaces)
        return {"spaceId": space_id, "spaces": sorted(spaces), "spaceNum": len(spaces)}

    def space_delete(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        spaces = self.spaces()
        if space_id not in spaces:
            raise RuntimeError(f"space does not exist: {space_id}")
        self.delete_prefix(f"{space_id}/")
        spaces = [item for item in spaces if item != space_id]
        self.write_spaces(spaces)
        return {"spaceId": space_id, "spaces": spaces, "spaceNum": len(spaces)}

    def space_clear(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        if space_id not in self.spaces():
            raise RuntimeError(f"space does not exist: {space_id}")
        keys = self.list_relative_keys(f"{space_id}/")
        deleted_metadata_num = sum(1 for key in keys if key.startswith(f"{space_id}/__metadata__/items/"))
        deleted_counts = {}
        for data_type in ("text", "bytes", "json"):
            type_prefix = f"{space_id}/{data_type}/"
            deleted_counts[data_type] = sum(1 for key in keys if key.startswith(type_prefix) and key.endswith("/__status__.json"))
            deleted_counts[f"{data_type}History"] = sum(
                1 for key in keys if key.startswith(type_prefix) and "/versions/" in key and key.endswith("/info.json")
            )
            deleted_counts[f"{data_type}ObjectMetadata"] = sum(
                1 for key in keys if key.startswith(type_prefix) and "/__metadata__/items/" in key
            )
        for key in keys:
            self.delete(key)
        deleted_total_num = len(keys)
        return {
            "spaceId": space_id,
            "deletedMetadataNum": deleted_metadata_num,
            "deletedTextNum": deleted_counts["text"],
            "deletedBytesNum": deleted_counts["bytes"],
            "deletedJsonNum": deleted_counts["json"],
            "deletedTextHistoryNum": deleted_counts["textHistory"],
            "deletedBytesHistoryNum": deleted_counts["bytesHistory"],
            "deletedJsonHistoryNum": deleted_counts["jsonHistory"],
            "deletedTextObjectMetadataNum": deleted_counts["textObjectMetadata"],
            "deletedBytesObjectMetadataNum": deleted_counts["bytesObjectMetadata"],
            "deletedJsonObjectMetadataNum": deleted_counts["jsonObjectMetadata"],
            "deletedTotalNum": deleted_total_num,
        }

    def metadata_scope_values(self, scope: str, values: dict):
        space_id = str(values.get("spaceId") or "").strip().lower()
        data_type = str(values.get("dataType") or "").strip().lower()
        object_id = str(values.get("objectId") or "").strip()
        if scope == "space" and not space_id:
            raise RuntimeError("spaceId is required")
        if scope == "object":
            if data_type not in ("text", "bytes", "json"):
                raise RuntimeError("dataType should be one of text/bytes/json")
            if not object_id:
                raise RuntimeError("objectId is required")
            self.require_object(space_id, data_type, object_id, is_allow_deleted=True)
        return space_id, data_type, object_id

    def reserved_metadata(self, status: dict):
        return [
            {"tag": "versionIdHead", "rank": "", "valueType": 4, "valueText": None, "valueJson": None, "valueBytes": None, "valueInt": int(status["versionIdHead"]), "valueBoolean": None},
            {"tag": "isDeleted", "rank": "", "valueType": 5, "valueText": None, "valueJson": None, "valueBytes": None, "valueInt": None, "valueBoolean": bool(status.get("isDeleted"))},
            {"tag": "type", "rank": "", "valueType": 4, "valueText": None, "valueJson": None, "valueBytes": None, "valueInt": int(status.get("type", -1)), "valueBoolean": None},
            {"tag": "editType", "rank": "", "valueType": 4, "valueText": None, "valueJson": None, "valueBytes": None, "valueInt": int(status.get("editType", 0)), "valueBoolean": None},
        ]

    def metadata_dispatch(self, scope: str, operation: str, body: dict, args: dict):
        values = args if operation == "list" else body
        space_id, data_type, object_id = self.metadata_scope_values(scope, values)
        if operation == "list":
            items = self.metadata_items(scope, space_id, data_type, object_id)
            if scope == "object":
                status = self.require_object(space_id, data_type, object_id, is_allow_deleted=True)
                items = self.reserved_metadata(status) + items
            result = {"spaceId": space_id, "items": items}
            if scope == "object":
                result.update({"dataType": data_type, "objectId": object_id})
            return result
        tag = str(body.get("tag") or "").strip()
        if not tag:
            raise RuntimeError("tag is required")
        if scope == "object" and tag in ("versionIdHead", "isDeleted", "type", "editType"):
            raise RuntimeError(f"tag is reserved for system metadata: {tag}")
        items = self.metadata_items(scope, space_id, data_type, object_id)
        existing = next((item for item in items if item.get("tag") == tag), None)
        common = {"spaceId": space_id, "tag": tag}
        if scope == "object":
            common.update({"dataType": data_type, "objectId": object_id})
        if operation == "delete":
            self.delete(self.metadata_key(scope, tag, space_id, data_type, object_id))
            return common
        if operation == "ensure" and existing and body.get("isOverwrite") is False:
            return {**common, "isInserted": False, "isUpdated": False, "isNoop": True}
        if operation == "insert" and existing:
            raise RuntimeError(f"tag already exists: {tag}")
        rank = self.resolve_rank(items, tag, body.get("rank"))
        if operation == "insert":
            rank = self.positioned_rank(items, str(body.get("targetTag") or ""), str(body.get("position") or "tail"))
        if operation == "move":
            direction = str(body.get("direction") or "").lower()
            rank, is_noop = self.moved_rank(items, tag, direction)
            if is_noop:
                return {**common, "direction": direction, "isNoop": True}
            body = dict(existing or {})
        item = self.metadata_value(body, tag, rank)
        self.put_json(self.metadata_key(scope, tag, space_id, data_type, object_id), item)
        if operation == "ensure":
            return {**common, "rank": rank, "isInserted": existing is None, "isUpdated": existing is not None, "isNoop": False}
        if operation == "move":
            return {**common, "direction": direction}
        result = {**common, "rank": rank}
        if operation == "insert":
            result.update({"position": str(body.get("position") or "tail").lower(), "targetTag": str(body.get("targetTag") or "")})
        return result

    def metadata_upsert(self, scope: str, body: dict):
        tag = str(body.get("tag") or "").strip()
        if not tag:
            raise RuntimeError("tag is required")
        items = self.metadata_items(scope)
        rank = self.resolve_rank(items, tag, body.get("rank"))
        self.put_json(self.metadata_key(scope, tag), self.metadata_value(body, tag, rank))
        return {"tag": tag, "rank": rank}

    def positioned_rank(self, items: list[dict], target_tag: str, position: str):
        position = position.strip().lower()
        if position not in ("above", "below", "tail"):
            raise RuntimeError("position should be above/below/tail")
        if position == "tail" or not target_tag:
            return self.lexorank_between(items[-1].get("rank") if items else None, None)
        target_index = next((index for index, item in enumerate(items) if item.get("tag") == target_tag), -1)
        if target_index < 0:
            raise RuntimeError(f"targetTag not found: {target_tag}")
        if position == "above":
            return self.lexorank_between(items[target_index - 1].get("rank") if target_index else None, items[target_index].get("rank"))
        return self.lexorank_between(items[target_index].get("rank"), items[target_index + 1].get("rank") if target_index + 1 < len(items) else None)

    def moved_rank(self, items: list[dict], tag: str, direction: str):
        direction = direction.strip().lower()
        if direction not in ("up", "down"):
            raise RuntimeError("direction should be up/down")
        target_index = next((index for index, item in enumerate(items) if item.get("tag") == tag), -1)
        if target_index < 0:
            raise RuntimeError(f"tag not found: {tag}")
        if direction == "up":
            if target_index == 0:
                return "", True
            return self.lexorank_between(items[target_index - 2].get("rank") if target_index >= 2 else None, items[target_index - 1].get("rank")), False
        if target_index == len(items) - 1:
            return "", True
        return self.lexorank_between(items[target_index + 1].get("rank"), items[target_index + 2].get("rank") if target_index + 2 < len(items) else None), False

    def object_list(self, args: dict):
        space_id = str(args.get("spaceId") or "").strip().lower()
        data_type = str(args.get("dataType") or "").strip().lower()
        if space_id not in self.spaces():
            raise RuntimeError(f"space does not exist: {space_id}")
        if data_type not in ("text", "bytes", "json"):
            raise RuntimeError("dataType should be one of text/bytes/json")
        search_text = str(args.get("searchText") or "").strip().lower()
        type_text = str(args.get("type") or "").strip()
        page_index = max(1, int(args.get("pageIndex") or 1))
        page_size = max(1, min(int(args.get("pageSize") or 20), 200))
        items = [item for item in self.list_status_items(space_id, data_type) if item.get("isDeleted") is not True]
        if search_text:
            items = [item for item in items if search_text in str(item["objectId"]).lower()]
        if type_text:
            items = [item for item in items if int(item.get("type", -1)) == int(type_text)]
        items.sort(key=lambda item: (str(item.get("createdAt") or ""), str(item["objectId"])), reverse=True)
        total_count = len(items)
        start = (page_index - 1) * page_size
        response_items = []
        for status in items[start : start + page_size]:
            content = self.get_bytes(f"{self.object_root(space_id, data_type, status['objectId'])}/current/data") or b""
            response_items.append({
                "objectId": status["objectId"], "dataType": data_type, "type": int(status.get("type", -1)),
                "editType": int(status.get("editType", 0)), **self.decode_data(content, data_type),
                "createdAt": status.get("createdAt", ""), "updatedAt": status.get("updatedAt", ""),
                "versionId": str(status.get("versionIdHead") or ""),
            })
        return {"spaceId": space_id, "dataType": data_type, "pageIndex": page_index, "pageSize": page_size, "totalCount": total_count, "items": response_items}

    def object_get(self, args: dict):
        space_id = str(args.get("spaceId") or "").strip().lower()
        data_type = str(args.get("dataType") or "").strip().lower()
        object_id = str(args.get("objectId") or "").strip()
        version_id = str(args.get("versionId") or args.get("versionNum") or "").strip()
        status = self.require_object(space_id, data_type, object_id, is_allow_deleted=bool(version_id))
        if version_id:
            info, content = self.read_version(space_id, data_type, object_id, version_id)
            return {
                "spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionId": version_id,
                "type": int(status.get("type", -1)), "editType": int(status.get("editType", 0)),
                **self.decode_data(content, data_type), "isDataDeleted": False, "createdAt": info.get("createdAt", ""),
            }
        content = self.get_bytes(f"{self.object_root(space_id, data_type, object_id)}/current/data")
        if content is None:
            raise RuntimeError(f"object not found: {object_id}")
        return {
            "spaceId": space_id, "dataType": data_type, "objectId": object_id,
            "versionId": str(status.get("versionIdHead") or ""), "type": int(status.get("type", -1)),
            "editType": int(status.get("editType", 0)), **self.decode_data(content, data_type),
            "createdAt": status.get("createdAt", ""), "updatedAt": status.get("updatedAt", ""),
        }

    def object_create(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        if space_id not in self.spaces():
            raise RuntimeError(f"space does not exist: {space_id}")
        if data_type not in ("text", "bytes", "json"):
            raise RuntimeError("dataType should be one of text/bytes/json")
        object_id = self.create_id()
        version_id = self.create_id()
        content = self.encode_data(body, data_type)
        now = _utc_now_text()
        version_root = self.version_root(space_id, data_type, object_id, version_id)
        self.put_bytes(f"{version_root}/data", content, is_create_only=True)
        self.put_json(f"{version_root}/info.json", {"versionId": version_id, "versionIdPrev": "", "isDataDeleted": False, "createdAt": now}, is_create_only=True)
        self.write_current(space_id, data_type, object_id, version_id, content, now)
        status = {"versionIdHead": version_id, "isDeleted": False, "type": int(body.get("type") if body.get("type") is not None else -1), "editType": int(body.get("editType") if body.get("editType") is not None else 0), "createdAt": now, "updatedAt": now}
        self.write_status(space_id, data_type, object_id, status)
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionId": version_id, "type": status["type"], "editType": status["editType"]}

    def object_update(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        status = self.require_object(space_id, data_type, object_id)
        edit_type = int(status.get("editType", 0))
        is_update_version = body.get("isUpdateVersion")
        if is_update_version is None:
            is_update_version = edit_type == 0
        if edit_type == 0 and is_update_version is False:
            raise RuntimeError("isUpdateVersion=false is not allowed in UPDATE-ONLY mode")
        if edit_type == 2 and is_update_version is True:
            raise RuntimeError("isUpdateVersion=true is not allowed in EDIT-ONLY mode")
        if body.get("isDeletePrevVersionData") is True and not is_update_version:
            raise RuntimeError("isDeletePrevVersionData=true requires isUpdateVersion=true")
        content = self.encode_data(body, data_type)
        previous_version_id = str(status["versionIdHead"])
        version_id = self.create_id() if is_update_version else previous_version_id
        now = _utc_now_text()
        if is_update_version:
            version_root = self.version_root(space_id, data_type, object_id, version_id)
            self.put_bytes(f"{version_root}/data", content, is_create_only=True)
            self.put_json(f"{version_root}/info.json", {"versionId": version_id, "versionIdPrev": previous_version_id, "isDataDeleted": False, "createdAt": now}, is_create_only=True)
            if body.get("isDeletePrevVersionData") is True:
                previous_root = self.version_root(space_id, data_type, object_id, previous_version_id)
                previous_info = self.get_json(f"{previous_root}/info.json", {})
                self.delete(f"{previous_root}/data")
                previous_info["isDataDeleted"] = True
                self.put_json(f"{previous_root}/info.json", previous_info)
        else:
            version_root = self.version_root(space_id, data_type, object_id, version_id)
            self.put_bytes(f"{version_root}/data", content)
            version_info = self.get_json(f"{version_root}/info.json", {})
            version_info["isDataDeleted"] = False
            self.put_json(f"{version_root}/info.json", version_info)
        self.write_current(space_id, data_type, object_id, version_id, content, now)
        status["versionIdHead"] = version_id
        status["isDeleted"] = False
        status["updatedAt"] = now
        if body.get("type") is not None:
            status["type"] = int(body["type"])
        self.write_status(space_id, data_type, object_id, status)
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "type": body.get("type"), "editType": edit_type, "versionId": version_id, "isUpdateVersion": bool(is_update_version), "isDeletePrevVersionData": body.get("isDeletePrevVersionData") is True}

    def object_delete(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        raw_ids = body.get("objectIds") if isinstance(body.get("objectIds"), list) else []
        object_id = str(body.get("objectId") or "").strip()
        object_ids = sorted(set([str(item).strip() for item in raw_ids if str(item).strip()] + ([object_id] if object_id else [])))
        if not object_ids:
            raise RuntimeError("objectIds is required")
        for current_object_id in object_ids:
            status = self.require_object(space_id, data_type, current_object_id, is_allow_deleted=True)
            status["isDeleted"] = True
            status["updatedAt"] = _utc_now_text()
            self.write_status(space_id, data_type, current_object_id, status)
            self.delete(f"{self.object_root(space_id, data_type, current_object_id)}/current/data")
            self.delete(f"{self.object_root(space_id, data_type, current_object_id)}/current/info.json")
        return {"spaceId": space_id, "dataType": data_type, "objectIds": object_ids, "deletedNum": len(object_ids)}

    def object_restore(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        status = self.require_object(space_id, data_type, object_id, is_allow_deleted=True)
        version_id = str(status["versionIdHead"])
        info, content = self.read_version(space_id, data_type, object_id, version_id)
        self.write_current(space_id, data_type, object_id, version_id, content, str(info.get("createdAt") or ""))
        status["isDeleted"] = False
        status["updatedAt"] = _utc_now_text()
        self.write_status(space_id, data_type, object_id, status)
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionId": version_id}

    def object_version_list(self, args: dict):
        space_id = str(args.get("spaceId") or "").strip().lower()
        data_type = str(args.get("dataType") or "").strip().lower()
        object_id = str(args.get("objectId") or "").strip()
        status = self.require_object(space_id, data_type, object_id, is_allow_deleted=True)
        page_index = max(1, int(args.get("pageIndex") or 1))
        page_size = max(1, min(int(args.get("pageSize") or 100), 500))
        prefix = f"{self.object_root(space_id, data_type, object_id)}/versions/"
        info_keys = [key for key in self.list_relative_keys(prefix) if key.endswith("/info.json")]
        items = [self.get_json(key) for key in info_keys]
        items = [item for item in items if isinstance(item, dict)]
        items.sort(key=lambda item: int(item.get("versionId") or 0), reverse=True)
        total_count = len(items)
        start = (page_index - 1) * page_size
        response_items = [{
            "objectId": object_id, "versionId": str(item.get("versionId") or ""), "versionIdPrev": str(item.get("versionIdPrev") or ""),
            "isDataDeleted": bool(item.get("isDataDeleted")), "isHead": str(item.get("versionId")) == str(status.get("versionIdHead")),
            "createdAt": str(item.get("createdAt") or ""),
        } for item in items[start : start + page_size]]
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionIdHead": str(status.get("versionIdHead") or ""), "pageIndex": page_index, "pageSize": page_size, "totalCount": total_count, "items": response_items}

    def object_checkout(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        version_id = str(body.get("versionId") or "").strip()
        status = self.require_object(space_id, data_type, object_id, is_allow_deleted=True)
        info, content = self.read_version(space_id, data_type, object_id, version_id)
        self.write_current(space_id, data_type, object_id, version_id, content, str(info.get("createdAt") or ""))
        status["versionIdHead"] = version_id
        status["isDeleted"] = False
        status["updatedAt"] = _utc_now_text()
        self.write_status(space_id, data_type, object_id, status)
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionId": version_id}

    def object_version_delete_data(self, body: dict):
        space_id = str(body.get("spaceId") or "").strip().lower()
        data_type = str(body.get("dataType") or "").strip().lower()
        object_id = str(body.get("objectId") or "").strip()
        raw_ids = body.get("versionIds") if isinstance(body.get("versionIds"), list) else []
        if body.get("versionId") is not None:
            raw_ids.append(body.get("versionId"))
        version_ids = sorted(set(str(item).strip() for item in raw_ids if str(item).strip()))
        if not version_ids:
            raise RuntimeError("versionId is required")
        deleted_num = 0
        for version_id in version_ids:
            root = self.version_root(space_id, data_type, object_id, version_id)
            info = self.get_json(f"{root}/info.json")
            if not isinstance(info, dict):
                continue
            self.delete(f"{root}/data")
            info["isDataDeleted"] = True
            self.put_json(f"{root}/info.json", info)
            deleted_num += 1
        return {"spaceId": space_id, "dataType": data_type, "objectId": object_id, "versionIds": version_ids, "deletedNum": deleted_num}


def dispatch_s3_request(config: dict[str, Any], path: str, body: dict, args: dict, create_id, lexorank_between):
    backend = S3StorageBackend(config, create_id, lexorank_between)
    return backend.dispatch(path, body, args)
