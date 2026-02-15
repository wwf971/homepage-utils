/**
 * mongoEditMobx.js - MobX-based MongoDB document editor
 * 
 * This module provides a hook for editing MongoDB documents using MobX observables.
 * Unlike the Jotai version, this mutates documents in-place and relies on MobX
 * for automatic re-rendering.
 * 
 * Key differences from mongoEdit.js:
 * - Uses MobX store instead of Jotai atoms
 * - Mutates documents in-place instead of structural sharing
 * - Simpler state management due to MobX's automatic tracking
 */

import React from 'react';
import { runInAction } from 'mobx';
import {
  extractDocId,
  parsePathToSegments,
  navigateToPath,
  navigateToParentArray,
  isPathToArrayItem
} from '@wwf971/react-comp-misc';
import {
  updateDocField,
  replaceDocFields,
  deleteDocField,
  createDocField,
  removeArrayItem
} from './mongoStore';
import { getBackendServerUrl } from '../remote/dataStore';
import mongoDocStore from './mongoDocStore';

/**
 * Handle key rename operation
 */
async function handleKeyRename(database, collection, docId, path, newData, changeData, doc, setIsUpdating) {
  const pathParts = path.split('.').filter(p => p !== '');
  const oldKey = pathParts[pathParts.length - 1];
  const newKey = newData.value;
  
  // Get parent path
  const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';
  
  // Navigate to parent object to get the old value
  let parentObj = doc;
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
  
  // If successful, mutate the document in place
  if (result.code === 0) {
    runInAction(() => {
      // Delete old key and add new key
      delete parentObj[oldKey];
      parentObj[newKey] = oldValue;
    });
    
    setIsUpdating(false);
    return { code: 0, message: 'Success' };
  }
  
  setIsUpdating(false);
  return { code: -1, message: result.message || 'Failed to rename key' };
}

/**
 * Handle merge dict with JSON operation
 */
async function handleMergeDictWithJson(database, collection, docId, path, newData, changeData, doc, setIsUpdating) {
  const currentKey = changeData._currentKey;
  const segments = parsePathToSegments(path);
  const parentObj = navigateToPath(doc, segments);
  
  if (!parentObj || typeof parentObj !== 'object' || Array.isArray(parentObj)) {
    setIsUpdating(false);
    return { code: -1, message: 'Parent is not an object' };
  }
  
  // Get all existing keys (excluding pseudo keys)
  const existingKeys = Object.keys(parentObj).filter(k => !k.startsWith('__pseudo__'));
  const currentIndex = existingKeys.indexOf(currentKey);
  
  if (currentIndex === -1) {
    setIsUpdating(false);
    return { code: -1, message: 'Current key not found in parent object' };
  }
  
  // Get keys from the new object to merge
  const newKeys = Object.keys(newData.value);
  
  // Check if any of the new keys are numeric-looking
  const hasNumericKeys = newKeys.some(k => /^\d+$/.test(k));
  if (hasNumericKeys) {
    console.warn('[mergeDictWithJson] Warning: Numeric-looking keys detected. JavaScript will automatically sort them to the beginning of the object.');
  }
  
  // Build array of all keys in desired order
  const keysInOrder = [
    ...existingKeys.slice(0, currentIndex + 1),
    ...newKeys,
    ...existingKeys.slice(currentIndex + 1)
  ];
  
  // Build new object by iterating in desired order
  const newObj = {};
  for (const key of keysInOrder) {
    if (key in parentObj) {
      newObj[key] = parentObj[key];
    } else if (key in newData.value) {
      newObj[key] = newData.value[key];
    }
  }
  
  // Special handling for root-level merge
  let result;
  if (path === '') {
    const { _id, ...fieldsToUpdate } = newObj;
    result = await replaceDocFields(database, collection, docId, fieldsToUpdate);
  } else {
    result = await updateDocField(database, collection, docId, path, newObj);
  }
  
  // If successful, mutate the parent object in place
  if (result.code === 0) {
    runInAction(() => {
      // Clear existing keys and add new ones in order
      Object.keys(parentObj).forEach(k => delete parentObj[k]);
      Object.keys(newObj).forEach(k => {
        parentObj[k] = newObj[k];
      });
    });
    
    // Add warning if numeric keys were detected
    if (hasNumericKeys) {
      result.warning = 'Numeric keys were reordered by JavaScript';
    }
  }
  
  return result;
}

/**
 * Hook for editing MongoDB documents with MobX
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {Object} document - The observable document from MobX store
 * @returns {Object} - { handleChange, isUpdating }
 */
export function useMongoDocEditorMobx(database, collection, document) {
  const [isUpdating, setIsUpdating] = React.useState(false);
  
  // Extract document ID once and memoize it
  // Prefer custom id field over _id for file access points and mongo-app docs
  const docId = React.useMemo(() => {
    return document?.id || extractDocId(document);
  }, [document?.id, document?._id]);

  const handleChange = React.useCallback(async (path, changeData) => {
    const { old, new: newData, _action, _key } = changeData;

    if (!docId) {
      console.error('Document id not found or invalid:', document.id, document._id);
      return { code: -1, message: 'Document id not found' };
    }
    
    // Use the document passed as prop (already observable from mongoDocStore)
    // Don't retrieve it again to avoid infinite MobX loops
    const latestDoc = document;

    // Prevent modification of _id field
    const isIdField = path === '_id' || path.startsWith('_id.');
    const isIdKeyOperation = _key === '_id';
    
    if (isIdField || isIdKeyOperation) {
      const blockedActions = [
        'updateValue', 'deleteEntry', 'createEntry',
        'moveEntryUp', 'moveEntryDown', 'moveEntryToTop', 'moveEntryToBottom',
        'convertParentToText'
      ];
      
      if (blockedActions.includes(_action) || !_action) {
        console.warn('Cannot modify _id field');
        return { code: -1, message: '_id field cannot be modified' };
      }
    }

    // Handle pseudo operations that don't need backend calls
    switch (_action) {
      case 'addItem':
      case 'addItemAbove':
      case 'addItemBelow': {
        // Add pseudo item to array (UI only, no backend call)
        runInAction(() => {
          const segments = parsePathToSegments(path);
          const targetArray = navigateToPath(latestDoc, segments);
          
          if (Array.isArray(targetArray)) {
            const pseudoItem = { isPseudo: true };
            
            if (_action === 'addItem') {
              targetArray.push(pseudoItem);
            } else if (segments.length > 0 && segments[segments.length - 1].type === 'arr') {
              const targetIndex = segments[segments.length - 1].index;
              if (_action === 'addItemAbove') {
                targetArray.splice(targetIndex, 0, pseudoItem);
              } else {
                targetArray.splice(targetIndex + 1, 0, pseudoItem);
              }
            }
          }
        });
        return { code: 0, message: 'Success' };
      }

      case 'addEntry':
      case 'addEntryAbove':
      case 'addEntryBelow': {
        // Add pseudo entry to object (UI only, no backend call)
        runInAction(() => {
          const segments = parsePathToSegments(path);
          const targetObj = segments.length === 0 ? latestDoc : navigateToPath(latestDoc, segments.slice(0, -1));
          
          if (targetObj && typeof targetObj === 'object' && !Array.isArray(targetObj)) {
            const pseudoKey = `__pseudo__${Date.now()}`;
            targetObj[pseudoKey] = {
              __pseudo__: true,
              position: _action === 'addEntryAbove' ? 'above' : (_action === 'addEntryBelow' ? 'below' : undefined),
              referenceKey: _action !== 'addEntry' ? segments[segments.length - 1].key : undefined
            };
          }
        });
        return { code: 0, message: 'Success' };
      }

      case 'cancelCreate': {
        // Remove pseudo element (UI only, no backend call)
        runInAction(() => {
          const segments = parsePathToSegments(path);
          if (segments.length === 0) return;
          
          const parent = navigateToPath(latestDoc, segments.slice(0, -1));
          const lastSeg = segments[segments.length - 1];
          
          if (lastSeg.type === 'arr') {
            parent.splice(lastSeg.index, 1);
          } else {
            delete parent[lastSeg.key];
          }
        });
        return { code: 0, message: 'Success' };
      }
    }

    // For operations that need backend calls, set isUpdating
    setIsUpdating(true);

    try {
      let result;

      // Handle key rename first (special case)
      if (changeData._keyRename) {
        return await handleKeyRename(database, collection, docId, path, newData, changeData, document, setIsUpdating);
      }

      switch (_action) {
        case 'createEntry': {
          // Extract optional ordering parameters
          let insertIndex = changeData._insertIndex;
          let respectIndex = changeData._respectIndex || false;
          
          const parentPath = path.lastIndexOf('.') > 0 
            ? path.substring(0, path.lastIndexOf('.'))
            : '';
          
          // Try to infer from __pseudo__ if not provided
          if (insertIndex === undefined || !respectIndex) {
            const segments = parsePathToSegments(path);
            const parent = segments.length === 0 ? latestDoc : navigateToPath(latestDoc, segments.slice(0, -1));
            const pseudoKey = segments[segments.length - 1].key;
            
            if (pseudoKey && parent[pseudoKey] && typeof parent[pseudoKey] === 'object' &&
                parent[pseudoKey].__pseudo__ === true) {
              const pseudoData = parent[pseudoKey];
              if (pseudoData.position && pseudoData.referenceKey) {
                const keys = Object.keys(parent).filter(k => !k.startsWith('__pseudo__'));
                const refIndex = keys.indexOf(pseudoData.referenceKey);
                
                if (refIndex !== -1) {
                  insertIndex = pseudoData.position === 'above' ? refIndex : refIndex + 1;
                  respectIndex = true;
                }
              }
            }
          }
          
          result = await createDocField(
            database,
            collection,
            docId,
            parentPath,
            _key,
            newData.value,
            document,
            insertIndex !== undefined ? insertIndex : -1,
            respectIndex
          );
          
          // If successful, mutate document in place
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = segments.length === 0 ? latestDoc : navigateToPath(latestDoc, segments.slice(0, -1));
              const pseudoKey = segments[segments.length - 1].key;
              
              // Remove pseudo key and add real key
              delete parent[pseudoKey];
              parent[_key] = newData.value;
            });
          }
          break;
        }

        case 'deleteEntry': {
          result = await deleteDocField(database, collection, docId, path);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              delete parent[lastSeg.key];
            });
          }
          break;
        }

        case 'createItem': {
          result = await updateDocField(database, collection, docId, path, newData.value);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              parent[lastSeg.index] = newData.value;
            });
          }
          break;
        }

        case 'deleteArrayItem': {
          result = await removeArrayItem(database, collection, docId, path);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              parent.splice(lastSeg.index, 1);
            });
          }
          break;
        }

        case 'clearParentDict': {
          const parentPath = changeData._parentPath;
          if (!parentPath || parentPath === '') {
            return { code: -1, message: 'Cannot clear root document' };
          }
          
          result = await updateDocField(database, collection, docId, parentPath, {});
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(parentPath);
              const targetObj = navigateToPath(latestDoc, segments);
              Object.keys(targetObj).forEach(k => delete targetObj[k]);
            });
          }
          break;
        }

        case 'deleteParentDict': {
          const parentPath = changeData._parentPath;
          if (!parentPath || parentPath === '') {
            return { code: -1, message: 'Cannot delete root document' };
          }
          
          if (isPathToArrayItem(parentPath)) {
            result = await removeArrayItem(database, collection, docId, parentPath);
          } else {
            result = await deleteDocField(database, collection, docId, parentPath);
          }
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(parentPath);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              
              if (lastSeg.type === 'arr') {
                parent.splice(lastSeg.index, 1);
              } else {
                delete parent[lastSeg.key];
              }
            });
          }
          break;
        }

        case 'clearParentArray': {
          const parentPath = changeData._parentPath;
          if (!parentPath || parentPath === '') {
            return { code: -1, message: 'Cannot clear root document' };
          }
          
          result = await updateDocField(database, collection, docId, parentPath, []);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(parentPath);
              const targetArray = navigateToPath(latestDoc, segments);
              targetArray.length = 0;
            });
          }
          break;
        }

        case 'deleteParentArray': {
          const parentPath = changeData._parentPath;
          if (!parentPath || parentPath === '') {
            return { code: -1, message: 'Cannot delete root document' };
          }
          
          if (isPathToArrayItem(parentPath)) {
            result = await removeArrayItem(database, collection, docId, parentPath);
          } else {
            result = await deleteDocField(database, collection, docId, parentPath);
          }
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(parentPath);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              
              if (lastSeg.type === 'arr') {
                parent.splice(lastSeg.index, 1);
              } else {
                delete parent[lastSeg.key];
              }
            });
          }
          break;
        }

        case 'moveEntryUp':
        case 'moveEntryDown':
        case 'moveEntryToTop':
        case 'moveEntryToBottom': {
          // Get parent object
          const pathParts = path.split('.').filter(p => p !== '');
          const segments = parsePathToSegments(path);
          const parentObj = navigateToPath(latestDoc, segments.slice(0, -1));
          
          const currentKey = pathParts[pathParts.length - 1];
          const keys = Object.keys(parentObj).filter(k => !k.startsWith('__pseudo__'));
          const currentIndex = keys.indexOf(currentKey);
          
          let newIndex;
          if (_action === 'moveEntryUp') {
            newIndex = currentIndex - 1;
          } else if (_action === 'moveEntryDown') {
            newIndex = currentIndex + 1;
          } else if (_action === 'moveEntryToTop') {
            newIndex = 0;
          } else {
            newIndex = keys.length - 1;
          }
          
          if (newIndex >= 0 && newIndex < keys.length && newIndex !== currentIndex) {
            // Rebuild object with new order
            const newObj = {};
            const newKeys = [...keys];
            newKeys.splice(currentIndex, 1);
            newKeys.splice(newIndex, 0, currentKey);
            
            newKeys.forEach(k => {
              newObj[k] = parentObj[k];
            });
            
            // Update in MongoDB
            const parentPath = pathParts.length > 1 ? pathParts.slice(0, -1).join('.') : '';
            
            if (parentPath === '') {
              const { _id, ...fieldsToUpdate } = newObj;
              const backendUrl = getBackendServerUrl();
              const response = await fetch(
                `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}/update`,
                {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'replaceFields',
                    path: '',
                    value: fieldsToUpdate
                  })
                }
              );
              
              const apiResult = await response.json();
              result = apiResult.code === 0 
                ? { code: 0, message: 'Fields reordered successfully' }
                : { code: -1, message: apiResult.message || 'Failed to reorder fields' };
            } else {
              result = await updateDocField(database, collection, docId, parentPath, newObj);
            }
            
            // If successful, mutate in place
            if (result.code === 0) {
              runInAction(() => {
                Object.keys(parentObj).forEach(k => delete parentObj[k]);
                Object.keys(newObj).forEach(k => {
                  parentObj[k] = newObj[k];
                });
              });
            }
          } else {
            return { code: 0, message: 'Already at boundary' };
          }
          break;
        }

        case 'moveItemUp':
        case 'moveItemDown':
        case 'moveItemToTop':
        case 'moveItemToBottom': {
          if (isPathToArrayItem(path)) {
            const parts = path.split('..');
            const arrayPath = parts.length > 1 ? parts.slice(0, -1).join('..') : parts[0];
            const current = navigateToParentArray(latestDoc, path);
            const currentIndex = parseInt(parts[parts.length - 1]);
            
            if (!current || !Array.isArray(current)) {
              return { code: -1, message: 'Parent is not an array' };
            }
            
            // Perform the move operation on the observable array
            runInAction(() => {
              const item = current[currentIndex];
              current.splice(currentIndex, 1); // Remove from current position
              
              if (_action === 'moveItemUp') {
                current.splice(Math.max(0, currentIndex - 1), 0, item);
              } else if (_action === 'moveItemDown') {
                current.splice(currentIndex + 1, 0, item);
              } else if (_action === 'moveItemToTop') {
                current.unshift(item);
              } else if (_action === 'moveItemToBottom') {
                current.push(item);
              }
            });
            
            // Send the updated array to backend for persistence
            const arraySnapshot = current.slice(); // Get plain array
            result = await updateDocField(database, collection, docId, arrayPath, arraySnapshot);
            
            // If backend fails, we need to revert the mutation
            if (result.code !== 0) {
              console.error('[moveItem] Backend failed, but UI already mutated. Consider reverting.');
              // In a production app, you'd want to revert the mutation here
            }
          }
          break;
        }

        case 'convertParentToText': {
          result = await updateDocField(database, collection, docId, path, newData.value);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              
              if (lastSeg.type === 'arr') {
                parent[lastSeg.index] = newData.value;
              } else {
                parent[lastSeg.key] = newData.value;
              }
            });
          }
          break;
        }

        case 'replaceDictWithJson': {
          result = await updateDocField(database, collection, docId, path, newData.value);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const targetObj = navigateToPath(latestDoc, segments);
              
              // Clear and rebuild
              Object.keys(targetObj).forEach(k => delete targetObj[k]);
              Object.keys(newData.value).forEach(k => {
                targetObj[k] = newData.value[k];
              });
            });
          }
          break;
        }

        case 'mergeDictWithJson': {
          result = await handleMergeDictWithJson(database, collection, docId, path, newData, changeData, document, setIsUpdating);
          break;
        }

        default: {
          // Update field value (covers type conversions and value edits)
          result = await updateDocField(database, collection, docId, path, newData.value);
          
          if (result.code === 0) {
            runInAction(() => {
              const segments = parsePathToSegments(path);
              const parent = navigateToPath(latestDoc, segments.slice(0, -1));
              const lastSeg = segments[segments.length - 1];
              
              if (lastSeg.type === 'arr') {
                parent[lastSeg.index] = newData.value;
              } else {
                parent[lastSeg.key] = newData.value;
              }
            });
          }
        }
      }

      if (result.code === 0) {
        const returnValue = { code: 0, message: 'Success' };
        if (result.warning) {
          returnValue.warning = result.warning;
        }
        return returnValue;
      }

      return { code: -1, message: result.message || 'Update failed' };
    } catch (error) {
      console.error('Failed to update document:', error);
      return { code: -2, message: error.message || 'Network error' };
    } finally {
      setIsUpdating(false);
    }
  }, [database, collection, docId, document]);

  return { handleChange, isUpdating };
}
