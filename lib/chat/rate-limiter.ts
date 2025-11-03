// Rate Limiter para Google Gemini API
// ====================================

interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerDay: number;
  tokensPerDay?: number;
}

interface RequestLog {
  timestamp: number;
  tokens?: number;
}

class GeminiRateLimiter {
  private requestsPerMinute: number = 15; // Free tier default
  private requestsPerDay: number = 1500; // Free tier default
  private recentRequests: RequestLog[] = [];
  private dailyRequests: RequestLog[] = [];
  private queue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  private processing = false;

  constructor(config?: RateLimitConfig) {
    if (config) {
      this.requestsPerMinute = config.requestsPerMinute;
      this.requestsPerDay = config.requestsPerDay;
    }
    
    // Limpiar logs antiguos cada minuto
    setInterval(() => this.cleanOldLogs(), 60000);
  }

  private cleanOldLogs() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const oneDayAgo = now - 86400000;

    this.recentRequests = this.recentRequests.filter(
      log => log.timestamp > oneMinuteAgo
    );

    this.dailyRequests = this.dailyRequests.filter(
      log => log.timestamp > oneDayAgo
    );
  }

  private canMakeRequest(): boolean {
    this.cleanOldLogs();
    
    const requestsLastMinute = this.recentRequests.length;
    const requestsToday = this.dailyRequests.length;

    return requestsLastMinute < this.requestsPerMinute && 
           requestsToday < this.requestsPerDay;
  }

  private getWaitTime(): number {
    this.cleanOldLogs();
    
    const requestsLastMinute = this.recentRequests.length;
    
    if (requestsLastMinute >= this.requestsPerMinute) {
      const oldestRequest = this.recentRequests[0];
      const timeSinceOldest = Date.now() - oldestRequest.timestamp;
      return Math.max(0, 60000 - timeSinceOldest); // Esperar hasta que pase 1 minuto
    }

    return 0;
  }

  async waitForCapacity(): Promise<void> {
    if (this.canMakeRequest()) {
      return;
    }

    return new Promise((resolve, reject) => {
      const waitTime = this.getWaitTime();
      
      if (waitTime > 0) {
        console.log(`⏳ [RATE-LIMITER] Esperando ${Math.ceil(waitTime / 1000)}s por límite de tasa...`);
        setTimeout(() => {
          this.waitForCapacity().then(resolve).catch(reject);
        }, waitTime);
      } else {
        // Si no hay capacidad pero no hay wait time específico, esperar un poco
        setTimeout(() => {
          this.waitForCapacity().then(resolve).catch(reject);
        }, 1000);
      }
    });
  }

  async recordRequest(tokens?: number): Promise<void> {
    const now = Date.now();
    const log: RequestLog = { timestamp: now, tokens };

    this.recentRequests.push(log);
    this.dailyRequests.push(log);

    console.log(`📊 [RATE-LIMITER] Request registrado. Último minuto: ${this.recentRequests.length}/${this.requestsPerMinute}, Hoy: ${this.dailyRequests.length}/${this.requestsPerDay}`);
  }

  getStats() {
    this.cleanOldLogs();
    return {
      requestsLastMinute: this.recentRequests.length,
      requestsPerMinuteLimit: this.requestsPerMinute,
      requestsToday: this.dailyRequests.length,
      requestsPerDayLimit: this.requestsPerDay,
      canMakeRequest: this.canMakeRequest(),
      waitTime: this.getWaitTime()
    };
  }
}

// Singleton instance
export const geminiRateLimiter = new GeminiRateLimiter({
  requestsPerMinute: 15, // Free tier
  requestsPerDay: 1500  // Free tier
});

// Helper para ejecutar con rate limiting
export async function executeWithRateLimit<T>(
  fn: () => Promise<T>,
  tokens?: number
): Promise<T> {
  await geminiRateLimiter.waitForCapacity();
  const result = await fn();
  await geminiRateLimiter.recordRequest(tokens);
  return result;
}

