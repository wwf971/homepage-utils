/**
 * mongoDocStore.js - MobX store for MongoDB documents
 * 
 * This store manages MongoDB documents as observable objects that can be
 * mutated in-place. MobX tracks changes and triggers re-renders automatically.
 * 
 * Key features:
 * - Documents are stored as MobX observables with makeAutoObservable
 * - In-place mutations trigger automatic UI updates
 * - Acts as a cache layer between UI and backend
 * - Handles backend sync for all document operations
 */

import { makeAutoObservable, runInAction, observable } from 'mobx';
import { extractDocId } from '@wwf971/react-comp-misc';
import { getBackendServerUrl } from '../remote/backendServerStore';
import {
  updateDocField,
  deleteDocField,
  createDocField,
  removeArrayItem
} from './mongoStore';

class MongoDocStore {
  // Map of docId -> observable document (must be observable.map for MobX reactivity)
  docs = observable.map();
  
  // Current selection state (kept for compatibility with existing code)
  selectedDatabase = null;
  selectedCollection = null;
  
  // Pagination state
  currentPage = 1;
  totalDocs = 0;
  pageSize = 20;
  
  // Loading states
  isLoading = false;
  error = null;

  constructor() {
    makeAutoObservable(this, {}, { autoBind: true });
  }

  // ========== Document Management ==========

  /**
   * Add or update a document in the store
   * Converts plain object to observable if needed
   * 
   * Indexing strategy:
   * - Prefer custom 'id' field if present (for file access points, mongo-app docs)
   * - Fall back to MongoDB '_id' field
   */
  setDoc(doc) {
    // Try custom id field first, then fall back to _id
    const docId = doc.id || extractDocId(doc);
    if (!docId) {
      console.error('Cannot add document without valid id or _id:', doc);
      return;
    }

    // Always create a fresh observable to ensure deep observability
    // MobX Map will track the change and components will re-render
    const observableDoc = makeAutoObservable(doc, {}, { deep: true, autoBind: true });
    this.docs.set(docId, observableDoc);
  }

  /**
   * Get a document by ID
   */
  getDoc(docId) {
    return this.docs.get(docId);
  }

  /**
   * Get all documents as array (for rendering)
   */
  get docsArray() {
    return Array.from(this.docs.values());
  }

  /**
   * Remove a document from the store
   */
  removeDoc(docId) {
    this.docs.delete(docId);
  }

  /**
   * Clear all documents
   */
  clearDocs() {
    this.docs.clear();
  }

  /**
   * Set multiple documents at once
   */
  setDocs(docsArray) {
    // Clear existing docs
    this.docs.clear();
    
    // Add new docs
    docsArray.forEach(doc => {
      this.setDoc(doc);
    });
  }

  // ========== Selection State ==========

  setSelectedDatabase(database) {
    this.selectedDatabase = database;
  }

  setSelectedCollection(collection) {
    this.selectedCollection = collection;
  }

  // ========== Pagination ==========

  setCurrentPage(page) {
    this.currentPage = page;
  }

  setTotalDocs(total) {
    this.totalDocs = total;
  }

  setPageSize(size) {
    this.pageSize = size;
  }

  // ========== Loading State ==========

  setLoading(loading) {
    this.isLoading = loading;
  }

  setError(error) {
    this.error = error;
  }

  // ========== Fetch Documents ==========

  /**
   * Fetch documents from backend and update store
   */
  async fetchDocs(database, collection, page = 1, pageSize = 20, filter = {}) {
    this.setLoading(true);
    this.setError(null);

    try {
      const backendUrl = getBackendServerUrl();
      // Use the correct endpoint format that matches mongoStore.js
      // Backend expects 1-based page numbers
      const response = await fetch(
        `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/list?page=${page}&pageSize=${pageSize}`
      );

      const result = await response.json();

      if (result.code === 0) {
        // Try both 'docs' and 'documents' fields
        const docs = result.data.docs || result.data.documents || [];
        
        runInAction(() => {
          this.setDocs(docs);
          this.setTotalDocs(result.data.total || 0);
          this.setCurrentPage(page);
          this.setPageSize(pageSize);
          this.setSelectedDatabase(database);
          this.setSelectedCollection(collection);
        });
        return { code: 0, data: result.data };
      } else {
        runInAction(() => {
          this.setError(result.message || 'Failed to fetch documents');
        });
        return { code: -1, message: result.message };
      }
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      runInAction(() => {
        this.setError(error.message || 'Network error');
      });
      return { code: -2, message: error.message };
    } finally {
      runInAction(() => {
        this.setLoading(false);
      });
    }
  }

  // ========== Delete Document ==========

  /**
   * Delete a document from backend and remove from store
   */
  async deleteDoc(database, collection, docId) {
    try {
      const backendUrl = getBackendServerUrl();
      const response = await fetch(
        `${backendUrl}/mongo/db/${encodeURIComponent(database)}/coll/${encodeURIComponent(collection)}/docs/${encodeURIComponent(docId)}`,
        {
          method: 'DELETE'
        }
      );

      const result = await response.json();

      if (result.code === 0) {
        runInAction(() => {
          this.removeDoc(docId);
          // Update total count
          this.setTotalDocs(Math.max(0, this.totalDocs - 1));
        });
        return { code: 0, message: 'Document deleted successfully' };
      } else {
        return { code: -1, message: result.message || 'Failed to delete document' };
      }
    } catch (error) {
      console.error('Failed to delete document:', error);
      return { code: -2, message: error.message || 'Network error' };
    }
  }
}

// Create singleton instance
const mongoDocStore = new MongoDocStore();

export default mongoDocStore;
