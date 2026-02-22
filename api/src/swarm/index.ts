/**
 * Agent Swarm Orchestration System
 * Export all swarm modules
 */

export * from "./orchestrator";
export * from "./agent-base";
export * from "./agents/youtube-researcher";

// Template registry
import { SwarmOrchestrator } from "./orchestrator";
import { youtubeResearcherTemplate } from "./agents/youtube-researcher";

/**
 * Register all agent templates with the orchestrator
 */
export function registerAllTemplates(orchestrator: SwarmOrchestrator): void {
  orchestrator.registerTemplate(youtubeResearcherTemplate);
  console.log("[Swarm] All agent templates registered");
}
