import AsyncStorage from '@react-native-async-storage/async-storage';

export type APIProvider = 'openai' | 'anthropic' | 'groq' | 'google';

// Hard-coded models for each provider (Latest 2025 models)
// Verified from official provider documentation
const PROVIDER_MODELS: Record<APIProvider, string> = {
  openai: 'gpt-5',                                         // OpenAI GPT-5 (August 2025)
  google: 'gemini-2.5-flash',                              // Google Gemini 2.5 Flash (stable)
  anthropic: 'claude-sonnet-4-5',                          // Anthropic Claude Sonnet 4.5 (Sept 2025)
  groq: 'meta-llama/llama-4-maverick-17b-128e-instruct',   // Meta Llama 4 Maverick on Groq (April 2025)
};

export interface APIConfig {
  provider: APIProvider;
  apiKey: string;
  model: string;
}

export interface AllAPIConfigs {
  currentProvider: APIProvider;
  openai?: APIConfig;
  anthropic?: APIConfig;
  groq?: APIConfig;
  google?: APIConfig;
}

const API_CONFIG_KEY = '@m3ajem_api_config';
const ALL_API_CONFIGS_KEY = '@m3ajem_all_api_configs';

export class APIKeyStorage {
  /**
   * Get the current API configuration
   */
  static async getAPIConfig(): Promise<APIConfig | null> {
    try {
      const configString = await AsyncStorage.getItem(API_CONFIG_KEY);
      if (!configString) return null;
      return JSON.parse(configString) as APIConfig;
    } catch (error) {
      console.error('Error getting API config:', error);
      return null;
    }
  }

  /**
   * Save API configuration
   */
  static async saveAPIConfig(config: APIConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(API_CONFIG_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving API config:', error);
      throw error;
    }
  }

  /**
   * Get all API configurations
   * Automatically migrates old model names to new ones
   */
  static async getAllConfigs(): Promise<AllAPIConfigs | null> {
    try {
      const configString = await AsyncStorage.getItem(ALL_API_CONFIGS_KEY);
      if (!configString) return null;

      const configs = JSON.parse(configString) as AllAPIConfigs;

      // Migrate old model names to new ones
      let needsUpdate = false;

      if (configs.openai && configs.openai.model !== PROVIDER_MODELS.openai) {
        configs.openai.model = PROVIDER_MODELS.openai;
        needsUpdate = true;
      }

      if (configs.google && configs.google.model !== PROVIDER_MODELS.google) {
        configs.google.model = PROVIDER_MODELS.google;
        needsUpdate = true;
      }

      if (configs.anthropic && configs.anthropic.model !== PROVIDER_MODELS.anthropic) {
        configs.anthropic.model = PROVIDER_MODELS.anthropic;
        needsUpdate = true;
      }

      if (configs.groq && configs.groq.model !== PROVIDER_MODELS.groq) {
        configs.groq.model = PROVIDER_MODELS.groq;
        needsUpdate = true;
      }

      // Save updated configs
      if (needsUpdate) {
        await this.saveAllConfigs(configs);
      }

      return configs;
    } catch (error) {
      console.error('Error getting all API configs:', error);
      return null;
    }
  }

  /**
   * Save all API configurations
   */
  static async saveAllConfigs(configs: AllAPIConfigs): Promise<void> {
    try {
      await AsyncStorage.setItem(ALL_API_CONFIGS_KEY, JSON.stringify(configs));
      // Also update current config
      const currentConfig = configs[configs.currentProvider];
      if (currentConfig) {
        await this.saveAPIConfig(currentConfig);
      }
    } catch (error) {
      console.error('Error saving all API configs:', error);
      throw error;
    }
  }

  /**
   * Clear API configuration
   */
  static async clearAPIConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(API_CONFIG_KEY);
      await AsyncStorage.removeItem(ALL_API_CONFIGS_KEY);
    } catch (error) {
      console.error('Error clearing API config:', error);
      throw error;
    }
  }

  /**
   * Get hard-coded model for a provider
   */
  static getModelForProvider(provider: APIProvider): string {
    return PROVIDER_MODELS[provider];
  }

  /**
   * Validate API key format based on provider
   */
  static validateAPIKeyFormat(provider: APIProvider, apiKey: string): boolean {
    switch (provider) {
      case 'openai':
        return apiKey.startsWith('sk-');
      case 'anthropic':
        return apiKey.startsWith('sk-ant-');
      case 'groq':
        return apiKey.startsWith('gsk_');
      case 'google':
        return apiKey.length > 20; // Google keys are typically longer
      default:
        return false;
    }
  }
}

export default APIKeyStorage;
