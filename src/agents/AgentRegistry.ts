import type { BaseAgent } from './BaseAgent';
import type { BaseProvider } from '@services/ai/BaseProvider';
import { SimpleForwardAgent } from './SimpleForwardAgent';
import { DictionaryToolAgent } from './DictionaryToolAgent';
import { SmartDictionaryAgent } from './SmartDictionaryAgent';
import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Agent Registry
 * Manages available agents and provides factory methods
 */
export class AgentRegistry {
  private static agents: Map<string, typeof BaseAgent> = new Map();

  /**
   * Initialize the registry with default agents
   */
  static initialize(): void {
    // Register default agents
    this.registerAgent('simple-forward', SimpleForwardAgent as any);
    this.registerAgent('dictionary-tool', DictionaryToolAgent as any);
    this.registerAgent('smart-dictionary', SmartDictionaryAgent as any);
  }

  /**
   * Register a new agent type
   */
  static registerAgent(name: string, agentClass: typeof BaseAgent): void {
    this.agents.set(name, agentClass);
  }

  /**
   * Create an agent instance by name
   */
  static createAgent(name: string, provider: BaseProvider): BaseAgent {
    const AgentClass = this.agents.get(name);

    if (!AgentClass) {
      throw new Error(`Agent not found: ${name}`);
    }

    return new (AgentClass as any)(provider);
  }

  /**
   * Get default agent (simple forward agent)
   */
  static getDefaultAgent(provider: BaseProvider): BaseAgent {
    return this.createAgent('simple-forward', provider);
  }

  /**
   * Get dictionary tool agent (requires database)
   * Uses SmartDictionaryAgent with optimized 2-tool system
   */
  static getDictionaryAgent(provider: BaseProvider, db: SQLiteDatabase): BaseAgent {
    return new SmartDictionaryAgent(provider, db);
  }

  /**
   * Get legacy dictionary tool agent (for fallback)
   */
  static getLegacyDictionaryAgent(provider: BaseProvider, db: SQLiteDatabase): BaseAgent {
    return new DictionaryToolAgent(provider, db);
  }

  /**
   * Get list of available agent names
   */
  static getAvailableAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Check if an agent is registered
   */
  static hasAgent(name: string): boolean {
    return this.agents.has(name);
  }
}

// Initialize registry with default agents
AgentRegistry.initialize();
