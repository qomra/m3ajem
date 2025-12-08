import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Migration interface
interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
  down: (db: SQLiteDatabase) => Promise<void>;
}

// Import dictionary migrations
import * as dictMigration001 from './migrations/dictionary/001_create_spectrum_vectors';

// Import user migrations
import * as userMigration001 from './migrations/user/001_create_chat_tables';
import * as userMigration002 from './migrations/user/002_add_thoughts_duration';
import * as userMigration003 from './migrations/user/003_add_related_sources';

// Register dictionary migrations (for dictionary.db)
const dictionaryMigrations: Migration[] = [
  {
    version: 1,
    name: 'create_spectrum_vectors',
    up: dictMigration001.up,
    down: dictMigration001.down,
  },
];

// Register user migrations (for user.db)
const userMigrations: Migration[] = [
  {
    version: 1,
    name: 'create_chat_tables',
    up: userMigration001.up,
    down: userMigration001.down,
  },
  {
    version: 2,
    name: 'add_thoughts_duration',
    up: userMigration002.up,
    down: userMigration002.down,
  },
  {
    version: 3,
    name: 'add_related_sources',
    up: userMigration003.up,
    down: userMigration003.down,
  },
];

const DICTIONARY_MIGRATION_VERSION_KEY = '@m3ajem/dictionary_migration_version';
const USER_MIGRATION_VERSION_KEY = '@m3ajem/user_migration_version';

/**
 * Two-Database Migration Runner
 * Handles separate migration paths for dictionary.db and user.db
 */
export class TwoDatabaseMigrationRunner {
  /**
   * Get current migration version for a database
   */
  static async getCurrentVersion(key: string): Promise<number> {
    try {
      const versionStr = await AsyncStorage.getItem(key);
      return versionStr ? parseInt(versionStr, 10) : 0;
    } catch (error) {
      console.error('Error getting migration version:', error);
      return 0;
    }
  }

  /**
   * Set current migration version for a database
   */
  static async setCurrentVersion(key: string, version: number): Promise<void> {
    try {
      await AsyncStorage.setItem(key, version.toString());
    } catch (error) {
      console.error('Error setting migration version:', error);
      throw error;
    }
  }

  /**
   * Run dictionary database migrations
   */
  static async runDictionaryMigrations(db: SQLiteDatabase): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion(DICTIONARY_MIGRATION_VERSION_KEY);
      console.log(`Dictionary DB migration version: ${currentVersion}`);

      const pendingMigrations = dictionaryMigrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        console.log('No pending dictionary migrations');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending dictionary migration(s)`);

      for (const migration of pendingMigrations) {
        console.log(`Running dictionary migration ${migration.version}: ${migration.name}`);
        await migration.up(db);
        await this.setCurrentVersion(DICTIONARY_MIGRATION_VERSION_KEY, migration.version);
        console.log(`✓ Dictionary migration ${migration.version} completed`);
      }

      console.log('All dictionary migrations completed successfully');
    } catch (error) {
      console.error('Error running dictionary migrations:', error);
      throw error;
    }
  }

  /**
   * Run user database migrations
   */
  static async runUserMigrations(db: SQLiteDatabase): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion(USER_MIGRATION_VERSION_KEY);
      console.log(`User DB migration version: ${currentVersion}`);

      const pendingMigrations = userMigrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        console.log('No pending user migrations');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending user migration(s)`);

      for (const migration of pendingMigrations) {
        console.log(`Running user migration ${migration.version}: ${migration.name}`);
        await migration.up(db);
        await this.setCurrentVersion(USER_MIGRATION_VERSION_KEY, migration.version);
        console.log(`✓ User migration ${migration.version} completed`);
      }

      console.log('All user migrations completed successfully');
    } catch (error) {
      console.error('Error running user migrations:', error);
      throw error;
    }
  }

  /**
   * Get migration status for both databases
   */
  static async getStatus(): Promise<{
    dictionary: { currentVersion: number; latestVersion: number; pendingMigrations: number };
    user: { currentVersion: number; latestVersion: number; pendingMigrations: number };
  }> {
    const dictCurrentVersion = await this.getCurrentVersion(DICTIONARY_MIGRATION_VERSION_KEY);
    const dictLatestVersion = dictionaryMigrations.length > 0
      ? Math.max(...dictionaryMigrations.map(m => m.version))
      : 0;
    const dictPendingMigrations = dictionaryMigrations.filter(m => m.version > dictCurrentVersion).length;

    const userCurrentVersion = await this.getCurrentVersion(USER_MIGRATION_VERSION_KEY);
    const userLatestVersion = userMigrations.length > 0
      ? Math.max(...userMigrations.map(m => m.version))
      : 0;
    const userPendingMigrations = userMigrations.filter(m => m.version > userCurrentVersion).length;

    return {
      dictionary: {
        currentVersion: dictCurrentVersion,
        latestVersion: dictLatestVersion,
        pendingMigrations: dictPendingMigrations,
      },
      user: {
        currentVersion: userCurrentVersion,
        latestVersion: userLatestVersion,
        pendingMigrations: userPendingMigrations,
      },
    };
  }
}
