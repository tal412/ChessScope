/**
 * BackgroundProcessor - Ensures tasks continue running even when tab is not active
 * Uses multiple strategies to overcome browser throttling of background tabs
 */

class BackgroundProcessor {
  constructor() {
    this.isRunning = false;
    this.currentTask = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    
    // Track visibility changes
    this.wasBackground = false;
    this.backgroundStartTime = null;
    this.foregroundResumeTime = null;
    
    // Performance tracking
    this.processedCount = 0;
    this.totalCount = 0;
    this.startTime = null;
    
    // Setup visibility change listeners
    this.setupVisibilityTracking();
    
    // Use multiple strategies to keep processing alive
    this.setupKeepAlive();
  }
  
  setupVisibilityTracking() {
    document.addEventListener('visibilitychange', () => {
      const isBackground = document.hidden;
      
      if (isBackground && !this.wasBackground) {
        // Tab became hidden
        this.wasBackground = true;
        this.backgroundStartTime = Date.now();
        
        if (this.isRunning) {
          // Activate aggressive keep-alive when in background
          this.activateBackgroundMode();
        }
      } else if (!isBackground && this.wasBackground) {
        // Tab became visible
        this.wasBackground = false;
        this.foregroundResumeTime = Date.now();
        
        if (this.backgroundStartTime) {
          const backgroundDuration = this.foregroundResumeTime - this.backgroundStartTime;
        }
        
        if (this.isRunning) {
          this.deactivateBackgroundMode();
        }
      }
    });
  }
  
  setupKeepAlive() {
    // Strategy 1: Use Web Audio API to prevent throttling
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.keepAliveOscillator = null;
    } catch (e) {
    }
    
    // Strategy 2: Minimal service worker simulation with shared worker if available
    if (typeof SharedWorker !== 'undefined') {
      try {
        // Create a simple data URL worker for timing
        const workerScript = `
          let interval;
          onconnect = function(e) {
            const port = e.ports[0];
            port.onmessage = function(msg) {
              if (msg.data === 'start') {
                interval = setInterval(() => {
                  port.postMessage('tick');
                }, 100);
              } else if (msg.data === 'stop') {
                clearInterval(interval);
              }
            };
          }
        `;
        const blob = new Blob([workerScript], { type: 'application/javascript' });
        const workerUrl = URL.createObjectURL(blob);
        
        this.sharedWorker = new SharedWorker(workerUrl);
        this.sharedWorker.port.onmessage = () => {
          // Silent tick to maintain activity
        };
      } catch (e) {
      }
    }
  }
  
  activateBackgroundMode() {
    
    // Strategy 1: Silent audio to prevent throttling
    if (this.audioContext && !this.keepAliveOscillator) {
      try {
        this.keepAliveOscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        gainNode.gain.value = 0; // Silent
        this.keepAliveOscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        this.keepAliveOscillator.frequency.value = 20000; // Inaudible frequency
        this.keepAliveOscillator.start();
      } catch (e) {
      }
    }
    
    // Strategy 2: Start shared worker keep-alive
    if (this.sharedWorker) {
      this.sharedWorker.port.postMessage('start');
    }
    
    // Strategy 3: More frequent yielding in background
    this.backgroundYieldInterval = 5; // Yield more often
  }
  
  deactivateBackgroundMode() {
    
    // Stop audio keep-alive
    if (this.keepAliveOscillator) {
      try {
        this.keepAliveOscillator.stop();
        this.keepAliveOscillator = null;
      } catch (e) {
      }
    }
    
    // Stop shared worker keep-alive
    if (this.sharedWorker) {
      this.sharedWorker.port.postMessage('stop');
    }
    
    // Reset to normal yielding
    this.backgroundYieldInterval = null;
  }
  
  async processArray(items, processor, options = {}) {
    const {
      onProgress,
      onComplete,
      onError,
      batchSize = 1,
      yieldEvery = 10,
      backgroundYieldEvery = 5
    } = options;
    
    if (this.isRunning) {
      throw new Error('BackgroundProcessor is already running');
    }
    
    this.isRunning = true;
    this.currentTask = { items, processor, options };
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;
    
    this.processedCount = 0;
    this.totalCount = items.length;
    this.startTime = Date.now();
    
    
    try {
      const results = [];
      
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        
        // Process batch
        for (const item of batch) {
          try {
            const result = await processor(item, i);
            results.push(result);
            this.processedCount++;
            
            // Report progress
            if (this.onProgress) {
              this.onProgress({
                processed: this.processedCount,
                total: this.totalCount,
                percentage: Math.round((this.processedCount / this.totalCount) * 100),
                item: result,
                isBackground: this.wasBackground
              });
            }
          } catch (error) {
            console.error(`Error processing item ${i}:`, error);
            if (this.onError) {
              this.onError(error, item, i);
            }
            // Continue with other items
          }
        }
        
        // Smart yielding based on background state
        const shouldYield = this.wasBackground ? 
          (i % 1 === 0) : // Yield after every single item in background for maximum speed
          (i % yieldEvery === 0);
        
        if (shouldYield) {
          await this.smartYield();
        }
      }
      
      // Processing complete
      const duration = Date.now() - this.startTime;
      
      if (this.onComplete) {
        this.onComplete({
          results,
          processed: this.processedCount,
          total: this.totalCount,
          duration,
          wasBackground: this.wasBackground
        });
      }
      
      return results;
      
    } catch (error) {
      console.error('Background processing failed:', error);
      if (this.onError) {
        this.onError(error);
      }
      throw error;
    } finally {
      this.cleanup();
    }
  }
  
  async smartYield() {
    return new Promise(resolve => {
      if (this.wasBackground) {
        // In background: use immediate yielding - no throttling
        if (typeof MessageChannel !== 'undefined') {
          // Use MessageChannel for immediate task scheduling
          const channel = new MessageChannel();
          channel.port1.onmessage = () => resolve();
          channel.port2.postMessage(null);
        } else {
          // Fallback to immediate timeout
          setTimeout(resolve, 0);
        }
      } else {
        // In foreground: minimal yielding for responsiveness
        setTimeout(resolve, 1);
      }
    });
  }
  
  stop() {
    this.cleanup();
  }
  
  cleanup() {
    this.isRunning = false;
    this.currentTask = null;
    this.onProgress = null;
    this.onComplete = null;
    this.onError = null;
    this.processedCount = 0;
    this.totalCount = 0;
    
    this.deactivateBackgroundMode();
  }
  
  getStatus() {
    return {
      isRunning: this.isRunning,
      processed: this.processedCount,
      total: this.totalCount,
      percentage: this.totalCount > 0 ? Math.round((this.processedCount / this.totalCount) * 100) : 0,
      isBackground: this.wasBackground
    };
  }
}

// Export singleton instance
export const backgroundProcessor = new BackgroundProcessor();
export default BackgroundProcessor;