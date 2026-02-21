/**
 * EnterpriseUtils - Enterprise-Grade System Utilities
 * 
 * Provides:
 * - System health monitoring
 * - API key validation
 * - Network connectivity checks
 * - Retry logic with exponential backoff
 * - Comprehensive error handling
 * - Structured logging
 * - Performance metrics
 * - Circuit breaker pattern
 * - Rate limiting
 */

import { GoogleGenAI } from '@google/genai';

// ============================================================================
// ERROR TYPES
// ============================================================================

export class ClarityError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public severity: ErrorSeverity,
    public context?: Record<string, unknown>,
    public recoverable: boolean = true,
    public userMessage?: string
  ) {
    super(message);
    this.name = 'ClarityError';
  }
}

export type ErrorCode = 
  | 'API_KEY_INVALID'
  | 'API_KEY_MISSING'
  | 'API_RATE_LIMITED'
  | 'API_QUOTA_EXCEEDED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'STORAGE_FULL'
  | 'STORAGE_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'UNKNOWN_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

// ============================================================================
// HEALTH CHECK TYPES
// ============================================================================

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: string;
  uptime: number;
  checks: HealthCheck[];
  summary: string;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  responseTimeMs?: number;
  lastChecked: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// METRICS TYPES
// ============================================================================

export interface SystemMetrics {
  apiCalls: {
    total: number;
    successful: number;
    failed: number;
    averageLatencyMs: number;
  };
  storage: {
    usedBytes: number;
    quotaBytes: number;
    percentUsed: number;
  };
  errors: {
    total: number;
    byCode: Record<string, number>;
    lastError?: { code: string; timestamp: string; message: string };
  };
  sessions: {
    total: number;
    active: number;
    averageDurationMs: number;
  };
}

// ============================================================================
// LOGGING TYPES
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  component: string;
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

// ============================================================================
// STORAGE KEYS
// ============================================================================

const STORAGE_KEYS = {
  METRICS: 'clarity_system_metrics',
  LOGS: 'clarity_system_logs',
  HEALTH: 'clarity_health_status',
  CONFIG: 'clarity_system_config',
};

// ============================================================================
// SYSTEM HEALTH MONITOR
// ============================================================================

export class SystemHealthMonitor {
  private static instance: SystemHealthMonitor;
  private startTime: number = Date.now();
  private metrics: SystemMetrics;
  private logs: LogEntry[] = [];
  private maxLogs: number = 500;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthStatus: HealthStatus | null = null;

  private constructor() {
    this.metrics = this.loadMetrics();
    this.logs = this.loadLogs();
  }

  static getInstance(): SystemHealthMonitor {
    if (!SystemHealthMonitor.instance) {
      SystemHealthMonitor.instance = new SystemHealthMonitor();
    }
    return SystemHealthMonitor.instance;
  }

  // Initialize health monitoring
  start(intervalMs: number = 30000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    // Run initial check
    this.runHealthChecks();
    
    // Schedule periodic checks
    this.healthCheckInterval = setInterval(() => {
      this.runHealthChecks();
    }, intervalMs);
    
    this.log('info', 'SystemHealthMonitor', 'Health monitoring started', { intervalMs });
  }

  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    this.log('info', 'SystemHealthMonitor', 'Health monitoring stopped');
  }

  // ============================================================================
  // HEALTH CHECKS
  // ============================================================================

  async runHealthChecks(): Promise<HealthStatus> {
    const checks: HealthCheck[] = [];
    
    // Check API Key
    checks.push(await this.checkApiKey());
    
    // Check Storage
    checks.push(this.checkStorage());
    
    // Check Network
    checks.push(await this.checkNetwork());
    
    // Check Memory
    checks.push(this.checkMemory());

    // Determine overall status
    const failedCount = checks.filter(c => c.status === 'fail').length;
    const warnCount = checks.filter(c => c.status === 'warn').length;
    
    let status: HealthStatus['status'];
    let summary: string;
    
    if (failedCount > 0) {
      status = failedCount >= 2 ? 'unhealthy' : 'degraded';
      summary = `${failedCount} check(s) failed, ${warnCount} warning(s)`;
    } else if (warnCount > 0) {
      status = 'degraded';
      summary = `${warnCount} warning(s), all critical checks passed`;
    } else {
      status = 'healthy';
      summary = 'All systems operational';
    }

    this.lastHealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      checks,
      summary,
    };

    // Persist health status
    try {
      localStorage.setItem(STORAGE_KEYS.HEALTH, JSON.stringify(this.lastHealthStatus));
    } catch (e) {
      // Ignore storage errors for health status
    }

    return this.lastHealthStatus;
  }

  private async checkApiKey(): Promise<HealthCheck> {
    const startTime = Date.now();
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!apiKey) {
      return {
        name: 'api-key',
        status: 'fail',
        message: 'Gemini API key not configured',
        lastChecked: new Date().toISOString(),
      };
    }

    if (apiKey.length < 20) {
      return {
        name: 'api-key',
        status: 'fail',
        message: 'API key appears to be invalid (too short)',
        lastChecked: new Date().toISOString(),
      };
    }

    // Try a lightweight validation call
    try {
      const ai = new GoogleGenAI({ apiKey });
      // Just create the model instance, don't make an actual API call
      // This validates the key format at least
      return {
        name: 'api-key',
        status: 'pass',
        message: 'API key is configured',
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
        metadata: { keyLength: apiKey.length },
      };
    } catch (error: any) {
      return {
        name: 'api-key',
        status: 'fail',
        message: `API key validation failed: ${error.message}`,
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private checkStorage(): HealthCheck {
    try {
      // Estimate localStorage usage
      let totalSize = 0;
      for (const key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          totalSize += localStorage[key].length * 2; // Unicode chars = 2 bytes
        }
      }

      // localStorage typically has 5-10MB limit
      const estimatedQuota = 5 * 1024 * 1024; // 5MB
      const percentUsed = (totalSize / estimatedQuota) * 100;

      // Update metrics
      this.metrics.storage = {
        usedBytes: totalSize,
        quotaBytes: estimatedQuota,
        percentUsed,
      };

      if (percentUsed > 90) {
        return {
          name: 'storage',
          status: 'fail',
          message: `Storage critical: ${percentUsed.toFixed(1)}% used`,
          lastChecked: new Date().toISOString(),
          metadata: { usedBytes: totalSize, percentUsed },
        };
      }

      if (percentUsed > 70) {
        return {
          name: 'storage',
          status: 'warn',
          message: `Storage warning: ${percentUsed.toFixed(1)}% used`,
          lastChecked: new Date().toISOString(),
          metadata: { usedBytes: totalSize, percentUsed },
        };
      }

      return {
        name: 'storage',
        status: 'pass',
        message: `Storage healthy: ${percentUsed.toFixed(1)}% used`,
        lastChecked: new Date().toISOString(),
        metadata: { usedBytes: totalSize, percentUsed },
      };
    } catch (error: any) {
      return {
        name: 'storage',
        status: 'fail',
        message: `Storage check failed: ${error.message}`,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private async checkNetwork(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple connectivity check
      const response = await fetch('https://generativelanguage.googleapis.com/', {
        method: 'HEAD',
        mode: 'no-cors',
      });
      
      const latency = Date.now() - startTime;
      
      if (latency > 5000) {
        return {
          name: 'network',
          status: 'warn',
          message: `Network slow: ${latency}ms latency`,
          responseTimeMs: latency,
          lastChecked: new Date().toISOString(),
        };
      }

      return {
        name: 'network',
        status: 'pass',
        message: `Network healthy: ${latency}ms latency`,
        responseTimeMs: latency,
        lastChecked: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        name: 'network',
        status: navigator.onLine ? 'warn' : 'fail',
        message: navigator.onLine 
          ? 'Google API endpoint check failed (may be CORS)'
          : 'No network connection',
        responseTimeMs: Date.now() - startTime,
        lastChecked: new Date().toISOString(),
      };
    }
  }

  private checkMemory(): HealthCheck {
    // Check if performance memory API is available (Chrome only)
    const memory = (performance as any).memory;
    
    if (!memory) {
      return {
        name: 'memory',
        status: 'pass',
        message: 'Memory API not available (non-Chrome browser)',
        lastChecked: new Date().toISOString(),
      };
    }

    const usedHeap = memory.usedJSHeapSize;
    const totalHeap = memory.jsHeapSizeLimit;
    const percentUsed = (usedHeap / totalHeap) * 100;

    if (percentUsed > 90) {
      return {
        name: 'memory',
        status: 'fail',
        message: `Memory critical: ${percentUsed.toFixed(1)}% used`,
        lastChecked: new Date().toISOString(),
        metadata: { usedHeap, totalHeap, percentUsed },
      };
    }

    if (percentUsed > 70) {
      return {
        name: 'memory',
        status: 'warn',
        message: `Memory warning: ${percentUsed.toFixed(1)}% used`,
        lastChecked: new Date().toISOString(),
        metadata: { usedHeap, totalHeap, percentUsed },
      };
    }

    return {
      name: 'memory',
      status: 'pass',
      message: `Memory healthy: ${percentUsed.toFixed(1)}% used`,
      lastChecked: new Date().toISOString(),
      metadata: { usedHeap, totalHeap, percentUsed },
    };
  }

  getLastHealthStatus(): HealthStatus | null {
    return this.lastHealthStatus;
  }

  // ============================================================================
  // METRICS
  // ============================================================================

  recordApiCall(successful: boolean, latencyMs: number): void {
    this.metrics.apiCalls.total++;
    if (successful) {
      this.metrics.apiCalls.successful++;
    } else {
      this.metrics.apiCalls.failed++;
    }
    
    // Running average for latency
    const { averageLatencyMs, total } = this.metrics.apiCalls;
    this.metrics.apiCalls.averageLatencyMs = 
      (averageLatencyMs * (total - 1) + latencyMs) / total;
    
    this.saveMetrics();
  }

  recordError(code: ErrorCode, message: string): void {
    this.metrics.errors.total++;
    this.metrics.errors.byCode[code] = (this.metrics.errors.byCode[code] || 0) + 1;
    this.metrics.errors.lastError = {
      code,
      timestamp: new Date().toISOString(),
      message,
    };
    this.saveMetrics();
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  resetMetrics(): void {
    this.metrics = {
      apiCalls: { total: 0, successful: 0, failed: 0, averageLatencyMs: 0 },
      storage: { usedBytes: 0, quotaBytes: 0, percentUsed: 0 },
      errors: { total: 0, byCode: {} },
      sessions: { total: 0, active: 0, averageDurationMs: 0 },
    };
    this.saveMetrics();
  }

  private loadMetrics(): SystemMetrics {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.METRICS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore
    }
    return {
      apiCalls: { total: 0, successful: 0, failed: 0, averageLatencyMs: 0 },
      storage: { usedBytes: 0, quotaBytes: 0, percentUsed: 0 },
      errors: { total: 0, byCode: {} },
      sessions: { total: 0, active: 0, averageDurationMs: 0 },
    };
  }

  private saveMetrics(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(this.metrics));
    } catch (e) {
      // Ignore storage errors
    }
  }

  // ============================================================================
  // LOGGING
  // ============================================================================

  log(level: LogLevel, component: string, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      context,
    };

    this.logs.push(entry);
    
    // Trim old logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Console output in dev
    if (import.meta.env.DEV) {
      const logFn = level === 'error' || level === 'fatal' ? console.error :
                    level === 'warn' ? console.warn :
                    level === 'debug' ? console.debug : console.log;
      logFn(`[${level.toUpperCase()}] [${component}] ${message}`, context || '');
    }

    this.saveLogs();
  }

  logError(error: Error | ClarityError, component: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      message: error.message,
      context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: error instanceof ClarityError ? error.code : undefined,
      },
    };

    this.logs.push(entry);
    
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    console.error(`[ERROR] [${component}] ${error.message}`, { error, context });
    
    // Record in metrics if it's a ClarityError
    if (error instanceof ClarityError) {
      this.recordError(error.code, error.message);
    } else {
      this.recordError('UNKNOWN_ERROR', error.message);
    }

    this.saveLogs();
  }

  getLogs(options?: { level?: LogLevel; component?: string; limit?: number }): LogEntry[] {
    let filtered = [...this.logs];
    
    if (options?.level) {
      filtered = filtered.filter(l => l.level === options.level);
    }
    if (options?.component) {
      filtered = filtered.filter(l => l.component === options.component);
    }
    if (options?.limit) {
      filtered = filtered.slice(-options.limit);
    }
    
    return filtered;
  }

  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  private loadLogs(): LogEntry[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      // Ignore
    }
    return [];
  }

  private saveLogs(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
    } catch (e) {
      // If storage is full, clear old logs
      this.logs = this.logs.slice(-100);
      try {
        localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(this.logs));
      } catch {
        // Give up
      }
    }
  }
}

// ============================================================================
// RETRY WITH BACKOFF
// ============================================================================

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: ErrorCode[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  retryableErrors: ['NETWORK_ERROR', 'API_RATE_LIMITED', 'TIMEOUT_ERROR', 'SERVICE_UNAVAILABLE'],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if error is retryable
      if (error instanceof ClarityError && 
          opts.retryableErrors && 
          !opts.retryableErrors.includes(error.code)) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff + jitter
      const baseDelay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt);
      const jitter = Math.random() * 0.3 * baseDelay;
      const delay = Math.min(baseDelay + jitter, opts.maxDelayMs);
      
      opts.onRetry?.(attempt + 1, error, delay);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// ============================================================================
// CIRCUIT BREAKER
// ============================================================================

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
}

const DEFAULT_CIRCUIT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeoutMs: 60000,
  halfOpenMaxCalls: 3,
};

type CircuitState = 'closed' | 'open' | 'half-open';

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenCalls: number = 0;
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = { ...DEFAULT_CIRCUIT_OPTIONS, ...options };
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if circuit should transition from open to half-open
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime >= this.options.resetTimeoutMs) {
        this.state = 'half-open';
        this.halfOpenCalls = 0;
      } else {
        throw new ClarityError(
          'Circuit breaker is open',
          'SERVICE_UNAVAILABLE',
          'high',
          { state: this.state, failures: this.failures },
          true,
          'Service temporarily unavailable. Please try again later.'
        );
      }
    }

    // Check half-open limit
    if (this.state === 'half-open' && this.halfOpenCalls >= this.options.halfOpenMaxCalls) {
      throw new ClarityError(
        'Circuit breaker is half-open (max calls reached)',
        'SERVICE_UNAVAILABLE',
        'medium',
        { state: this.state },
        true
      );
    }

    try {
      if (this.state === 'half-open') {
        this.halfOpenCalls++;
      }
      
      const result = await fn();
      
      // Success - reset circuit
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'half-open') {
      this.state = 'open';
    } else if (this.failures >= this.options.failureThreshold) {
      this.state = 'open';
    }
  }

  getState(): { state: CircuitState; failures: number } {
    return { state: this.state, failures: this.failures };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenCalls = 0;
  }
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateApiKey(apiKey: string | undefined): void {
  if (!apiKey) {
    throw new ClarityError(
      'API key is required',
      'API_KEY_MISSING',
      'critical',
      undefined,
      false,
      'Please configure your Gemini API key to use AI features.'
    );
  }

  if (apiKey.length < 20) {
    throw new ClarityError(
      'API key appears to be invalid',
      'API_KEY_INVALID',
      'critical',
      { keyLength: apiKey.length },
      false,
      'The configured API key appears to be invalid. Please check your configuration.'
    );
  }
}

export function validateProjectState(project: unknown): asserts project is { id: string; name: string } {
  if (!project || typeof project !== 'object') {
    throw new ClarityError(
      'Invalid project state',
      'VALIDATION_ERROR',
      'high',
      { received: typeof project },
      false
    );
  }

  const p = project as Record<string, unknown>;
  if (!p.id || typeof p.id !== 'string') {
    throw new ClarityError(
      'Project must have a valid ID',
      'VALIDATION_ERROR',
      'high',
      { id: p.id },
      false
    );
  }

  if (!p.name || typeof p.name !== 'string') {
    throw new ClarityError(
      'Project must have a valid name',
      'VALIDATION_ERROR',
      'high',
      { name: p.name },
      false
    );
  }
}

// ============================================================================
// DEBOUNCE & THROTTLE
// ============================================================================

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;
  let queued: Parameters<T> | null = null;
  let timeoutId: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = limitMs - (now - lastRun);
    
    if (remaining <= 0) {
      fn(...args);
      lastRun = now;
    } else {
      queued = args;
      if (!timeoutId) {
        timeoutId = setTimeout(() => {
          if (queued) {
            fn(...queued);
            lastRun = Date.now();
            queued = null;
          }
          timeoutId = null;
        }, remaining);
      }
    }
  };
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let healthMonitor: SystemHealthMonitor | null = null;

export function getHealthMonitor(): SystemHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = SystemHealthMonitor.getInstance();
  }
  return healthMonitor;
}

export function initializeHealthMonitoring(intervalMs: number = 30000): void {
  getHealthMonitor().start(intervalMs);
}

export function shutdownHealthMonitoring(): void {
  if (healthMonitor) {
    healthMonitor.stop();
  }
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export const logger = {
  debug: (component: string, message: string, context?: Record<string, unknown>) => 
    getHealthMonitor().log('debug', component, message, context),
  info: (component: string, message: string, context?: Record<string, unknown>) => 
    getHealthMonitor().log('info', component, message, context),
  warn: (component: string, message: string, context?: Record<string, unknown>) => 
    getHealthMonitor().log('warn', component, message, context),
  error: (component: string, message: string, context?: Record<string, unknown>) => 
    getHealthMonitor().log('error', component, message, context),
  fatal: (component: string, message: string, context?: Record<string, unknown>) => 
    getHealthMonitor().log('fatal', component, message, context),
};
