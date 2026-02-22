/**
 * YouTube Researcher Agent
 * Researches niche domains and finds top YouTube creators
 * Extracts: channel name, subscribers, niche, video count, avg views
 * 
 * LLM PROVIDER PRIORITY:
 * 1. OpenClaw Gateway (if OPENCLAW_GATEWAY_URL and OPENCLAW_GATEWAY_TOKEN are set)
 * 2. Direct OpenRouter API (fallback)
 * 
 * DEMONSTRATION MODE:
 * If no LLM provider is configured, the agent automatically
 * falls back to demo mode using youtube-researcher-demo.ts which returns
 * realistic sample data without requiring an API key.
 */

import { BaseAgent, AgentTask, AgentResult, AgentConfig } from "../agent-base";
import { YouTubeResearchPayload, YouTubeCreator, YouTubeResearchResult, DEMO_CREATORS, NICHE_MAPPINGS } from "./youtube-researcher-demo";
import { getLLMProviderConfig } from "../../utils/llm-provider";
import WebSocket from "ws";

// YouTube Data API types
interface YouTubeSearchItem {
  id: {
    channelId?: string;
  };
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
    channelTitle: string;
    channelId: string;
  };
}

interface YouTubeChannel {
  id: string;
  snippet: {
    title: string;
    description: string;
    thumbnails: {
      default?: { url: string };
      medium?: { url: string };
      high?: { url: string };
    };
  };
  statistics: {
    subscriberCount: string;
    videoCount: string;
    viewCount: string;
  };
}

interface YouTubeVideo {
  id: string;
  snippet: {
    title: string;
    publishedAt: string;
  };
  statistics: {
    viewCount: string;
  };
}

/**
 * Helper function to match niche to demo data
 */
function matchNiche(inputNiche: string): string {
  const normalizedNiche = inputNiche.toLowerCase().trim();
  
  // Direct match
  for (const [key, keywords] of Object.entries(NICHE_MAPPINGS)) {
    if (keywords.some((kw: string) => normalizedNiche.includes(kw))) {
      return key;
    }
  }
  
  // Default fallback
  return "default";
}

/**
 * Helper function to simulate API delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * YouTube Researcher Agent
 * Uses OpenRouter/Kimi API for intelligent YouTube research
 * Falls back to demo mode when API key is not configured
 */
export class YouTubeResearcherAgent extends BaseAgent {
  private apiKey?: string;
  private baseURL: string = "https://openrouter.ai/api/v1";
  private model: string = "moonshotai/kimi-k2.5";
  private isDemoMode: boolean = false;
  private userId?: string;
  
  // OpenClaw gateway configuration
  private openclawUrl?: string;
  private openclawToken?: string;
  private useOpenClaw: boolean = false;

  constructor(task: AgentTask, config: AgentConfig & { apiKey?: string; userId?: string } = {}) {
    super(task, config);
    this.apiKey = config.apiKey;
    this.userId = config.userId || task.metadata?.userId;
    
    // Demo mode check is deferred to init() to allow async provider key lookup
    // If apiKey is explicitly provided and looks valid, we'll use it directly
    if (this.apiKey && this.apiKey.length >= 10 && this.apiKey !== "sk-demo" && !this.apiKey.startsWith("demo")) {
      this.isDemoMode = false;
    }
  }

  /**
   * Initialize the agent
   */
  protected async init(): Promise<void> {
    await super.init();

    // Check for OpenClaw gateway configuration first (highest priority)
    this.openclawUrl = process.env.OPENCLAW_GATEWAY_URL;
    this.openclawToken = process.env.OPENCLAW_GATEWAY_TOKEN;
    
    if (this.openclawUrl && this.openclawToken) {
      this.useOpenClaw = true;
      this.log("info", "OpenClaw gateway configured - will use OpenClaw for LLM calls");
    } else {
      this.useOpenClaw = false;
      this.log("info", "OpenClaw not configured, will use direct OpenRouter API");
    }

    // If API key not provided directly, try to get from provider-keys system
    if (!this.apiKey) {
      if (this.userId) {
        try {
          const providerConfig = await getLLMProviderConfig(this.userId, "openrouter");
          if (providerConfig && providerConfig.keyData?.apiKey) {
            this.apiKey = providerConfig.keyData.apiKey;
            this.log("info", "Using LLM provider key from provider-keys system");
          }
        } catch (err) {
          this.log("warn", "Failed to fetch provider config, will try fallback", { error: err });
        }
      }
      
      // Fall back to environment variable if still no key
      if (!this.apiKey) {
        this.apiKey = process.env.SYSTEM_OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;
        if (this.apiKey) {
          this.log("info", "Using fallback system OpenRouter API key");
        }
      }
    }
    
    // Check if we should use demo mode (no valid API key and no OpenClaw)
    const hasValidProvider = this.useOpenClaw || (this.apiKey && this.apiKey.length >= 10 && this.apiKey !== "sk-demo" && !this.apiKey.startsWith("demo"));
    
    if (!hasValidProvider) {
      this.isDemoMode = true;
      this.log("info", "No LLM provider configured (OpenClaw or OpenRouter) - switching to DEMO MODE");
      return;
    }
    
    this.isDemoMode = false;

    // Validate payload
    const payload = this.task.payload as YouTubeResearchPayload;
    if (!payload.niche || typeof payload.niche !== "string") {
      throw new Error("Invalid payload: 'niche' is required and must be a string");
    }
  }

  /**
   * Main execution logic
   */
  protected async executeTask(): Promise<YouTubeResearchResult> {
    // If in demo mode, execute demo logic
    if (this.isDemoMode) {
      this.log("info", "Executing in DEMO MODE - returning realistic sample data");
      return await this.executeDemoMode();
    }

    const payload = this.task.payload as YouTubeResearchPayload;
    const niche = payload.niche;
    const maxCreators = payload.maxCreators || 3;
    const minSubscribers = payload.minSubscribers || 1000;

    this.updateProgress(10, `Starting research for niche: ${niche}`);

    // Step 1: Use LLM to identify top creators in the niche
    this.updateProgress(20, "Identifying top creators using AI...");
    const creators = await this.identifyCreators(niche, maxCreators, minSubscribers);

    // Step 2: Enrich creator data with additional details
    this.updateProgress(60, "Enriching creator data...");
    const enrichedCreators = await this.enrichCreatorData(creators);

    // Step 3: Calculate average views and finalize data
    this.updateProgress(80, "Calculating statistics...");
    const finalCreators = this.finalizeCreatorStats(enrichedCreators);

    // Step 4: Build result
    this.updateProgress(95, "Finalizing results...");
    const result: YouTubeResearchResult = {
      niche,
      creators: finalCreators,
      totalFound: finalCreators.length,
      searchQuery: this.buildSearchQuery(niche),
      timestamp: new Date().toISOString(),
    };

    return result;
  }

  /**
   * Execute demo mode - returns realistic sample data
   */
  private async executeDemoMode(): Promise<YouTubeResearchResult> {
    const payload = this.task.payload as YouTubeResearchPayload;
    const niche = payload.niche;
    const maxCreators = Math.min(payload.maxCreators || 3, 5);

    this.updateProgress(10, `Starting research for niche: ${niche}`);
    this.log("info", `DEMO MODE: Generating sample data for niche "${niche}"`);

    // Simulate API delay (2-3 seconds)
    this.updateProgress(30, "Connecting to data source...");
    await sleep(800 + Math.random() * 700);

    // Step 1: Identify creators
    this.updateProgress(50, "Identifying top creators...");
    await sleep(600 + Math.random() * 500);
    const matchedNiche = matchNiche(niche);
    const demoCreators = DEMO_CREATORS[matchedNiche] || DEMO_CREATORS.default;
    
    // Step 2: Select creators based on maxCreators
    this.updateProgress(70, "Processing creator data...");
    await sleep(500 + Math.random() * 400);
    const selectedCreators = demoCreators.slice(0, maxCreators);

    // Step 3: Finalize data
    this.updateProgress(90, "Finalizing results...");
    await sleep(400 + Math.random() * 300);
    
    const finalCreators: YouTubeCreator[] = selectedCreators.map((creator) => ({
      ...creator,
      channelUrl: creator.channelUrl,
      niche: niche,
      // Add some randomization to make each request slightly different
      videoCount: creator.videoCount + Math.floor(Math.random() * 10),
    }));

    // Build result
    this.updateProgress(100, "Complete!");
    
    const result: YouTubeResearchResult = {
      niche,
      creators: finalCreators,
      totalFound: finalCreators.length,
      searchQuery: this.buildSearchQuery(niche),
      timestamp: new Date().toISOString(),
    };

    this.log("info", `DEMO MODE: Successfully generated ${finalCreators.length} sample creators for "${niche}"`);

    return result;
  }

  /**
   * Use LLM to identify top YouTube creators in the niche
   */
  private async identifyCreators(
    niche: string,
    maxCreators: number,
    minSubscribers: number
  ): Promise<Partial<YouTubeCreator>[]> {
    const prompt = `You are a YouTube research expert. Find the top ${maxCreators} YouTube creators in the "${niche}" niche.

For each creator, provide:
1. Channel name (exact name)
2. Channel URL (full YouTube URL)
3. Subscriber count (approximate number or range)
4. Brief description of their content focus
5. Estimated video count

Only include creators with at least ${minSubscribers} subscribers.
Focus on the most popular and influential creators in this niche.

Return ONLY a JSON array in this exact format:
[
  {
    "channelName": "Channel Name",
    "channelUrl": "https://www.youtube.com/@channel",
    "subscribers": "1.5M",
    "description": "Brief description",
    "videoCount": 150
  }
]`;

    const response = await this.callLLM(prompt);
    
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        throw new Error("No JSON array found in LLM response");
      }
      
      const creators = JSON.parse(jsonMatch[0]) as Partial<YouTubeCreator>[];
      return creators.slice(0, maxCreators);
    } catch (error) {
      this.log("error", "Failed to parse LLM response", { response, error });
      throw new Error(`Failed to identify creators: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Enrich creator data with additional details
   */
  private async enrichCreatorData(
    creators: Partial<YouTubeCreator>[]
  ): Promise<Partial<YouTubeCreator>[]> {
    const enriched: Partial<YouTubeCreator>[] = [];

    for (let i = 0; i < creators.length; i++) {
      const creator = creators[i];
      this.updateProgress(
        60 + Math.round((i / creators.length) * 20),
        `Enriching data for ${creator.channelName}...`
      );

      // Use LLM to get more accurate stats if we don't have real API access
      const enrichedCreator = await this.enrichCreatorViaLLM(creator, creators.length);
      enriched.push(enrichedCreator);
    }

    return enriched;
  }

  /**
   * Enrich a single creator's data via LLM
   */
  private async enrichCreatorViaLLM(
    creator: Partial<YouTubeCreator>,
    totalCreators: number
  ): Promise<Partial<YouTubeCreator>> {
    const prompt = `You are a YouTube analytics expert. Provide detailed statistics for the YouTube channel "${creator.channelName}".

Based on your knowledge of this channel, provide:
1. Most accurate subscriber count (as a formatted string like "1.2M" or "850K")
2. Estimated total video count (number)
3. Average views per video (as a formatted string like "100K" or "1.5M")
4. 3 recent popular video titles with approximate view counts
5. The specific niche/sub-niche they focus on

Return ONLY a JSON object in this exact format:
{
  "subscribers": "1.2M",
  "subscriberCount": 1200000,
  "videoCount": 245,
  "avgViews": "500K",
  "avgViewCount": 500000,
  "niche": "Specific niche name",
  "recentVideos": [
    {"title": "Video Title 1", "views": "1M views", "publishedAt": "2 weeks ago"},
    {"title": "Video Title 2", "views": "750K views", "publishedAt": "1 month ago"},
    {"title": "Video Title 3", "views": "500K views", "publishedAt": "2 months ago"}
  ]
}`;

    try {
      const response = await this.callLLM(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]);
        return {
          ...creator,
          ...enriched,
        };
      }
    } catch (error) {
      this.log("warn", `Failed to enrich ${creator.channelName}`, { error });
    }

    // Return original if enrichment fails
    return creator;
  }

  /**
   * Finalize creator statistics
   */
  private finalizeCreatorStats(
    creators: Partial<YouTubeCreator>[]
  ): YouTubeCreator[] {
    return creators.map((creator) => ({
      channelName: creator.channelName || "Unknown",
      channelUrl: creator.channelUrl || "",
      subscribers: creator.subscribers || "N/A",
      subscriberCount: creator.subscriberCount || this.parseSubscriberCount(creator.subscribers),
      niche: creator.niche || this.task.payload.niche,
      videoCount: creator.videoCount || 0,
      avgViews: creator.avgViews || "N/A",
      avgViewCount: creator.avgViewCount || this.parseViewCount(creator.avgViews),
      recentVideos: creator.recentVideos || [],
      description: creator.description || "",
      profileImage: creator.profileImage,
    }));
  }

  /**
   * Parse subscriber count string to number
   */
  private parseSubscriberCount(subscribers?: string): number | undefined {
    if (!subscribers) return undefined;
    
    const clean = subscribers.toLowerCase().replace(/,/g, "");
    const match = clean.match(/^([\d.]+)([km]?)$/);
    
    if (!match) return undefined;
    
    const num = parseFloat(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case "k": return Math.round(num * 1000);
      case "m": return Math.round(num * 1000000);
      default: return Math.round(num);
    }
  }

  /**
   * Parse view count string to number
   */
  private parseViewCount(views?: string): number | undefined {
    return this.parseSubscriberCount(views);
  }

  /**
   * Build search query for the niche
   */
  private buildSearchQuery(niche: string): string {
    return `top ${niche} youtubers best creators`;
  }

  /**
   * Call LLM via OpenClaw gateway or direct OpenRouter API
   * Priority: OpenClaw > OpenRouter
   */
  private async callLLM(prompt: string): Promise<string> {
    // Try OpenClaw first if configured
    if (this.useOpenClaw && this.openclawUrl && this.openclawToken) {
      try {
        this.log("info", "Using OpenClaw gateway for LLM call");
        const result = await this.callOpenClaw(prompt);
        return result;
      } catch (error) {
        this.log("warn", "OpenClaw gateway call failed, falling back to OpenRouter", { 
          error: error instanceof Error ? error.message : String(error) 
        });
        // Fall through to OpenRouter
      }
    }
    
    // Fallback to direct OpenRouter API
    return this.callOpenRouter(prompt);
  }

  /**
   * Call LLM via OpenClaw gateway using WebSocket
   * Connects to ws://openclaw-gateway:18789 with proper message protocol
   */
  private async callOpenClaw(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Convert http(s) URL to ws(s) URL
      let wsUrl = this.openclawUrl!.replace(/^http:/, "ws:").replace(/^https:/, "wss:");
      
      // Remove trailing slashes and append WebSocket endpoint
      wsUrl = wsUrl.replace(/\/$/, "") + "/ws";
      
      this.log("info", `Connecting to OpenClaw WebSocket: ${wsUrl}`);
      
      // Create WebSocket connection with timeout
      const ws = new WebSocket(wsUrl, {
        headers: {
          "Authorization": `Bearer ${this.openclawToken}`,
        },
        timeout: 10000, // 10s connection timeout
      });
      
      let responseReceived = false;
      let timeoutId: NodeJS.Timeout;
      
      // Set overall timeout for the entire operation
      const OPERATION_TIMEOUT = 60000; // 60 seconds
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
      
      timeoutId = setTimeout(() => {
        if (!responseReceived) {
          cleanup();
          reject(new Error("OpenClaw WebSocket timeout - no response received within 60s"));
        }
      }, OPERATION_TIMEOUT);
      
      ws.on("open", () => {
        this.log("info", "OpenClaw WebSocket connected");
        
        // Send message in OpenClaw WebSocket format
        const message = {
          type: "chat.completion",
          model: this.model,
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that provides accurate YouTube creator information. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        };
        
        ws.send(JSON.stringify(message));
        this.log("debug", "Message sent to OpenClaw gateway");
      });
      
      ws.on("message", (data: WebSocket.RawData) => {
        try {
          const response = JSON.parse(data.toString());
          responseReceived = true;
          
          // Handle different response types
          if (response.type === "error" || response.error) {
            cleanup();
            reject(new Error(`OpenClaw gateway error: ${response.error || response.message || "Unknown error"}`));
            return;
          }
          
          // Extract content from response
          let content: string | undefined;
          
          if (response.type === "chat.completion" || response.choices) {
            // Standard chat completion response format
            content = response.choices?.[0]?.message?.content;
          } else if (response.content) {
            // Direct content format
            content = response.content;
          } else if (typeof response === "string") {
            // Plain string response
            content = response;
          }
          
          if (content !== undefined) {
            cleanup();
            this.log("info", "OpenClaw WebSocket call successful");
            resolve(content);
          } else {
            // Keep listening for more messages if content not yet received
            this.log("debug", "Received message without content, continuing to listen", { response });
          }
        } catch (error) {
          // If not JSON, treat as raw content
          responseReceived = true;
          cleanup();
          const content = data.toString();
          this.log("info", "OpenClaw WebSocket call successful (raw response)");
          resolve(content);
        }
      });
      
      ws.on("error", (error: Error) => {
        this.log("error", "OpenClaw WebSocket error", { error: error.message });
        cleanup();
        reject(new Error(`OpenClaw WebSocket error: ${error.message}`));
      });
      
      ws.on("close", (code: number, reason: Buffer) => {
        if (!responseReceived) {
          cleanup();
          reject(new Error(`OpenClaw WebSocket closed unexpectedly (code: ${code}, reason: ${reason.toString() || "none"})`));
        }
      });
    });
  }

  /**
   * Call LLM via direct OpenRouter API
   */
  private async callOpenRouter(prompt: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error("No OpenRouter API key available");
    }
    
    this.log("info", "Using direct OpenRouter API for LLM call");
    
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`,
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
        "X-Title": "SquadOps Swarm",
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that provides accurate YouTube creator information. Always respond with valid JSON only.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${error}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content || "";
    
    this.log("info", "OpenRouter API call successful");
    return content;
  }

  /**
   * Check if running in demo mode
   */
  public isRunningInDemoMode(): boolean {
    return this.isDemoMode;
  }

  /**
   * Cleanup resources
   */
  protected async cleanup(): Promise<void> {
    await super.cleanup();
  }
}

/**
 * Factory function for creating YouTube researcher agents
 */
export function createYouTubeResearcherAgent(task: AgentTask, config: AgentConfig = {}): YouTubeResearcherAgent {
  return new YouTubeResearcherAgent(task, config);
}

/**
 * Template registration helper
 */
export const youtubeResearcherTemplate = {
  id: "youtube-researcher",
  name: "YouTube Researcher",
  description: "Researches niche domains and finds top YouTube creators with detailed stats (auto-falls back to demo mode without API key)",
  factory: createYouTubeResearcherAgent,
};

// Re-export types from demo file for convenience
export type { YouTubeResearchPayload, YouTubeCreator, YouTubeResearchResult };

export default YouTubeResearcherAgent;
