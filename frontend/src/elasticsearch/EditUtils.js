/**
 * EditUtils.js - Utility functions for handling Elasticsearch document editing
 * Handles JsonComp change events and applies them to document state
 */

/**
 * Handle pseudo entry operations (UI-only, no backend call)
 * Returns updated document and whether it was handled
 */
export function handlePseudoOperation(action, path, editingDoc) {
  const pathParts = path.split('.').filter(p => p !== '');
  
  if (action === 'addEntryAbove' || action === 'addEntryBelow') {
    const result = JSON.parse(JSON.stringify(editingDoc));
    const parentObj = pathParts.length === 1 ? result : pathParts.slice(0, -1).reduce((obj, key) => obj[key], result);
    const pseudoKey = `__pseudo__${Date.now()}`;
    parentObj[pseudoKey] = { 
      __pseudo__: true,
      position: action === 'addEntryAbove' ? 'above' : 'below', 
      referenceKey: pathParts[pathParts.length - 1]
    };
    return { handled: true, doc: result };
  }
  
  if (action === 'addEntry') {
    const result = JSON.parse(JSON.stringify(editingDoc));
    const targetObj = pathParts.length === 0 ? result : pathParts.reduce((obj, key) => obj[key], result);
    const pseudoKey = `__pseudo__${Date.now()}`;
    targetObj[pseudoKey] = { __pseudo__: true };
    return { handled: true, doc: result };
  }
  
  if (action === 'cancelCreate') {
    const result = JSON.parse(JSON.stringify(editingDoc));
    const parentObj = pathParts.length === 0 ? result : pathParts.slice(0, -1).reduce((obj, key) => obj[key], result);
    const pseudoKey = pathParts[pathParts.length - 1];
    delete parentObj[pseudoKey];
    return { handled: true, doc: result };
  }
  
  if (action === 'addItem' || action === 'addItemAbove' || action === 'addItemBelow') {
    const result = JSON.parse(JSON.stringify(editingDoc));
    const pathIsArray = path.includes('..');
    
    if (pathIsArray) {
      const parts = path.split('..');
      let current = result;
      
      if (parts[0]) {
        const objKeys = parts[0].split('.').filter(k => k !== '');
        for (const key of objKeys) {
          current = current[key];
        }
      }
      
      for (let i = 1; i < parts.length - 1; i++) {
        const index = parseInt(parts[i]);
        current = current[index];
      }
      
      const targetIndex = parseInt(parts[parts.length - 1]);
      if (action === 'addItemAbove') {
        current.splice(targetIndex, 0, { isPseudo: true });
      } else if (action === 'addItemBelow') {
        current.splice(targetIndex + 1, 0, { isPseudo: true });
      }
    } else {
      const targetArray = pathParts.length === 0 ? result : pathParts.reduce((obj, key) => obj[key], result);
      if (Array.isArray(targetArray)) {
        targetArray.push({ isPseudo: true });
      }
    }
    return { handled: true, doc: result };
  }
  
  return { handled: false };
}

/**
 * Create a real array item from pseudo
 */
export function createArrayItem(path, newValue, editingDoc) {
  const updatedDoc = JSON.parse(JSON.stringify(editingDoc));
  const parts = path.split('..');
  let current = updatedDoc;
  
  if (parts[0]) {
    const objKeys = parts[0].split('.').filter(k => k !== '');
    for (const key of objKeys) {
      current = current[key];
    }
  }
  
  for (let i = 1; i < parts.length - 1; i++) {
    const index = parseInt(parts[i]);
    current = current[index];
  }
  
  const targetIndex = parseInt(parts[parts.length - 1]);
  current[targetIndex] = newValue.value;
  
  if (current[targetIndex] && typeof current[targetIndex] === 'object' && !Array.isArray(current[targetIndex])) {
    delete current[targetIndex].isPseudo;
  }
  
  return updatedDoc;
}

/**
 * Create a real dict entry from pseudo
 */
export function createDictEntry(path, newValue, keyName, editingDoc) {
  const updatedDoc = JSON.parse(JSON.stringify(editingDoc));
  const pathParts = path.split('.').filter(p => p !== '');
  
  const parentObj = pathParts.length === 0 ? updatedDoc : pathParts.slice(0, -1).reduce((obj, key) => obj[key], updatedDoc);
  const pseudoKey = pathParts[pathParts.length - 1];
  const pseudoData = parentObj[pseudoKey];
  
  if (pseudoData && pseudoData.position && pseudoData.referenceKey) {
    const newParentObj = {};
    for (const key of Object.keys(parentObj)) {
      if (key === pseudoKey) continue;
      
      if (key === pseudoData.referenceKey) {
        if (pseudoData.position === 'above') {
          newParentObj[keyName] = newValue.value;
          newParentObj[key] = parentObj[key];
        } else {
          newParentObj[key] = parentObj[key];
          newParentObj[keyName] = newValue.value;
        }
      } else {
        newParentObj[key] = parentObj[key];
      }
    }
    Object.keys(parentObj).forEach(k => delete parentObj[k]);
    Object.assign(parentObj, newParentObj);
  } else {
    delete parentObj[pseudoKey];
    parentObj[keyName] = newValue.value;
  }
  
  return updatedDoc;
}

/**
 * Navigate to a path in an object
 */
function navigateToPath(obj, parts, createMissing = false) {
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (createMissing && !current[part]) {
      const nextPart = parts[i + 1];
      current[part] = /^\d+$/.test(nextPart) ? [] : {};
    }
    current = current[part];
    if (!current) return null;
  }
  return current;
}

/**
 * Apply a value change to document
 */
export function applyValueChange(action, path, newValue, editingDoc) {
  const updatedDoc = JSON.parse(JSON.stringify(editingDoc));
  const pathParts = path.split('.').filter(p => p !== '');
  
  if (action === 'setValue' || action === 'updateValue') {
    const parent = navigateToPath(updatedDoc, pathParts, true);
    if (parent) {
      const lastKey = pathParts[pathParts.length - 1];
      parent[lastKey] = newValue.value;
    }
  } else if (action === 'deleteField' || action === 'deleteEntry') {
    const parent = navigateToPath(updatedDoc, pathParts);
    if (parent) {
      const lastKey = pathParts[pathParts.length - 1];
      delete parent[lastKey];
    }
  } else if (action === 'addArrayItem') {
    const parent = navigateToPath(updatedDoc, pathParts);
    if (parent && Array.isArray(parent[pathParts[pathParts.length - 1]])) {
      parent[pathParts[pathParts.length - 1]].push(newValue.value);
    }
  } else if (action === 'removeArrayItem') {
    const parent = navigateToPath(updatedDoc, pathParts);
    if (parent) {
      const lastKey = pathParts[pathParts.length - 1];
      if (Array.isArray(parent)) {
        parent.splice(parseInt(lastKey), 1);
      }
    }
  }
  
  return updatedDoc;
}

/**
 * Prepare document for sending to backend (remove ES metadata)
 */
export function prepareDocForBackend(doc) {
  const docToSend = { ...doc };
  delete docToSend._id;
  delete docToSend._score;
  return docToSend;
}

/**
 * Check if a field operation should be blocked (e.g., _id field)
 */
export function isFieldBlocked(path, keyName, action) {
  const isIdField = path === '_id' || path.startsWith('_id.');
  const isIdKeyOperation = keyName === '_id';
  
  if (isIdField || isIdKeyOperation) {
    const blockedActions = ['updateValue', 'deleteEntry', 'createEntry'];
    return blockedActions.includes(action) || !action;
  }
  
  return false;
}

