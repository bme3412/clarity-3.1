class RequestDeduplication {
  constructor() {
    this.pendingRequests = new Map();
    this.requestTimeout = 30000; // 30 seconds
  }

  // Generate a unique key for a request
  generateKey(company, fiscalYear, quarter, requestType = 'financial') {
    return `${requestType}_${company}_FY${fiscalYear}_Q${quarter}`;
  }

  // Check if a request is already pending
  isPending(company, fiscalYear, quarter, requestType = 'financial') {
    const key = this.generateKey(company, fiscalYear, quarter, requestType);
    const pending = this.pendingRequests.get(key);
    
    if (pending && (Date.now() - pending.timestamp) < this.requestTimeout) {
      return pending.promise;
    }
    
    // Remove expired pending request
    if (pending) {
      this.pendingRequests.delete(key);
    }
    
    return null;
  }

  // Add a pending request
  addPending(company, fiscalYear, quarter, promise, requestType = 'financial') {
    const key = this.generateKey(company, fiscalYear, quarter, requestType);
    
    this.pendingRequests.set(key, {
      promise,
      timestamp: Date.now()
    });
    
    // Clean up when promise resolves or rejects
    promise.finally(() => {
      this.pendingRequests.delete(key);
    });
    
    return promise;
  }

  // Execute a request with deduplication
  async executeWithDeduplication(company, fiscalYear, quarter, requestFn, requestType = 'financial') {
    // Check if request is already pending
    const existingPromise = this.isPending(company, fiscalYear, quarter, requestType);
    if (existingPromise) {
      console.log(`[RequestDeduplication] Reusing pending request for ${company} FY${fiscalYear} ${quarter}`);
      return existingPromise;
    }
    
    // Execute new request
    console.log(`[RequestDeduplication] Starting new request for ${company} FY${fiscalYear} ${quarter}`);
    const promise = requestFn();
    return this.addPending(company, fiscalYear, quarter, promise, requestType);
  }

  // Cleanup expired pending requests
  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.pendingRequests.entries()) {
      if (now - value.timestamp > this.requestTimeout) {
        this.pendingRequests.delete(key);
      }
    }
  }

  // Get stats
  getStats() {
    return {
      pendingCount: this.pendingRequests.size,
      pendingKeys: Array.from(this.pendingRequests.keys())
    };
  }
}

// Export singleton instance
export const requestDeduplication = new RequestDeduplication(); 