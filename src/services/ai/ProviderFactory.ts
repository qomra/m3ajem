import type { APIProvider, APIConfig } from '@services/storage/apiKeyStorage';
import { BaseProvider } from './BaseProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { AnthropicProvider } from './AnthropicProvider';
import { GoogleProvider } from './GoogleProvider';
import { GroqProvider } from './GroqProvider';
import { GatewayProvider, GatewayProviderFactory } from './GatewayProvider';

/**
 * Factory for creating AI provider instances
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on API configuration
   */
  static createProvider(config: APIConfig): BaseProvider {
    const providerConfig = {
      apiKey: config.apiKey,
      model: config.model,
    };

    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(providerConfig);

      case 'anthropic':
        return new AnthropicProvider(providerConfig);

      case 'google':
        return new GoogleProvider(providerConfig);

      case 'groq':
        return new GroqProvider(providerConfig);

      case 'gateway':
        return GatewayProviderFactory.getInstance() as any;

      default:
        throw new Error(`Unsupported provider: ${config.provider}`);
    }
  }

  /**
   * Create a provider instance by provider type and API key
   */
  static createProviderByType(
    provider: APIProvider,
    apiKey: string,
    model: string
  ): BaseProvider {
    return this.createProvider({ provider, apiKey, model });
  }
}
