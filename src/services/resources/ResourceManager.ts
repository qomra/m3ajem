import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Resource Types
 */
export enum ResourceType {
  SEMANTIC_EMBEDDINGS = 'semantic_embeddings',
}

/**
 * Resource Metadata
 */
export interface ResourceMetadata {
  id: ResourceType;
  name: string;
  description: string;
  downloadUrl: string;
  size: number; // bytes
  requiredProvider?: 'openai' | 'google'; // Required API provider
  version: string;
}

/**
 * Resource Status
 */
export interface ResourceStatus {
  id: ResourceType;
  downloaded: boolean;
  downloading: boolean;
  progress: number; // 0-100
  size?: number;
  downloadedAt?: number;
  error?: string;
}

/**
 * Available Resources
 */
export const AVAILABLE_RESOURCES: Record<ResourceType, ResourceMetadata> = {
  [ResourceType.SEMANTIC_EMBEDDINGS]: {
    id: ResourceType.SEMANTIC_EMBEDDINGS,
    name: 'البحث الدلالي',
    description: 'ملف التضمينات للبحث بالمعنى (46 MB). يتطلب OpenAI API.',
    downloadUrl: 'https://drive.usercontent.google.com/download?id=1f7gQVH2Y1ofn6n6WyvZToTH3vLZxud2L&export=download&confirm=t',
    size: 46 * 1024 * 1024, // 46 MB
    requiredProvider: 'openai',
    version: '1.0',
  },
};

const RESOURCES_DIR = `${FileSystem.documentDirectory}resources/`;
const STATUS_KEY = '@m3ajem/resource_status_';

/**
 * Resource Manager
 * Handles downloading and managing optional resources
 */
export class ResourceManager {
  /**
   * Initialize resources directory
   */
  static async initialize(): Promise<void> {
    const dirInfo = await FileSystem.getInfoAsync(RESOURCES_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(RESOURCES_DIR, { intermediates: true });
    }
  }

  /**
   * Get resource file path
   */
  static getResourcePath(resourceId: ResourceType): string {
    return `${RESOURCES_DIR}${resourceId}.bin.gz`;
  }

  /**
   * Check if resource is downloaded
   */
  static async isDownloaded(resourceId: ResourceType): Promise<boolean> {
    try {
      const path = this.getResourcePath(resourceId);
      const info = await FileSystem.getInfoAsync(path);
      return info.exists;
    } catch {
      return false;
    }
  }

  /**
   * Get resource status
   */
  static async getStatus(resourceId: ResourceType): Promise<ResourceStatus> {
    const statusKey = `${STATUS_KEY}${resourceId}`;
    const statusStr = await AsyncStorage.getItem(statusKey);

    if (statusStr) {
      return JSON.parse(statusStr);
    }

    const downloaded = await this.isDownloaded(resourceId);

    return {
      id: resourceId,
      downloaded,
      downloading: false,
      progress: 0,
    };
  }

  /**
   * Save resource status
   */
  static async saveStatus(status: ResourceStatus): Promise<void> {
    const statusKey = `${STATUS_KEY}${status.id}`;
    await AsyncStorage.setItem(statusKey, JSON.stringify(status));
  }

  /**
   * Download resource with progress tracking
   */
  static async downloadResource(
    resourceId: ResourceType,
    onProgress?: (progress: number) => void
  ): Promise<void> {
    await this.initialize();

    const metadata = AVAILABLE_RESOURCES[resourceId];
    if (!metadata) {
      throw new Error(`Unknown resource: ${resourceId}`);
    }

    const path = this.getResourcePath(resourceId);

    // Update status: downloading
    await this.saveStatus({
      id: resourceId,
      downloaded: false,
      downloading: true,
      progress: 0,
    });

    try {
      // Create download resumable
      const downloadResumable = FileSystem.createDownloadResumable(
        metadata.downloadUrl,
        path,
        {},
        (downloadProgress) => {
          const progress = Math.round(
            (downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100
          );

          // Update status
          this.saveStatus({
            id: resourceId,
            downloaded: false,
            downloading: true,
            progress,
          });

          // Call callback
          if (onProgress) {
            onProgress(progress);
          }
        }
      );

      // Download
      const result = await downloadResumable.downloadAsync();

      if (!result) {
        throw new Error('Download failed');
      }

      // Update status: completed
      await this.saveStatus({
        id: resourceId,
        downloaded: true,
        downloading: false,
        progress: 100,
        size: metadata.size,
        downloadedAt: Date.now(),
      });

      console.log(`✓ Resource ${resourceId} downloaded successfully`);
    } catch (error) {
      // Update status: error
      await this.saveStatus({
        id: resourceId,
        downloaded: false,
        downloading: false,
        progress: 0,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Delete resource
   */
  static async deleteResource(resourceId: ResourceType): Promise<void> {
    const path = this.getResourcePath(resourceId);

    try {
      const info = await FileSystem.getInfoAsync(path);
      if (info.exists) {
        await FileSystem.deleteAsync(path);
      }

      // Update status
      await this.saveStatus({
        id: resourceId,
        downloaded: false,
        downloading: false,
        progress: 0,
      });

      console.log(`✓ Resource ${resourceId} deleted`);
    } catch (error) {
      console.error(`Error deleting resource ${resourceId}:`, error);
      throw error;
    }
  }

  /**
   * Get all resources status
   */
  static async getAllStatus(): Promise<ResourceStatus[]> {
    const statuses: ResourceStatus[] = [];

    for (const resourceId of Object.keys(AVAILABLE_RESOURCES)) {
      const status = await this.getStatus(resourceId as ResourceType);
      statuses.push(status);
    }

    return statuses;
  }

  /**
   * Check if resource can be downloaded (provider available if required)
   */
  static async canDownloadResource(
    resourceId: ResourceType,
    currentProvider?: string
  ): Promise<{ canDownload: boolean; reason?: string }> {
    const metadata = AVAILABLE_RESOURCES[resourceId];
    const status = await this.getStatus(resourceId);

    // Already downloaded
    if (status.downloaded) {
      return {
        canDownload: false,
        reason: 'المورد محمّل بالفعل',
      };
    }

    // Currently downloading
    if (status.downloading) {
      return {
        canDownload: false,
        reason: 'جاري التحميل...',
      };
    }

    // Check if required provider is configured
    if (metadata.requiredProvider && !currentProvider) {
      return {
        canDownload: false,
        reason: `يتطلب تكوين ${metadata.requiredProvider === 'openai' ? 'OpenAI' : 'Google'} API أولاً`,
      };
    }

    return { canDownload: true };
  }

  /**
   * Check if resource can be used (downloaded + provider available)
   */
  static async canUseResource(
    resourceId: ResourceType,
    currentProvider?: string
  ): Promise<{ canUse: boolean; reason?: string }> {
    const metadata = AVAILABLE_RESOURCES[resourceId];
    const status = await this.getStatus(resourceId);

    if (!status.downloaded) {
      return {
        canUse: false,
        reason: 'يجب تحميل المورد أولاً',
      };
    }

    if (metadata.requiredProvider && currentProvider !== metadata.requiredProvider) {
      return {
        canUse: false,
        reason: `يتطلب ${metadata.requiredProvider === 'openai' ? 'OpenAI' : 'Google'} API`,
      };
    }

    return { canUse: true };
  }
}
