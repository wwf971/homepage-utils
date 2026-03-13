import { makeAutoObservable, runInAction } from 'mobx';

class MongoAppFapStore {
  mongoAppsFileAccess = [];
  isLoading = false;
  error = null;

  constructor() {
    makeAutoObservable(this);
  }

  async fetchMongoAppFileAccesses(backendUrl, appId) {
    runInAction(() => {
      this.isLoading = true;
      this.error = null;
    });
    try {
      const res = await fetch(`${backendUrl}/mongo-app/${appId}/file-access-point/list`);
      const result = await res.json();
      runInAction(() => {
        this.isLoading = false;
        if (result.code === 0) {
          this.mongoAppsFileAccess = result.data || [];
        } else {
          this.error = result.message || 'Failed to load';
        }
      });
      return result;
    } catch (err) {
      runInAction(() => {
        this.isLoading = false;
        this.error = err.message;
      });
      return { code: -2, message: err.message };
    }
  }

  async addMongoAppFileAccess(backendUrl, appId, id, fileAccessPointId, path) {
    try {
      const res = await fetch(`${backendUrl}/mongo-app/${appId}/file-access-point/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fileAccessPointId, path }),
      });
      const result = await res.json();
      if (result.code === 0) {
        await this.fetchMongoAppFileAccesses(backendUrl, appId);
      }
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  async removeMongoAppFileAccess(backendUrl, appId, id) {
    try {
      const res = await fetch(`${backendUrl}/mongo-app/${appId}/file-access-point/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      const result = await res.json();
      if (result.code === 0) {
        await this.fetchMongoAppFileAccesses(backendUrl, appId);
      }
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }

  async updateMongoAppFileAccess(backendUrl, appId, id, fileAccessPointId, path) {
    try {
      const res = await fetch(`${backendUrl}/mongo-app/${appId}/file-access-point/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, fileAccessPointId, path }),
      });
      const result = await res.json();
      if (result.code === 0) {
        await this.fetchMongoAppFileAccesses(backendUrl, appId);
      }
      return result;
    } catch (err) {
      return { code: -2, message: err.message };
    }
  }
}

const mongoAppFapStore = new MongoAppFapStore();
export default mongoAppFapStore;
