/**
 * Web Worker Manager for processing chess games in background
 * Handles communication with the game-processor-worker.js
 */

class GameProcessorWorker {
  constructor() {
    this.worker = null;
    this.isProcessing = false;
    this.messageId = 0;
    this.pendingMessages = new Map();
  }

  async initialize() {
    if (this.worker) {
      return;
    }

    try {
      this.worker = new Worker('/game-processor-worker.js');
      
      this.worker.addEventListener('message', (event) => {
        this.handleWorkerMessage(event.data);
      });
      
      this.worker.addEventListener('error', (error) => {
        console.error('Worker error:', error);
        this.isProcessing = false;
      });

      console.log('🔧 GameProcessorWorker initialized successfully');
    } catch (error) {
      console.error('Failed to initialize GameProcessorWorker:', error);
      throw error;
    }
  }

  handleWorkerMessage(message) {
    const { type, data } = message;

    // Handle messages with specific IDs
    if (data?.id && this.pendingMessages.has(data.id)) {
      const resolver = this.pendingMessages.get(data.id);
      resolver(data);
      this.pendingMessages.delete(data.id);
      return;
    }

    // Handle broadcast messages
    switch (type) {
      case 'PROGRESS':
        if (this.onProgress) {
          this.onProgress(data);
        }
        break;
        
      case 'COMPLETE':
        this.isProcessing = false;
        if (this.onComplete) {
          this.onComplete(data);
        }
        break;
        
      case 'ERROR':
        this.isProcessing = false;
        console.error('Worker processing error:', data.error);
        if (this.onError) {
          this.onError(new Error(data.error));
        }
        break;
        
      case 'INIT_COMPLETE':
        if (this.onInitComplete) {
          this.onInitComplete();
        }
        break;
    }
  }

  async processGames(games, username, platform, options = {}) {
    if (!this.worker) {
      await this.initialize();
    }

    if (this.isProcessing) {
      throw new Error('Worker is already processing games');
    }

    this.isProcessing = true;
    this.onProgress = options.onProgress;
    this.onComplete = options.onComplete;
    this.onError = options.onError;

    console.log(`🚀 Starting worker processing of ${games.length} games`);

    return new Promise((resolve, reject) => {
      const originalOnComplete = this.onComplete;
      const originalOnError = this.onError;

      this.onComplete = (data) => {
        if (originalOnComplete) {
          originalOnComplete(data);
        }
        resolve(data);
      };

      this.onError = (error) => {
        if (originalOnError) {
          originalOnError(error);
        }
        reject(error);
      };

      this.worker.postMessage({
        type: 'PROCESS_GAMES',
        data: {
          games,
          username,
          platform,
          startIndex: 0
        }
      });
    });
  }

  async identifyOpening(moves) {
    if (!this.worker) {
      await this.initialize();
    }

    const messageId = ++this.messageId;
    
    return new Promise((resolve) => {
      this.pendingMessages.set(messageId, resolve);
      
      this.worker.postMessage({
        type: 'IDENTIFY_OPENING',
        data: { id: messageId, moves }
      });
    });
  }

  stop() {
    if (this.worker && this.isProcessing) {
      this.worker.terminate();
      this.worker = null;
      this.isProcessing = false;
      this.pendingMessages.clear();
      console.log('🛑 GameProcessorWorker stopped');
    }
  }

  getStatus() {
    return {
      isProcessing: this.isProcessing,
      hasWorker: !!this.worker
    };
  }
}

// Export singleton instance
export const gameProcessorWorker = new GameProcessorWorker();
export default GameProcessorWorker;