

EDIT_TYPE_CODE = {
  "UPDATE-ONLY": 0, # allow version update, forbid editing in same version
  "UPDATE-AND-EDIT": 1, # allow version update, allow editing in same version
  "EDIT-ONLY": 2 # forbid version update, allow editing in same version
}

UPDATE_MODE_CODE = EDIT_TYPE_CODE