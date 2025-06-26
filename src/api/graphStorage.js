// Storage manager for OpeningGraph using IndexedDB
// This replaces the old approach of storing thousands of individual games and nodes

import { OpeningGraph } from './openingGraph.js';

const DB_NAME = 'ChessScopeGraph';
const DB_VERSION = 1;
const GRAPHS_STORE = 'opening_graphs';

let db = null;

// Initialize IndexedDB for graph storage
export const initGraphDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      console.log('Graph database initialized successfully');
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const database = event.target.result;
      
      // Create opening graphs store
      if (!database.objectStoreNames.contains(GRAPHS_STORE)) {
        const graphStore = database.createObjectStore(GRAPHS_STORE, { keyPath: 'username' });
        graphStore.createIndex('username', 'username', { unique: true });
        graphStore.createIndex('lastUpdated', 'lastUpdated', { unique: false });
      }
    };
  });
};

// Save an OpeningGraph to storage
export const saveOpeningGraph = async (openingGraph) => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readwrite');
    const store = transaction.objectStore(GRAPHS_STORE);
    
    const graphData = {
      username: openingGraph.username,
      data: openingGraph.serialize(),
      lastUpdated: new Date().toISOString(),
      stats: openingGraph.getOverallStats()
    };
    
    const request = store.put(graphData);
    
    request.onsuccess = () => {
      console.log(`Opening graph saved for user: ${openingGraph.username}`);
      resolve(graphData);
    };
    
    request.onerror = () => reject(request.error);
  });
};

// Load an OpeningGraph from storage
export const loadOpeningGraph = async (username) => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readonly');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.get(username);
    
    request.onsuccess = () => {
      const result = request.result;
      if (result) {
        try {
          const openingGraph = OpeningGraph.deserialize(result.data);
          console.log(`Opening graph loaded for user: ${username}`);
          resolve(openingGraph);
        } catch (error) {
          console.error('Error deserializing graph:', error);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
};

// Check if a graph exists for a user
export const hasOpeningGraph = async (username) => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readonly');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.count(IDBKeyRange.only(username));
    
    request.onsuccess = () => resolve(request.result > 0);
    request.onerror = () => reject(request.error);
  });
};

// Delete a graph for a user
export const deleteOpeningGraph = async (username) => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readwrite');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.delete(username);
    
    request.onsuccess = () => {
      console.log(`Opening graph deleted for user: ${username}`);
      resolve(true);
    };
    
    request.onerror = () => reject(request.error);
  });
};

// Get storage statistics
export const getGraphStorageStats = async () => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readonly');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const graphs = request.result;
      const totalSize = graphs.reduce((size, graph) => {
        return size + new Blob([JSON.stringify(graph.data)]).size;
      }, 0);
      
      resolve({
        totalGraphs: graphs.length,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSize / 1024 / 1024 * 100) / 100,
        graphs: graphs.map(g => ({
          username: g.username,
          lastUpdated: g.lastUpdated,
          stats: g.stats
        }))
      });
    };
    
    request.onerror = () => reject(request.error);
  });
};

// Export all graphs as a backup
export const exportAllGraphs = async () => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readonly');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const graphs = request.result;
      
      const exportData = {
        exportDate: new Date().toISOString(),
        version: '1.0',
        graphs: graphs,
        metadata: {
          totalGraphs: graphs.length,
          appVersion: "3.0.0-graph"
        }
      };
      
      const dataString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([dataString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `chesscope-graphs-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      resolve(true);
    };
    
    request.onerror = () => reject(request.error);
  });
};

// Clear all graph data
export const clearAllGraphs = async () => {
  if (!db) {
    await initGraphDB();
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction([GRAPHS_STORE], 'readwrite');
    const store = transaction.objectStore(GRAPHS_STORE);
    const request = store.clear();
    
    request.onsuccess = () => {
      console.log('All opening graphs cleared');
      resolve(true);
    };
    
    request.onerror = () => reject(request.error);
  });
}; 