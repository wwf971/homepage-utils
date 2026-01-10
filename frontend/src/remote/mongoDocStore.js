/**
 * mongoDocStore.js - Handles MongoDB document CRUD operations
 * 
 * Responsibilities:
 * - Convert JsonComp path format (user.name, tags..0) to MongoDB dot notation (user.name, tags.0)
 * - Send update operations to backend
 * - Update local Jotai atoms to reflect changes
 * 
 * Architecture:
 * - Each document is identified by its _id field
 * - Operations are sent one at a time to backend
 * - Backend validates and applies to MongoDB
 * - Frontend optimistically updates local state after success
 */

import React from 'react';
import { useSetAtom, useAtomValue } from 'jotai';
import { mongoDocsAtom } from './dataStore';
import {
  convertPathToMongoDotNotation,
  extractDocId,
  parsePathToSegments,
  navigateToParentArray,
  isPathToArrayItem
} from './mongoUtils';

/**
 * Update a field value in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format
 * @param {any} value - New value
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function updateDocumentField(database, collection, docId, path, value) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const response = await fetch(
      `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'setValue',
          path: mongoPath,
          value: value
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Field updated successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to update field' };
  } catch (error) {
    console.error('Failed to update document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Delete a field from a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function deleteDocumentField(database, collection, docId, path) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const response = await fetch(
      `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'deleteField',
          path: mongoPath
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Field deleted successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to delete field' };
  } catch (error) {
    console.error('Failed to delete document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Create a new field in a MongoDB document with optional ordering
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Field path in JsonComp format (parent path)
 * @param {string} key - New field key
 * @param {any} value - New field value
 * @param {Object} currentDoc - Current document for reconstructing with correct order
 * @param {number} insertIndex - Index where to insert the new field (0-based)
 * @param {boolean} respectIndex - Whether to preserve field order (default: false, appends to end)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function createDocField(database, collection, docId, path, key, value, currentDoc = null, insertIndex = -1, respectIndex = false) {
  try {
    // If we need to respect insertion order
    if (respectIndex && insertIndex >= 0 && currentDoc) {
      // Get the parent object from current document
      let parentObj = currentDoc;
      if (path) {
        const pathParts = path.split('.').filter(p => p !== '');
        for (const part of pathParts) {
          parentObj = parentObj[part];
        }
      }
      
      // Reconstruct object with new field at correct index
      const orderedObj = {};
      const entries = Object.entries(parentObj).filter(([k]) => !k.startsWith('__pseudo__'));
      
      let currentIndex = 0;
      for (const [k, v] of entries) {
        if (currentIndex === insertIndex) {
          orderedObj[key] = value;
        }
        orderedObj[k] = v;
        currentIndex++;
      }
      
      // If insertIndex is at the end or beyond
      if (insertIndex >= entries.length) {
        orderedObj[key] = value;
      }
      
      // For root-level (empty path), we need to merge with the entire document
      // For nested paths, we can replace just that object
      let finalPath, finalValue;
      if (!path || path === '') {
        // Root level - use special handling or just add the field normally
        // Since MongoDB doesn't allow empty path for $set, fall back to simple $set with the key
        finalPath = convertPathToMongoDotNotation(key);
        finalValue = value;
        console.warn('Root-level ordered insert not fully supported by MongoDB - using simple $set');
      } else {
        // Nested path - replace the parent object
        finalPath = convertPathToMongoDotNotation(path);
        finalValue = orderedObj;
      }
      
      // Replace the entire parent object (or use simple $set for root)
      const response = await fetch(
        `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'setValue',
            path: finalPath,
            value: finalValue
          })
        }
      );

      const result = await response.json();
      
      if (result.code === 0) {
        return { code: 0, message: 'Field created successfully', data: result.data };
      }
      return { code: -1, message: result.message || 'Failed to create field' };
    } else {
      // No ordering needed - simple $set (appends to end)
      const fullPath = path ? `${path}.${key}` : key;
      const mongoPath = convertPathToMongoDotNotation(fullPath);
      
      const response = await fetch(
        `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            action: 'setValue',
            path: mongoPath,
            value: value
          })
        }
      );

      const result = await response.json();
      
      if (result.code === 0) {
        return { code: 0, message: 'Field created successfully', data: result.data };
      }
      return { code: -1, message: result.message || 'Failed to create field' };
    }
  } catch (error) {
    console.error('Failed to create document field:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Add an item to an array in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} arrayPath - Array path in JsonComp format (e.g., "tags" or "user.roles")
 * @param {any} value - Value to add
 * @param {number} position - Position to insert at (optional, defaults to end)
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function addArrayItem(database, collection, docId, arrayPath, value, position = -1) {
  try {
    const mongoPath = convertPathToMongoDotNotation(arrayPath);
    
    const response = await fetch(
      `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'addArrayItem',
          path: mongoPath,
          value: value,
          position: position
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Array item added successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to add array item' };
  } catch (error) {
    console.error('Failed to add array item:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Remove an item from an array in a MongoDB document
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {string} docId - Document _id
 * @param {string} path - Full path including array index (e.g., "tags..0" or "items..1.name")
 * @returns {Promise<{code: number, message?: string, data?: any}>}
 */
export async function removeArrayItem(database, collection, docId, path) {
  try {
    const mongoPath = convertPathToMongoDotNotation(path);
    
    const response = await fetch(
      `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'removeArrayItem',
          path: mongoPath
        })
      }
    );

    const result = await response.json();
    
    if (result.code === 0) {
      return { code: 0, message: 'Array item removed successfully', data: result.data };
    }
    return { code: -1, message: result.message || 'Failed to remove array item' };
  } catch (error) {
    console.error('Failed to remove array item:', error);
    return { code: -2, message: error.message || 'Network error' };
  }
}

/**
 * Custom hook for editing MongoDB documents
 * 
 * @param {string} database - Database name
 * @param {string} collection - Collection name
 * @param {Object} document - The document being edited
 * @returns {Object} { handleChange, isUpdating }
 */
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
        setDocs(prevDocs => {
          return prevDocs.map(d => {
            const dId = extractDocId(d);
            if (dId !== docId) return d;
            
            const pathIsArray = path.includes('..');
            const pseudoItem = { isPseudo: true };
            
            if (pathIsArray) {
              // Adding above/below an existing item
              // Path format: "content..1.src..0" means content[1].src[0]
              const parts = path.split('..');
              const clone = JSON.parse(JSON.stringify(d));
              let current = clone;
              
              // Navigate through all parts except the last one
              for (let i = 0; i < parts.length - 1; i++) {
                const part = parts[i];
                
                if (i === 0 && part) {
                  // First part: navigate through object keys (e.g., "content")
                  const objKeys = part.split('.').filter(k => k !== '');
                  for (const key of objKeys) {
                    current = current[key];
                    if (!current) {
                      console.error('[addItem] Navigation failed at key:', key, 'path:', path);
                      return d;
                    }
                  }
                } else if (i > 0) {
                  // Middle parts: could be "1" or "1.src" (array index followed by object keys)
                  const segments = part.split('.');
                  
                  // First segment should be an array index
                  const arrayIndex = parseInt(segments[0]);
                  if (!Array.isArray(current)) {
                    console.error('[addItem] Expected array at navigation step', i, 'but got:', typeof current, current);
                    console.error('[addItem] Path:', path, 'Parts:', parts, 'Current part:', part);
                    return d;
                  }
                  current = current[arrayIndex];
                  if (!current) {
                    console.error('[addItem] Navigation failed at index:', arrayIndex, 'path:', path);
                    return d;
                  }
                  
                  // Remaining segments are object keys (e.g., "src")
                  for (let j = 1; j < segments.length; j++) {
                    const key = segments[j];
                    if (key) {
                      current = current[key];
                      if (!current) {
                        console.error('[addItem] Navigation failed at key:', key, 'path:', path);
                        return d;
                      }
                    }
                  }
                }
              }
              
              // At this point, current should be the parent array
              if (!Array.isArray(current)) {
                console.error('[addItem] Expected array after navigation but got:', typeof current, current);
                console.error('[addItem] Path:', path, 'Parts:', parts);
                console.error('[addItem] Document structure:', JSON.stringify(d, null, 2));
                return d;
              }
              
              const targetIndex = parseInt(parts[parts.length - 1]);
              if (_action === 'addItemAbove') {
                current.splice(targetIndex, 0, pseudoItem);
              } else if (_action === 'addItemBelow') {
                current.splice(targetIndex + 1, 0, pseudoItem);
              }
              
              return clone;
            } else {
              // Adding to empty array
              const pathParts = path.split('.').filter(p => p !== '');
              const clone = JSON.parse(JSON.stringify(d));
              let current = clone;
              
              for (let i = 0; i < pathParts.length - 1; i++) {
                current = current[pathParts[i]];
              }
              
              const arrayKey = pathParts[pathParts.length - 1];
              if (Array.isArray(current[arrayKey])) {
                current[arrayKey].push(pseudoItem);
              }
              
              return clone;
            }
          });
        });
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
        // Key rename: oldKey is in path, newKey is in newData.value
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
        if (parentPath === '') {
          // Root level - need special handling to preserve _id
          const { _id, ...fieldsToUpdate } = newParentObj;
          
          // Use replaceFields action
          const response = await fetch(
            `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
            {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                action: 'replaceFields',
                path: '',
                value: fieldsToUpdate
              })
            }
          );
          
          const apiResult = await response.json();
          result = apiResult.code === 0 
            ? { code: 0, message: 'Key renamed successfully', data: apiResult.data }
            : { code: -1, message: apiResult.message || 'Failed to rename key' };
        } else {
          // Nested path - replace parent object
          result = await updateDocumentField(
            database,
            collection,
            docId,
            parentPath,
            newParentObj
          );
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
          result = await deleteDocumentField(
            database,
            collection,
            docId,
            path
          );
          break;

        case 'createItem':
          // Create array item (convert pseudo to real)
          result = await updateDocumentField(
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
          result = await updateDocumentField(
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
            // Use deleteDocumentField for object properties
            result = await deleteDocumentField(
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
          result = await updateDocumentField(
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
            // Use deleteDocumentField for object properties
            result = await deleteDocumentField(
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
              const response = await fetch(
                `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
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
              
              result = await updateDocumentField(
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
                  result = await updateDocumentField(
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
            const response = await fetch(
              `/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
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
            
            result = await updateDocumentField(
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
                result = await updateDocumentField(
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
          result = await updateDocumentField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
          break;

        default:
          // Update field value (covers type conversions and value edits)
          result = await updateDocumentField(
            database,
            collection,
            docId,
            path,
            newData.value
          );
      }

      if (result.code === 0) {
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
                  console.log('[updateAtPath] Using newData.value');
                  return newData.value;
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
                          newObj[_key] = newData.value;
                          newObj[k] = obj[k];
                        } else {
                          newObj[k] = obj[k];
                          newObj[_key] = newData.value;
                        }
                      } else {
                        newObj[k] = obj[k];
                      }
                    }
                    return newObj;
                  } else {
                    // No position info - just delete pseudo and add at end
                    const { [key]: removed, ...rest } = obj;
                    return { ...rest, [_key]: newData.value };
                  }
                } else {
                  // Update value
                  if (isArray) {
                    const newArr = [...obj];
                    newArr[parseInt(key)] = newData.value;
                    return newArr;
                  } else {
                    return { ...obj, [key]: newData.value };
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
        return { code: 0, message: 'Success' };
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
