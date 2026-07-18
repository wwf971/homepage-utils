from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import yaml


class UniqueKeyLoader(yaml.SafeLoader):
    pass


def _construct_mapping_without_duplicate_keys(loader: UniqueKeyLoader, node, deep=False):
    mapping = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in mapping:
            line_number = key_node.start_mark.line + 1
            column_number = key_node.start_mark.column + 1
            raise ValueError(f"duplicate config key '{key}' at {loader.name}:{line_number}:{column_number}")
        value = loader.construct_object(value_node, deep=deep)
        mapping[key] = value
    return mapping


UniqueKeyLoader.add_constructor(
    yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG,
    _construct_mapping_without_duplicate_keys,
)


def _deep_merge(value_base: Any, value_override: Any):
    if isinstance(value_base, dict) and isinstance(value_override, dict):
        value_merged = dict(value_base)
        for key, value in value_override.items():
            value_merged[key] = _deep_merge(value_merged.get(key), value)
        return value_merged
    return value_override if value_override is not None else value_base


def _ordered_dict_keys(*key_groups: dict[str, Any]):
    ordered_keys: list[str] = []
    for key_group in key_groups:
        if not isinstance(key_group, dict):
            continue
        for key in key_group.keys():
            key_text = str(key)
            if key_text not in ordered_keys:
                ordered_keys.append(key_text)
    return ordered_keys


def _merge_config_dbs(config_default: dict[str, Any], config_local: dict[str, Any]):
    base_items = config_default.get("config_dbs") if isinstance(config_default.get("config_dbs"), dict) else {}
    local_items = config_local.get("config_dbs") if isinstance(config_local.get("config_dbs"), dict) else {}
    preset_order = config_local.get("database_preset_order")
    if not isinstance(preset_order, list) or len(preset_order) <= 0:
        preset_order = config_default.get("database_preset_order")
    merged_items: dict[str, Any] = {}
    if isinstance(preset_order, list) and len(preset_order) > 0:
        ordered_keys = [str(key) for key in preset_order]
    else:
        ordered_keys = _ordered_dict_keys(local_items, base_items)
    for key in _ordered_dict_keys(local_items, base_items):
        if key not in ordered_keys:
            ordered_keys.append(key)
    for key in ordered_keys:
        base_item = base_items.get(key) if isinstance(base_items, dict) else None
        local_item = local_items.get(key) if isinstance(local_items, dict) else None
        if isinstance(base_item, dict) and isinstance(local_item, dict):
            merged_items[key] = _deep_merge(base_item, local_item)
        elif isinstance(local_item, dict):
            merged_items[key] = local_item
        elif isinstance(base_item, dict):
            merged_items[key] = base_item
    return merged_items


def load_yaml_config_file(file_path: Path):
    if not file_path.is_file():
        return {}
    with file_path.open("r", encoding="utf-8") as file:
        loader = UniqueKeyLoader(file)
        loader.name = str(file_path)
        try:
            data = loader.get_single_data() or {}
        finally:
            loader.dispose()
    return data if isinstance(data, dict) else {}


def load_project_config(dir_base: Path):
    config_dir = dir_base / "config"
    config_default = load_yaml_config_file(config_dir / "config.yaml")
    config_local = load_yaml_config_file(config_dir / "config.0.yaml")
    config_merged = _deep_merge(config_default, config_local)
    config_merged["config_dbs"] = _merge_config_dbs(config_default, config_local)
    if not isinstance(config_merged.get("config_dbs"), dict):
        config_merged["config_dbs"] = {}
    return config_merged


def build_database_preset_list_from_config(config: dict[str, Any]):
    config_dbs = config.get("config_dbs") or {}
    preset_list = []
    if not isinstance(config_dbs, dict):
        return preset_list
    for index, (preset_key, raw_item) in enumerate(config_dbs.items()):
        if not isinstance(raw_item, dict):
            continue
        preset_list.append(
            {
                "KEY": str(raw_item.get("key") or preset_key).strip() or f"db_{index + 1}",
                "NAME": str(raw_item.get("label") or raw_item.get("name") or preset_key).strip() or preset_key,
                "IP": str(raw_item.get("host") or raw_item.get("ip") or "127.0.0.1").strip(),
                "PORT": raw_item.get("port") if raw_item.get("port") is not None else 5432,
                "DATABASE_NAME": str(raw_item.get("database_name") or raw_item.get("databaseName") or "postgres").strip(),
                "USERNAME": str(raw_item.get("username") or "postgres").strip(),
                "PASSWORD": str(raw_item.get("password") or "postgres"),
            }
        )
    return preset_list


def resolve_launch_config(dir_base: Path):
    config = load_project_config(dir_base)
    preset_list = build_database_preset_list_from_config(config)
    database_index_raw = config.get("database_index")
    try:
        database_index = int(database_index_raw)
    except Exception:
        database_index = 0
    if database_index < 0 or database_index >= len(preset_list):
        database_index = 0
    current_preset = preset_list[database_index] if preset_list else {}
    return {
        "DIR_BASE": str(config.get("dir_base") or dir_base),
        "TEST_CONDA_ENV": str(config.get("test_conda_env") or ""),
        "BACKEND_PORT": str(config.get("backend_port") or 5107),
        "DB_HOST": str(current_preset.get("IP") or "127.0.0.1"),
        "DB_PORT": str(current_preset.get("PORT") or 5432),
        "DB_NAME": str(current_preset.get("DATABASE_NAME") or "postgres"),
        "DB_USER": str(current_preset.get("USERNAME") or "postgres"),
        "DB_PASSWORD": str(current_preset.get("PASSWORD") or "postgres"),
        "DATABASE_LIST_JSON": json.dumps(preset_list, ensure_ascii=False),
        "DATABASE_INDEX": str(database_index),
    }
