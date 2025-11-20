import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SerpAPI Configuration
 */
export interface SerpAPIConfig {
  apiKey: string;
  enabled: boolean;
}

const SERPAPI_KEY = '@m3ajem/serpapi_config';

/**
 * SerpAPI Storage Service
 * Manages SerpAPI configuration for web search
 */
export class SerpAPIStorage {
  /**
   * Save SerpAPI configuration
   */
  static async saveConfig(config: SerpAPIConfig): Promise<void> {
    try {
      await AsyncStorage.setItem(SERPAPI_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Error saving SerpAPI config:', error);
      throw error;
    }
  }

  /**
   * Get SerpAPI configuration
   */
  static async getConfig(): Promise<SerpAPIConfig | null> {
    try {
      const configStr = await AsyncStorage.getItem(SERPAPI_KEY);
      if (!configStr) {
        return null;
      }

      return JSON.parse(configStr);
    } catch (error) {
      console.error('Error getting SerpAPI config:', error);
      return null;
    }
  }

  /**
   * Check if SerpAPI is configured and enabled
   */
  static async isEnabled(): Promise<boolean> {
    const config = await this.getConfig();
    return config !== null && config.enabled && config.apiKey.length > 0;
  }

  /**
   * Delete SerpAPI configuration
   */
  static async deleteConfig(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SERPAPI_KEY);
    } catch (error) {
      console.error('Error deleting SerpAPI config:', error);
      throw error;
    }
  }
}
