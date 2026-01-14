/**
 * mongoEdit.js - MongoDB document edit operations and state management
 * 
 * Contains:
 * - useMongoDocEditor hook for managing document edits with Jotai cache
 * - Extracted handler functions for complex operations
 * 
 * Basic CRUD functions are in mongoStore.js
 */

import React from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { mongoDocsAtom } from '../remote/dataStore';
import {
  extractDocId,
  parsePathToSegments,
  parsePathToSegments as parse,
  navigateToPath,
  navigateToParentArray,
  isPathToArrayItem
} from '../../../../2025/react-comp-misc/src/layout/json/pathUtils';
import {
  updateDocField,
  replaceDocFields,
  deleteDocField,
  createDocField,
  addArrayItem,
  removeArrayItem
} from './mongoStore';
import { getBackendServerUrl } from '../remote/dataStore';

/**
 * Handle key rename operation
 * Renames a key in a MongoDB document, reconstructing the parent object with the new key name
 */
async function handleKeyRename(database, collection, docId, path, newData, changeData, docsRef, setDocs, setIsUpdating) {
  const pathParts = path.split('.').filter(p => p !== '');
  const oldKey = pathParts[pathParts.length - 1];
  const newKey = newData.value;
  
  // Get parent path
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';
  
  // Get current value at oldKey from the document (use ref for latest value)
  const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
  if (!currentDoc) {
    setIsUpdating(false);
    return { code: -1, message: 'Document not found in cache' };
  }
  
  // Navigate to parent object to get the old value
  let parentObj = currentDoc;
  if (parentPath) {
    const parentParts = parentPath.split('.').filter(p => p !== '');
    for (const part of parentParts) {
      parentObj = parentObj[part];
    }
  }
  
  const oldValue = parentObj[oldKey];
  
  // Create new parent object with renamed key
  const newParentObj = {};
  for (const k of Object.keys(parentObj)) {
    if (k === oldKey) {
      newParentObj[newKey] = oldValue;
    } else {
      newParentObj[k] = parentObj[k];
    }
  }
  
  // Update the entire parent object in MongoDB
  let result;
  if (parentPath === '') {
    // Root level - need special handling to preserve _id
    const { _id, ...fieldsToUpdate } = newParentObj;
    
    result = await replaceDocFields(database, collection, docId, fieldsToUpdate);
  } else {
    // Nested path - replace parent object
    result = await updateDocField(database, collection, docId, parentPath, newParentObj);
  }
  
  // If successful, update local state with structural sharing
  if (result.code === 0) {
    setDocs(prevDocs => {
      return prevDocs.map(d => {
        const dId = extractDocId(d);
        if (dId !== docId) return d;
        
        const pathParts = path.split('.').filter(p => p !== '');
        
        // Recursive function to rename key at path
        const renameKeyAtPath = (obj, parts, partIndex) => {
          if (partIndex >= parts.length - 1) {
            // At the key to rename
            const oldKey = parts[parts.length - 1];
            const newObj = {};
            for (const k of Object.keys(obj)) {
              if (k === oldKey) {
                newObj[newKey] = obj[k];
              } else {
                newObj[k] = obj[k];
              }
            }
            return newObj;
          }
          
          const key = parts[partIndex];
          const isArray = Array.isArray(obj);
          
          if (isArray) {
            const newArr = [...obj];
            newArr[parseInt(key)] = renameKeyAtPath(obj[parseInt(key)], parts, partIndex + 1);
            return newArr;
          } else {
            return { ...obj, [key]: renameKeyAtPath(obj[key], parts, partIndex + 1) };
          }
        };
        
        if (pathParts.length === 1) {
          // Root level rename
          const newDoc = {};
          for (const k of Object.keys(d)) {
            if (k === oldKey) {
              newDoc[newKey] = d[k];
            } else {
              newDoc[k] = d[k];
            }
          }
          return newDoc;
        } else {
          return renameKeyAtPath(d, pathParts, 0);
        }
      });
    });
    
    setIsUpdating(false);
    return { code: 0, message: 'Success' };
  }
  
  setIsUpdating(false);
  return { code: -1, message: result.message || 'Failed to rename key' };
}

/**
 * Handle add pseudo item to array
 * Adds a pseudo item to an array for UI state before actual creation
 */
function handleAddPseudoItem(doc, docId, path, _action) {
  const dId = extractDocId(doc);
  if (dId !== docId) return doc;
  
  const pseudoItem = { isPseudo: true };
  const clone = JSON.parse(JSON.stringify(doc));
  
  // Parse path into segments
  const segments = parsePathToSegments(path);
  
  if (segments.length === 0) {
    // Root is an array - add to it directly
    if (Array.isArray(clone)) {
      if (_action === 'addItem') {
        clone.push(pseudoItem);
      }
    }
    return clone;
  }
  
  // Navigate to the target array
  let current = clone;
  const lastSegment = segments[segments.length - 1];
  
  // Navigate to parent of target array (all segments except last)
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    current = seg.type === 'arr' ? current[seg.index] : current[seg.key];
    if (!current) {
      console.error('[addItem] Navigation failed at segment:', seg, 'path:', path);
      return doc;
    }
  }
  
  // Handle based on whether we're adding to an array or at an array index
  if (lastSegment.type === 'arr') {
    // Path points to an array index - insert pseudo item relative to it
    if (!Array.isArray(current)) {
      console.error('[addItem] Expected array but got:', typeof current, 'path:', path);
      return doc;
    }
    
    const targetIndex = lastSegment.index;
    if (_action === 'addItemAbove') {
      current.splice(targetIndex, 0, pseudoItem);
    } else if (_action === 'addItemBelow') {
      current.splice(targetIndex + 1, 0, pseudoItem);
    } else if (_action === 'addItem') {
      // Shouldn't happen with array index path, but handle it
      current.push(pseudoItem);
    }
  } else {
    // Path points to an array key - add to that array
    const arrayKey = lastSegment.key;
    if (Array.isArray(current[arrayKey])) {
      current[arrayKey].push(pseudoItem);
    } else {
      console.error('[addItem] Expected array at key:', arrayKey, 'but got:', typeof current[arrayKey]);
      return doc;
    }
  }
  
  return clone;
}

/**
 * Handle merge dict with JSON operation
 * Merges new JSON entries into a dictionary below a specified key
 */
async function handleMergeDictWithJson(database, collection, docId, path, newData, changeData, docsRef, setIsUpdating) {
  const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
  if (!currentDoc) {
    setIsUpdating(false);
    return { code: -1, message: 'Document not found in cache' };
  }

  const currentKey = changeData._currentKey;
  const segments = parse(path);
  const parentObj = navigateToPath(currentDoc, segments);
  
  console.log('[mergeDictWithJson] path:', path, 'segments:', segments);
  console.log('[mergeDictWithJson] currentKey:', currentKey);
  console.log('[mergeDictWithJson] parentObj keys:', Object.keys(parentObj));
  
  if (!parentObj || typeof parentObj !== 'object' || Array.isArray(parentObj)) {
    setIsUpdating(false);
    return { code: -1, message: 'Parent is not an object' };
  }
  
  // Get all existing keys (excluding pseudo keys)
  const existingKeys = Object.keys(parentObj).filter(k => !k.startsWith('__pseudo__'));
  const currentIndex = existingKeys.indexOf(currentKey);
  
  console.log('[mergeDictWithJson] existingKeys:', existingKeys);
  console.log('[mergeDictWithJson] currentIndex:', currentIndex);
  
  if (currentIndex === -1) {
    setIsUpdating(false);
    return { code: -1, message: 'Current key not found in parent object' };
  }
  
  // Get keys from the new object to merge
  const newKeys = Object.keys(newData.value);
  
  console.log('[mergeDictWithJson] newKeys to merge:', newKeys);
  
  // Check if any of the new keys are numeric-looking (would be auto-sorted by JavaScript)
  const hasNumericKeys = newKeys.some(k => /^\d+$/.test(k));
  if (hasNumericKeys) {
    console.warn('[mergeDictWithJson] Warning: Numeric-looking keys detected. JavaScript will automatically sort them to the beginning of the object.');
  }
  
  // Build array of all keys in desired order
  const keysInOrder = [
    ...existingKeys.slice(0, currentIndex + 1),  // Keys up to and including current
    ...newKeys,                                    // New keys to insert
    ...existingKeys.slice(currentIndex + 1)       // Remaining keys
  ];
  
  console.log('[mergeDictWithJson] Desired key order:', keysInOrder);
  
  // Build new object by iterating in desired order
  // Note: JavaScript will still reorder numeric-looking keys to the front
  const newObj = {};
  for (const key of keysInOrder) {
    if (key in parentObj) {
      newObj[key] = parentObj[key];
    } else if (key in newData.value) {
      newObj[key] = newData.value[key];
    }
  }
  
  console.log('[mergeDictWithJson] newObj keys (actual order after JS reordering):', Object.keys(newObj));
  
  // Special handling for root-level merge (empty path)
  let result;
  if (path === '') {
    // For root level, use replaceFields to avoid empty path error
    const { _id, ...fieldsToUpdate } = newObj;
    
    console.log('[mergeDictWithJson] Root level merge - fieldsToUpdate keys:', Object.keys(fieldsToUpdate));
    
    result = await replaceDocFields(database, collection, docId, fieldsToUpdate);
    
    console.log('[mergeDictWithJson] Backend result:', result);
    if (result.data) {
      console.log('[mergeDictWithJson] Backend returned doc keys:', Object.keys(result.data));
    }
    
    // For root-level merge, use the document returned from server for structural sharing
    if (result.code === 0 && result.data) {
      changeData.new = { type: 'object', value: result.data };
    }
  } else {
    // For nested paths, update the parent object
    console.log('[mergeDictWithJson] Nested merge at path:', path, 'newObj keys:', Object.keys(newObj));
    
    result = await updateDocField(database, collection, docId, path, newObj);
    
    console.log('[mergeDictWithJson] Backend result:', result);
    
    // For nested merge, use the constructed newObj for structural sharing
    if (result.code === 0) {
      changeData.new = { type: 'object', value: newObj };
    }
  }
  
  // Add warning if numeric keys were detected
  if (result.code === 0 && hasNumericKeys) {
    result.warning = 'Numeric keys were reordered by JavaScript';
  }
  
  return result;
}
export function useMongoDocEditor(database, collection, document) {
  const setDocs = useSetAtom(mongoDocsAtom);
  const docs = useAtomValue(mongoDocsAtom);
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  // Use a ref to always have the latest docs value
  // This prevents stale reads when multiple operations happen in quick succession
  const docsRef = React.useRef(docs);
  React.useEffect(() => {
    docsRef.current = docs;
  }, [docs]);
  
  // Extract document ID once and memoize it
  const docId = React.useMemo(() => extractDocId(document), [document._id]);

  const handleChange = React.useCallback(async (path, changeData) => {
    const { old, new: newData, _action, _key } = changeData;
    console.log('Document change:', { path, _action, changeData });

    if (!docId) {
      console.error('Document _id not found or invalid:', document._id);
      return { code: -1, message: 'Document _id not found' };
    }
    
    console.log('Using document ID:', docId);

    // Prevent modification of _id field
    const isIdField = path === '_id' || path.startsWith('_id.');
    const isIdKeyOperation = _key === '_id';
    
    if (isIdField || isIdKeyOperation) {
      // Block operations that would modify _id
      const blockedActions = [
        'updateValue',        // Edit _id value
        'deleteEntry',        // Delete _id field
        'createEntry',        // Create new _id field
        'moveEntryUp',        // Move _id
        'moveEntryDown',      // Move _id
        'moveEntryToTop',     // Move _id
        'moveEntryToBottom',  // Move _id
        'convertParentToText' // Convert if _id is involved
      ];
      
      if (blockedActions.includes(_action) || !_action) {
        console.warn('Cannot modify _id field');
        return { code: -1, message: '_id field cannot be modified' };
      }
    }

    // Handle pseudo operations that don't need backend calls
    // These should NOT set isUpdating to avoid the spinner
    switch (_action) {
      case 'addItem':
      case 'addItemAbove':
      case 'addItemBelow':
        // Add pseudo item to array (UI only, no backend call)
        setDocs(prevDocs => prevDocs.map(d => handleAddPseudoItem(d, docId, path, _action)));
        return { code: 0, message: 'Success' };

      case 'addEntry':
      case 'addEntryAbove':
      case 'addEntryBelow':
        // Add pseudo entry to object (UI only, no backend call)
        setDocs(prevDocs => {
          return prevDocs.map(d => {
            const dId = extractDocId(d);
            if (dId !== docId) return d;
            
            const pathParts = path.split('.').filter(p => p !== '');
            const clone = JSON.parse(JSON.stringify(d));
            
            let current = clone;
            for (let i = 0; i < pathParts.length - 1; i++) {
              current = current[pathParts[i]];
            }
            
            const pseudoKey = `__pseudo__${Date.now()}`;
            
            if (_action === 'addEntry') {
              current[pseudoKey] = { __pseudo__: true };
            } else {
              const referenceKey = pathParts[pathParts.length - 1];
              current[pseudoKey] = {
                __pseudo__: true,
                position: _action === 'addEntryAbove' ? 'above' : 'below',
                referenceKey
              };
            }
            
            return clone;
          });
        });
        return { code: 0, message: 'Success' };

      case 'cancelCreate':
        // Remove pseudo element (UI only, no backend call)
        setDocs(prevDocs => {
          return prevDocs.map(d => {
            const dId = extractDocId(d);
            if (dId !== docId) return d;
            
            const segments = parsePathToSegments(path);
            if (segments.length === 0) return d;
            
            const clone = JSON.parse(JSON.stringify(d));
            let current = clone;
            
            // Navigate to parent (all segments except the last)
            for (let i = 0; i < segments.length - 1; i++) {
              const seg = segments[i];
              current = seg.type === 'arr' ? current[seg.index] : current[seg.key];
            }
            
            // Delete the last segment
            const lastSeg = segments[segments.length - 1];
            if (lastSeg.type === 'arr') {
              current.splice(lastSeg.index, 1);
            } else {
              delete current[lastSeg.key];
            }
            
            return clone;
          });
        });
        return { code: 0, message: 'Success' };
    }

    // For operations that need backend calls, set isUpdating
    setIsUpdating(true);

    try {
      let result;

      // Handle key rename first (special case)
      if (changeData._keyRename) {
        return await handleKeyRename(database, collection, docId, path, newData, changeData, docsRef, setDocs, setIsUpdating);
      }

      switch (_action) {
        case 'createEntry': {
          // Extract optional ordering parameters from changeData or infer from __pseudo__
          let insertIndex = changeData._insertIndex;
          let respectIndex = changeData._respectIndex || false;
          
          const parentPath = path.lastIndexOf('.') > 0 
            ? path.substring(0, path.lastIndexOf('.'))
            : '';
          
          // Get the current document
          let currentDoc;
          setDocs(prevDocs => {
            const doc = prevDocs.find(d => extractDocId(d) === docId);
            if (doc) {
              currentDoc = doc;
              
              // If ordering params not provided, try to infer from __pseudo__ array
              if (insertIndex === undefined || !respectIndex) {
                let parent = doc;
                if (parentPath) {
                  const pathParts = parentPath.split('.').filter(p => p !== '');
                  for (const part of pathParts) {
                    parent = parent[part];
                  }
                }
                
                // Check if the path points to a pseudo key with position info
                const pathSegments = path.split('.').filter(p => p !== '');
                const pseudoKey = pathSegments[pathSegments.length - 1];
                
                if (pseudoKey && parent[pseudoKey] && typeof parent[pseudoKey] === 'object' &&
                    parent[pseudoKey].__pseudo__ === true) {
                  const pseudoData = parent[pseudoKey];
                  if (pseudoData.position && pseudoData.referenceKey) {
                    // Calculate insert index based on position
                    const keys = Object.keys(parent).filter(k => !k.startsWith('__pseudo__'));
                    const refIndex = keys.indexOf(pseudoData.referenceKey);
                    
                    if (refIndex !== -1) {
                      insertIndex = pseudoData.position === 'above' ? refIndex : refIndex + 1;
                      respectIndex = true; // We should respect the position
                    }
                  }
                }
              }
            }
            return prevDocs;
          });
          
          result = await createDocField(
            database,
            collection,
            docId,
            parentPath,
            _key,
            newData.value,
            currentDoc,
            insertIndex !== undefined ? insertIndex : -1,
            respectIndex
          );
          break;
        }

        case 'deleteEntry':
          // Delete a field
          result = await deleteDocField(
            database,
            collection,
            docId,
            path
          );
          break;

        case 'createItem':
          // Create array item (convert pseudo to real)
          result = await updateDocField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
          break;

        case 'deleteArrayItem':
          // Delete array item
          result = await removeArrayItem(
            database,
            collection,
            docId,
            path
          );
          break;

        case 'clearParentDict':
          // Clear all entries in the parent dict (make it {})
          const parentPathDict = changeData._parentPath;
          if (!parentPathDict || parentPathDict === '') {
            // Clearing root - not allowed for MongoDB documents
            return { code: -1, message: 'Cannot clear root document' };
          }
          result = await updateDocField(
            database,
            collection,
            docId,
            parentPathDict,
            {}
          );
          break;

        case 'deleteParentDict':
          // Delete the parent dict
          const parentPathDeleteDict = changeData._parentPath;
          if (!parentPathDeleteDict || parentPathDeleteDict === '') {
            // Cannot delete root document
            return { code: -1, message: 'Cannot delete root document' };
          }
          // Check if this is an array item by checking if last separator is ..
          if (isPathToArrayItem(parentPathDeleteDict)) {
            // Use removeArrayItem to properly remove from array
            result = await removeArrayItem(
              database,
              collection,
              docId,
              parentPathDeleteDict
            );
          } else {
            // Use deleteDocField for object properties
            result = await deleteDocField(
              database,
              collection,
              docId,
              parentPathDeleteDict
            );
          }
          break;

        case 'clearParentArray':
          // Clear all items in the parent array (make it [])
          const parentPathArray = changeData._parentPath;
          if (!parentPathArray || parentPathArray === '') {
            // Clearing root - not allowed for MongoDB documents
            return { code: -1, message: 'Cannot clear root document' };
          }
          result = await updateDocField(
            database,
            collection,
            docId,
            parentPathArray,
            []
          );
          break;

        case 'deleteParentArray':
          // Delete the parent array
          const parentPathDeleteArray = changeData._parentPath;
          if (!parentPathDeleteArray || parentPathDeleteArray === '') {
            // Cannot delete root document
            return { code: -1, message: 'Cannot delete root document' };
          }
          // Check if this is an array item by checking if last separator is ..
          if (isPathToArrayItem(parentPathDeleteArray)) {
            // Use removeArrayItem to properly remove from array
            result = await removeArrayItem(
              database,
              collection,
              docId,
              parentPathDeleteArray
            );
          } else {
            // Use deleteDocField for object properties
            result = await deleteDocField(
              database,
              collection,
              docId,
              parentPathDeleteArray
            );
          }
          break;

        case 'moveEntryUp':
        case 'moveEntryDown': {
          // Move dict entry up or down
          // Get current document to reconstruct parent object (use ref for latest value)
          const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
          if (!currentDoc) {
            return { code: -1, message: 'Document not found in cache' };
          }

          // Parse path to find parent and current key
          const pathParts = path.split('.').flatMap(part => 
            part.startsWith('.') ? [part.slice(1)] : [part]
          ).filter(part => part !== '');
          
          console.log('[moveEntry] pathParts:', pathParts);
          
          // Navigate to parent object
          let parentObj = currentDoc;
          for (let i = 0; i < pathParts.length - 1; i++) {
            parentObj = parentObj[pathParts[i]];
          }
          
          const currentKey = pathParts[pathParts.length - 1];
          const keys = Object.keys(parentObj).filter(k => !k.startsWith('__pseudo__'));
          const currentIndex = keys.indexOf(currentKey);
          const newIndex = _action === 'moveEntryUp' ? currentIndex - 1 : currentIndex + 1;
          
          console.log('[moveEntry] currentKey:', currentKey, 'currentIndex:', currentIndex, 'newIndex:', newIndex, 'keys:', keys);
          
          if (newIndex >= 0 && newIndex < keys.length) {
            // Rebuild object with swapped order
            const newObj = {};
            keys.forEach((k, idx) => {
              if (idx === currentIndex) return; // Skip current
              if (idx === newIndex) {
                // Insert current before/after this key
                if (_action === 'moveEntryUp') {
                  newObj[currentKey] = parentObj[currentKey];
                  newObj[k] = parentObj[k];
                } else {
                  newObj[k] = parentObj[k];
                  newObj[currentKey] = parentObj[currentKey];
                }
              } else {
                newObj[k] = parentObj[k];
              }
            });
            
            console.log('[moveEntry] newObj keys:', Object.keys(newObj));
            
            // Update the parent object in MongoDB
            const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';
            console.log('[moveEntry] parentPath:', parentPath);
            
            // Special handling for root level moves
            if (parentPath === '') {
              // For root level, we need to reconstruct the entire document
              // Exclude _id from newObj as MongoDB won't allow changing it
              const { _id, ...fieldsToUpdate } = newObj;
              
              // Store the complete newObj for structural sharing update
              // We'll pass it through changeData
              changeData._newRootObj = newObj;
              
              // We need to send a complete document replacement
              // Use multiple $set operations or a $replaceRoot operation
              // For simplicity, we'll set each field individually but MongoDB may not preserve order
              // So we'll use a special approach: unset all fields then set them in order
              
              // Better approach: use the backend to handle this as a document replacement
              const mongoPath = ''; // Empty path means root
              const backendUrl = getBackendServerUrl();
    const response = await fetch(
                `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
                {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    action: 'replaceFields',
                    path: mongoPath,
                    value: fieldsToUpdate
                  })
                }
              );
              
              const apiResult = await response.json();
              console.log('[moveEntry] API result:', apiResult);
              console.log('[moveEntry] Expected newObj keys:', Object.keys(newObj));
              if (apiResult.data) {
                console.log('[moveEntry] Actual MongoDB keys:', Object.keys(apiResult.data));
              }
              result = apiResult.code === 0 
                ? { code: 0, message: 'Fields reordered successfully', data: apiResult.data }
                : { code: -1, message: apiResult.message || 'Failed to reorder fields' };
            } else {
              // For nested moves, store newObj in newData so structural sharing can use it
              if (!newData) {
                changeData.new = { value: newObj };
              } else {
                newData.value = newObj;
              }
              
              result = await updateDocField(
                database,
                collection,
                docId,
                parentPath,
                newObj
              );
            }
            console.log('[moveEntry] result:', result);
          } else {
            console.log('[moveEntry] Already at boundary - no operation performed');
            return { code: 0, message: 'Already at boundary' };
          }
          break;
        }

        case 'moveItemUp':
        case 'moveItemDown': {
          // Move array item up or down
          // Get current document (use ref for latest value)
          const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
          if (!currentDoc) {
            return { code: -1, message: 'Document not found in cache' };
          }

          // Parse array path like "tags..1" or "content..1.src..0"
          if (isPathToArrayItem(path)) {
            const parts = path.split('..');
            const current = navigateToParentArray(currentDoc, path);
            
            if (current) {
              const currentIndex = parseInt(parts[parts.length - 1]);
              
              // Filter out pseudo items for correct indices
              const realIndices = [];
              current.forEach((item, idx) => {
                if (!(item && typeof item === 'object' && item.isPseudo)) {
                  realIndices.push(idx);
                }
              });
              
              const posInReal = realIndices.indexOf(currentIndex);
              if (posInReal >= 0) {
                const targetPos = _action === 'moveItemUp' ? posInReal - 1 : posInReal + 1;
                if (targetPos >= 0 && targetPos < realIndices.length) {
                  const targetIndex = realIndices[targetPos];
                  
                  // Create new array with swapped items
                  const newArray = [...current];
                  const temp = newArray[currentIndex];
                  newArray[currentIndex] = newArray[targetIndex];
                  newArray[targetIndex] = temp;
                  
                  // Store newArray in newData for structural sharing
                  if (!newData) {
                    changeData.new = { value: newArray };
                  } else {
                    newData.value = newArray;
                  }
                  
                  // Update the entire array in MongoDB
                  const arrayPath = parts[0] + (parts.length > 2 ? '..' + parts.slice(1, -1).join('..') : '');
                  result = await updateDocField(
                    database,
                    collection,
                    docId,
                    arrayPath || parts[0],
                    newArray
                  );
                } else {
                  return { code: 0, message: 'Already at boundary' };
                }
              }
            }
          }
          break;
        }

        case 'moveEntryToTop':
        case 'moveEntryToBottom': {
          // Move dict entry to top or bottom
          // Get current document (use ref for latest value)
          const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
          if (!currentDoc) {
            return { code: -1, message: 'Document not found in cache' };
          }

          // Parse path to find parent and current key
          const pathParts = path.split('.').flatMap(part => 
            part.startsWith('.') ? [part.slice(1)] : [part]
          ).filter(part => part !== '');
          
          // Navigate to parent object
          let parentObj = currentDoc;
          for (let i = 0; i < pathParts.length - 1; i++) {
            parentObj = parentObj[pathParts[i]];
          }
          
          const currentKey = pathParts[pathParts.length - 1];
          const keys = Object.keys(parentObj).filter(k => !k.startsWith('__pseudo__'));
          
          // Rebuild object with entry at new position
          const newObj = {};
          if (_action === 'moveEntryToTop') {
            // Add current key first
            newObj[currentKey] = parentObj[currentKey];
            // Add all other keys
            keys.forEach(k => {
              if (k !== currentKey) {
                newObj[k] = parentObj[k];
              }
            });
          } else {
            // Add all other keys first
            keys.forEach(k => {
              if (k !== currentKey) {
                newObj[k] = parentObj[k];
              }
            });
            // Add current key last
            newObj[currentKey] = parentObj[currentKey];
          }
          
          // Update the parent object in MongoDB
          const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';
          
          // Special handling for root level moves
          if (parentPath === '') {
            const { _id, ...fieldsToUpdate } = newObj;
            changeData._newRootObj = newObj;
            
            const mongoPath = '';
            const backendUrl = getBackendServerUrl();
    const response = await fetch(
              `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
              {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  action: 'replaceFields',
                  path: mongoPath,
                  value: fieldsToUpdate
                })
              }
            );
            
            const apiResult = await response.json();
            result = apiResult.code === 0 
              ? { code: 0, message: 'Fields reordered successfully', data: apiResult.data }
              : { code: -1, message: apiResult.message || 'Failed to reorder fields' };
          } else {
            // For nested moves, store newObj in newData
            if (!newData) {
              changeData.new = { value: newObj };
            } else {
              newData.value = newObj;
            }
            
            result = await updateDocField(
              database,
              collection,
              docId,
              parentPath,
              newObj
            );
          }
          break;
        }

        case 'moveItemToTop':
        case 'moveItemToBottom': {
          // Move array item to top or bottom
          // Get current document (use ref for latest value)
          const currentDoc = docsRef.current.find(d => extractDocId(d) === docId);
          if (!currentDoc) {
            return { code: -1, message: 'Document not found in cache' };
          }

          // Parse array path like "tags..1" or "content..1.src..0"
          if (isPathToArrayItem(path)) {
            const parts = path.split('..');
            const current = navigateToParentArray(currentDoc, path);
            
            if (current) {
              const currentIndex = parseInt(parts[parts.length - 1]);
              
              // Filter out pseudo items
              const realIndices = [];
              current.forEach((item, idx) => {
                if (!(item && typeof item === 'object' && item.isPseudo)) {
                  realIndices.push(idx);
                }
              });
              
              const posInReal = realIndices.indexOf(currentIndex);
              if (posInReal >= 0) {
                // Create new array with item moved to top/bottom
                const newArray = [...current];
                const item = newArray[currentIndex];
                
                // Remove item from current position
                newArray.splice(currentIndex, 1);
                
                if (_action === 'moveItemToTop') {
                  // Insert at beginning
                  newArray.unshift(item);
                } else {
                  // Insert at end
                  newArray.push(item);
                }
                
                // Store newArray in newData for structural sharing
                if (!newData) {
                  changeData.new = { value: newArray };
                } else {
                  newData.value = newArray;
                }
                
                // Update the entire array in MongoDB
                const arrayPath = parts[0] + (parts.length > 2 ? '..' + parts.slice(1, -1).join('..') : '');
                result = await updateDocField(
                  database,
                  collection,
                  docId,
                  arrayPath || parts[0],
                  newArray
                );
              } else {
                return { code: 0, message: 'Item not found in array' };
              }
            }
          }
          break;
        }

        case 'convertParentToText':
          // Convert parent dict/array to text (from single-entry/item)
          // The path passed to onChange is already the parent path
          result = await updateDocField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
          break;

        case 'replaceDictWithJson':
          // Replace entire dict with new JSON object
          result = await updateDocField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
          break;

        case 'mergeDictWithJson':
          result = await handleMergeDictWithJson(database, collection, docId, path, newData, changeData, docsRef, setIsUpdating);
          break;

        default:
          // Update field value (covers type conversions and value edits)
          result = await updateDocField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
      }

      if (result.code === 0) {
        // Re-extract newData in case it was modified during the switch (e.g., for merge operations)
        const updatedNewData = changeData.new;
        
        // Update the document in the atom with structural sharing
        // Only objects in the path to the changed value get new references
        setDocs(prevDocs => {
          const newDocs = prevDocs.map(d => {
            const dId = extractDocId(d);
            if (dId !== docId) return d;
            
            // For parent operations and move operations, use _parentPath instead of path
            const actualPath = (_action === 'clearParentDict' || _action === 'deleteParentDict' || 
                                _action === 'clearParentArray' || _action === 'deleteParentArray' ||
                                _action === 'moveEntryUp' || _action === 'moveEntryDown' ||
                                _action === 'moveItemUp' || _action === 'moveItemDown' ||
                                _action === 'moveEntryToTop' || _action === 'moveEntryToBottom' ||
                                _action === 'moveItemToTop' || _action === 'moveItemToBottom')
              ? changeData._parentPath 
              : path;
            
            // Parse path: handle both object keys (.) and array indices (..)
            const pathParts = actualPath.split('.').flatMap(part => 
              part.startsWith('.') ? [part.slice(1)] : [part]
            ).filter(part => part !== '');
            
            console.log('[structuralSharing] _action:', _action, 'actualPath:', actualPath, 'pathParts:', pathParts);
            
            // Recursive function that creates new objects only along the update path
            const updateAtPath = (obj, parts, partIndex) => {
              if (partIndex >= parts.length) {
                // Reached the target
                console.log('[updateAtPath] Reached target. _action:', _action, 'parts.length:', parts.length, 'has _newRootObj:', !!changeData._newRootObj);
                if (_action === 'deleteEntry' || _action === 'deleteArrayItem' || 
                    _action === 'deleteParentDict' || _action === 'deleteParentArray') {
                  // For deletion, return undefined to signal removal
                  return undefined;
                } else if (_action === 'createEntry' && _key) {
                  // For createEntry, delete the pseudo key and add the real key
                  // The path points to the pseudo key, so we need to remove it
                  // This case shouldn't be reached as we handle it at partIndex === parts.length - 1
                  return obj;
                } else if (_action === 'clearParentDict') {
                  // Clear all entries in dict
                  return {};
                } else if (_action === 'clearParentArray') {
                  // Clear all items in array
                  return [];
                } else if ((_action === 'moveEntryUp' || _action === 'moveEntryDown' || 
                            _action === 'moveEntryToTop' || _action === 'moveEntryToBottom') && changeData._newRootObj) {
                  // For root-level move operations, use the reconstructed object we stored
                  console.log('[updateAtPath] Using _newRootObj. Keys:', Object.keys(changeData._newRootObj));
                  return changeData._newRootObj;
                } else {
                  // For value update, return the new value
                  console.log('[updateAtPath] Using updatedNewData.value');
                  return updatedNewData.value;
                }
              }
              
              const key = parts[partIndex];
              const isArray = Array.isArray(obj);
              
              if (partIndex === parts.length - 1) {
                // Last key - this is where the change happens
                if (_action === 'deleteEntry' || _action === 'deleteArrayItem' ||
                    _action === 'deleteParentDict' || _action === 'deleteParentArray') {
                  if (isArray) {
                    // Remove from array
                    const newArr = [...obj];
                    newArr.splice(parseInt(key), 1);
                    return newArr;
                  } else {
                    // Remove from object
                    const { [key]: removed, ...rest } = obj;
                    return rest;
                  }
                } else if (_action === 'clearParentDict') {
                  // Replace dict with empty dict
                  if (isArray) {
                    const newArr = [...obj];
                    newArr[parseInt(key)] = {};
                    return newArr;
                  } else {
                    return { ...obj, [key]: {} };
                  }
                } else if (_action === 'clearParentArray') {
                  // Replace array with empty array
                  if (isArray) {
                    const newArr = [...obj];
                    newArr[parseInt(key)] = [];
                    return newArr;
                  } else {
                    return { ...obj, [key]: [] };
                  }
                } else if (_action === 'createEntry' && _key) {
                  // Delete the pseudo key (which is 'key') and add the real key
                  const pseudoData = obj[key];
                  
                  // Check if pseudo has position info to maintain order
                  if (pseudoData && pseudoData.position && pseudoData.referenceKey) {
                    const newObj = {};
                    for (const k of Object.keys(obj)) {
                      if (k === key) continue; // Skip pseudo key
                      
                      // Insert new key at correct position
                      if (k === pseudoData.referenceKey) {
                        if (pseudoData.position === 'above') {
                          newObj[_key] = updatedNewData.value;
                          newObj[k] = obj[k];
                        } else {
                          newObj[k] = obj[k];
                          newObj[_key] = updatedNewData.value;
                        }
                      } else {
                        newObj[k] = obj[k];
                      }
                    }
                    return newObj;
                  } else {
                    // No position info - just delete pseudo and add at end
                    const { [key]: removed, ...rest } = obj;
                    return { ...rest, [_key]: updatedNewData.value };
                  }
                } else {
                  // Update value
                  if (isArray) {
                    const newArr = [...obj];
                    newArr[parseInt(key)] = updatedNewData.value;
                    return newArr;
                  } else {
                    return { ...obj, [key]: updatedNewData.value };
                  }
                }
              }
              
              // Intermediate key - recurse deeper
              const nextValue = obj[key];
              const updatedValue = updateAtPath(nextValue, parts, partIndex + 1);
              
              if (isArray) {
                const newArr = [...obj];
                newArr[parseInt(key)] = updatedValue;
                return newArr;
              } else {
                return { ...obj, [key]: updatedValue };
              }
            };
            
            return updateAtPath(d, pathParts, 0);
          });
          
          // Update the ref immediately so subsequent operations see the new state
          docsRef.current = newDocs;
          console.log('[structuralSharing] Updated docsRef. Document keys:', Object.keys(newDocs.find(d => extractDocId(d) === docId) || {}));
          
          return newDocs;
        });
        
        // Return success with optional warning
        const returnValue = { code: 0, message: 'Success' };
        if (result.warning) {
          returnValue.warning = result.warning;
        }
        return returnValue;
      }

      // Backend operation failed - return error (pseudo component will handle removal)
      return { code: -1, message: result.message || 'Update failed' };
    } catch (error) {
      console.error('Failed to update document:', error);
      return { code: -2, message: error.message || 'Network error' };
    } finally {
      setIsUpdating(false);
    }
  }, [database, collection, docId, setDocs]);

  return { handleChange, isUpdating };
}
