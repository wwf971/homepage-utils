begin;

insert into metadata(tag, rank, valueType, valueJson, updatedAt)
values ('spacesIdList', 'hzzzzzzzzz', 2, '["demoans7ft"]'::jsonb, now())
on conflict (tag) do update set
  rank = excluded.rank,
  valueType = excluded.valueType,
  valueJson = excluded.valueJson,
  updatedAt = now();

select ensure_space_tables('demoans7ft');

insert into space_demoans7ft_metadata(tag, rank, valueType, valueText, updatedAt)
values
  ('name', 'hzzzzzzzzz', 1, 'Demo Space', now()),
  ('owner', 'qzzzzzzzzz', 1, 'team-storage', now()),
  ('description', 'vzzzzzzzzz', 1, 'example metadata row', now())
on conflict (tag) do update set
  rank = excluded.rank,
  valueType = excluded.valueType,
  valueText = excluded.valueText,
  updatedAt = now();

insert into change_log(changeLogId, commentText, createdAt)
values
  (1001, 'seed: text object version 1', now()),
  (1002, 'seed: text object version 2', now()),
  (1003, 'seed: text object version 3', now()),
  (1004, 'seed: text object version 4', now()),
  (1005, 'seed: branch from version 2 to version 5', now()),
  (1010, 'seed: deleted object sample', now())
on conflict (changeLogId) do update set
  commentText = excluded.commentText,
  createdAt = excluded.createdAt;

-- objectId 281474976710801 has tree-like history:
-- 281474976710901 -> 281474976710902 -> 281474976710903 -> 281474976710904
-- and checkout to 281474976710902 then branch to 281474976710905 (head)
insert into space_demoans7ft_object_text_history(
  objectId, versionId, versionIdPrev, valueText, isDataDeleted, changeLogId, createdAt
)
values
  (281474976710801, 281474976710901, null,  'v1', false, 1001, now()),
  (281474976710801, 281474976710902, 281474976710901, 'v2', false, 1002, now()),
  (281474976710801, 281474976710903, 281474976710902, null, true, 1003, now()),
  (281474976710801, 281474976710904, 281474976710903, 'v4', false, 1004, now()),
  (281474976710801, 281474976710905, 281474976710902, 'v5-branch-head', false, 1005, now())
on conflict (objectId, versionId) do update set
  versionIdPrev = excluded.versionIdPrev,
  valueText = excluded.valueText,
  isDataDeleted = excluded.isDataDeleted,
  changeLogId = excluded.changeLogId,
  createdAt = excluded.createdAt;

insert into space_demoans7ft_object_text_status(
  objectId, versionIdHead, type, isDeleted, editType, changeLogId, updatedAt
)
values (281474976710801, 281474976710905, 100, false, 0, 1005, now())
on conflict (objectId) do update set
  versionIdHead = excluded.versionIdHead,
  isDeleted = excluded.isDeleted,
  editType = excluded.editType,
  changeLogId = excluded.changeLogId,
  updatedAt = excluded.updatedAt;

insert into space_demoans7ft_object_text(
  objectId, versionId, valueText, changeLogId, createdAt, updatedAt
)
values (281474976710801, 281474976710905, 'v5-branch-head', 1005, now(), now())
on conflict (objectId) do update set
  versionId = excluded.versionId,
  valueText = excluded.valueText,
  changeLogId = excluded.changeLogId,
  updatedAt = excluded.updatedAt;

-- deleted object sample: status row exists, current table row does not
insert into space_demoans7ft_object_text_history(
  objectId, versionId, versionIdPrev, valueText, isDataDeleted, changeLogId, createdAt
)
values (281474976710802, 281474976710920, null, 'to-be-deleted', false, 1010, now())
on conflict (objectId, versionId) do update set
  versionIdPrev = excluded.versionIdPrev,
  valueText = excluded.valueText,
  isDataDeleted = excluded.isDataDeleted,
  changeLogId = excluded.changeLogId,
  createdAt = excluded.createdAt;

insert into space_demoans7ft_object_text_status(
  objectId, versionIdHead, type, isDeleted, editType, changeLogId, updatedAt
)
values (281474976710802, 281474976710920, 101, true, 0, 1010, now())
on conflict (objectId) do update set
  versionIdHead = excluded.versionIdHead,
  isDeleted = excluded.isDeleted,
  editType = excluded.editType,
  changeLogId = excluded.changeLogId,
  updatedAt = excluded.updatedAt;

commit;
