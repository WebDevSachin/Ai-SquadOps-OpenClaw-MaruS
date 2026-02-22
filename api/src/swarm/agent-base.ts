/**
 * Base Agent Class
 * Provides agent lifecycle management, event emitters, timeout handling,
 * and result aggregation for the swarm orchestration system.
 */

import { EventEmitter } from "events";

// Agent status types
export type AgentStatus = 
  | "initialized"
  | "running"
  | "paused"
  | "completed"
  | "failed"
  | "timeout"
  | "terminated";

// Task definition
export interface AgentTask {
  id: string;
  type: string;
  payload: any;
  timeoutSeconds?: number;
  retries?: number;
  metadata?: Record<string, any>;
}

// Agent execution result
export interface AgentResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: {
    executionTimeMs: number;
    tokensUsed?: number;
    retriesUsed?: number;
  };
}

// Agent configuration
export interface AgentConfig {
  timeoutSeconds?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  logLevel?: "debug" | "info" | "warn" | "error";
}

// Progress update
export interface ProgressUpdate {
  progress: number; // 0-100
  message?: string;
  data?: any;
}

/**
 * Base Agent Class
 * Extend this class to create custom agents for the swarm
 */
export abstract class BaseAgent extends EventEmitter {
  protected id: string;
  protected task: AgentTask;
  protected config: Required<AgentConfig>;
  protected status: AgentStatus = "initialized";
  protected progress: number = 0;
  protected startTime: number = 0;
  protected timeoutHandle?: NodeJS.Timeout;
  protected terminated: boolean = false;
  protected paused: boolean = false;
  protected retryCount: number = 0;
  protected result?: AgentResult;

  // Default configuration
  private static readonly DEFAULT_CONFIG: Required<AgentConfig> = {
    timeoutSeconds: 300,
    maxRetries: 2,
    retryDelayMs: 1000,
    logLevel: "info",
  };

  constructor(task: AgentTask, config: AgentConfig = {}) {
    super();
    this.id = task.id;
    this.task = task;
    this.config = {
      ...BaseAgent.DEFAULT_CONFIG,
      ...config,
    };

    // Override timeout if specified in task
    if (task.timeoutSeconds) {
      this.config.timeoutSeconds = task.timeoutSeconds;
    }

    // Override retries if specified in task
    if (task.retries !== undefined) {
      this.config.maxRetries = task.retries;
    }

    this.log("debug", `Agent ${this.id} initialized`, { task: task.type });
  }

  /**
   * Initialize the agent before execution
   * Override to perform setup tasks
   */
  protected async init(): Promise<void> {
    this.status = "initialized";
    this.emit("init", { agentId: this.id, task: this.task });
  }

  /**
   * Main execution logic
   * MUST be implemented by subclasses
   */
  protected abstract executeTask(): Promise<any>;

  /**
   * Cleanup after execution
   * Override to perform cleanup tasks
   */
  protected async cleanup(): Promise<void> {
    this.clearTimeout();
    this.emit("cleanup", { agentId: this.id });
  }

  /**
   * Execute the agent with full lifecycle management
   */
  async execute(): Promise<AgentResult> {
    if (this.status === "running") {
      throw new Error(`Agent ${this.id} is already running`);
    }

    this.startTime = Date.now();
    this.status = "running";
    this.terminated = false;

    try {
      // Initialize
      await this.init();
      this.log("info", `Agent ${this.id} started`, { task: this.task.type });

      // Set up timeout
      this.setupTimeout();

      // Execute with retry logic
      const data = await this.executeWithRetry();

      // Check if terminated during execution
      if (this.terminated) {
        throw new Error("Agent was terminated");
      }

      // Complete successfully
      this.result = {
        success: true,
        data,
        metadata: {
          executionTimeMs: Date.now() - this.startTime,
          retriesUsed: this.retryCount,
        },
      };

      this.status = "completed";
      this.progress = 100;
      this.emit("complete", { agentId: this.id, result: this.result });
      this.log("info", `Agent ${this.id} completed`, { duration: this.result.metadata?.executionTimeMs });

      return this.result;
    } catch (error) {
      return this.handleError(error);
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Execute with retry logic
   */
  private async executeWithRetry(): Promise<any> {
    let lastError: Error | undefined;

    while (this.retryCount <= this.config.maxRetries) {
      try {
        if (this.retryCount > 0) {
          this.log("info", `Agent ${this.id} retry attempt ${this.retryCount}`);
          await this.delay(this.config.retryDelayMs * this.retryCount);
        }

        return await this.executeTask();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        // Don't retry if terminated
        if (this.terminated) {
          throw lastError;
        }

        this.retryCount++;
        
        // Log retry attempt
        this.log("warn", `Agent ${this.id} failed attempt ${this.retryCount}`, {
          error: lastError.message,
        });
        
        this.emit("retry", {
          agentId: this.id,
          attempt: this.retryCount,
          error: lastError.message,
        });
      }
    }

    throw lastError || new Error("Max retries exceeded");
  }

  /**
   * Handle execution errors
   */
  private handleError(error: unknown): AgentResult {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Determine status based on error type
    if (this.terminated) {
      this.status = "terminated";
    } else if (error instanceof TimeoutError) {
      this.status = "timeout";
    } else {
      this.status = "failed";
    }

    this.result = {
      success: false,
      error: errorMessage,
      metadata: {
        executionTimeMs: Date.now() - this.startTime,
        retriesUsed: this.retryCount,
      },
    };

    this.emit("error", { agentId: this.id, error: errorMessage });
    this.log("error", `Agent ${this.id} failed`, { error: errorMessage });

    return this.result;
  }

  /**
   * Set up timeout handler
   */
  private setupTimeout(): void {
    if (this.config.timeoutSeconds > 0) {
      this.timeoutHandle = setTimeout(() => {
        this.terminate(new TimeoutError(`Agent ${this.id} timed out after ${this.config.timeoutSeconds}s`));
      }, this.config.timeoutSeconds * 1000);
    }
  }

  /**
   * Clear timeout handler
   */
  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = undefined;
    }
  }

  /**
   * Update progress and emit event
   */
  protected updateProgress(progress: number, message?: string, data?: any): void {
    this.progress = Math.min(100, Math.max(0, progress));
    const update: ProgressUpdate = {
      progress: this.progress,
      message,
      data,
    };
    this.emit("progress", update);
    this.log("debug", `Agent ${this.id} progress: ${this.progress}%`, { message });
  }

  /**
   * Terminate the agent
   */
  terminate(reason?: Error): void {
    if (this.status === "completed" || this.status === "failed" || this.status === "terminated") {
      return;
    }

    this.terminated = true;
    this.status = "terminated";
    this.clearTimeout();

    this.emit("terminated", {
      agentId: this.id,
      reason: reason?.message || "Manually terminated",
    });

    this.log("warn", `Agent ${this.id} terminated`, { reason: reason?.message });
  }

  /**
   * Pause the agent (if supported by implementation)
   */
  pause(): void {
    if (this.status === "running") {
      this.paused = true;
      this.emit("paused", { agentId: this.id });
      this.log("info", `Agent ${this.id} paused`);
    }
  }

  /**
   * Resume the agent
   */
  resume(): void {
    if (this.paused) {
      this.paused = false;
      this.emit("resumed", { agentId: this.id });
      this.log("info", `Agent ${this.id} resumed`);
    }
  }

  /**
   * Check if agent is paused
   */
  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Check if agent is terminated
   */
  isTerminated(): boolean {
    return this.terminated;
  }

  /**
   * Get current status
   */
  getStatus(): AgentStatus {
    return this.status;
  }

  /**
   * Get current progress (0-100)
   */
  getProgress(): number {
    return this.progress;
  }

  /**
   * Get the result (if completed)
   */
  getResult(): AgentResult | undefined {
    return this.result;
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.id;
  }

  /**
   * Get task
   */
  getTask(): AgentTask {
    return this.task;
  }

  /**
   * Get execution time in milliseconds
   */
  getExecutionTime(): number {
    if (this.startTime === 0) return 0;
    return Date.now() - this.startTime;
  }

  /**
   * Logging helper
   */
  protected log(level: "debug" | "info" | "warn" | "error", message: string, meta?: any): void {
    const levels: Record<string, number> = { debug: 0, info: 1, warn: 2, error: 3 };
    const configLevel = levels[this.config.logLevel] ?? 1;
    const messageLevel = levels[level] ?? 1;

    if (messageLevel >= configLevel) {
      const timestamp = new Date().toISOString();
      const metaStr = meta ? ` ${JSON.stringify(meta)}` : "";
      console.log(`[${timestamp}] [${level.toUpperCase()}] [Agent:${this.id}] ${message}${metaStr}`);
    }
  }

  /**
   * Delay helper for retries
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate task payload
   * Override to implement custom validation
   */
  protected validatePayload(): boolean {
    return this.task.payload !== undefined && this.task.payload !== null;
  }

  /**
   * Aggregate results from multiple sub-tasks
   */
  protected aggregateResults(results: any[]): any {
    return {
      count: results.length,
      items: results,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Batch process items with progress updates
   */
  protected async batchProcess<T, R>(
    items: T[],
    processor: (item: T, index: number) => Promise<R>,
    batchSize: number = 10
  ): Promise<R[]> {
    const results: R[] = [];
    const total = items.length;

    for (let i = 0; i < total; i += batchSize) {
      // Check for termination
      if (this.terminated || this.paused) {
        throw new Error(this.terminated ? "Agent terminated" : "Agent paused");
      }

      const batch = items.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((item, idx) => processor(item, i + idx))
      );
      results.push(...batchResults);

      // Update progress
      const progress = Math.round((i + batch.length) / total * 100);
      this.updateProgress(progress, `Processed ${i + batch.length} of ${total} items`);
    }

    return results;
  }
}

/**
 * Custom timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Custom validation error
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/**
 * Custom retry exhausted error
 */
export class RetryExhaustedError extends Error {
  constructor(message: string, public readonly attempts: number) {
    super(message);
    this.name = "RetryExhaustedError";
  }
}
