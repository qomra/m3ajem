import type { SQLiteDatabase } from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Migration interface
interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => Promise<void>;
  down: (db: SQLiteDatabase) => Promise<void>;
}

// Import all migrations
import * as migration001 from './migrations/001_create_chat_tables';
import * as migration002 from './migrations/002_create_spectrum_vectors';
import * as migration003 from './migrations/003_add_sources_to_messages';

// Register all migrations
const migrations: Migration[] = [
  {
    version: 1,
    name: 'create_chat_tables',
    up: migration001.up,
    down: migration001.down,
  },
  {
    version: 2,
    name: 'create_spectrum_vectors',
    up: migration002.up,
    down: migration002.down,
  },
  {
    version: 3,
    name: 'add_sources_to_messages',
    up: migration003.up,
    down: migration003.down,
  },
];

const MIGRATION_VERSION_KEY = '@m3ajem/migration_version';

/**
 * Migration runner service
 * Handles running database migrations in order
 */
export class MigrationRunner {
  /**
   * Get current migration version
   */
  static async getCurrentVersion(): Promise<number> {
    try {
      const versionStr = await AsyncStorage.getItem(MIGRATION_VERSION_KEY);
      return versionStr ? parseInt(versionStr, 10) : 0;
    } catch (error) {
      console.error('Error getting migration version:', error);
      return 0;
    }
  }

  /**
   * Set current migration version
   */
  static async setCurrentVersion(version: number): Promise<void> {
    try {
      await AsyncStorage.setItem(MIGRATION_VERSION_KEY, version.toString());
    } catch (error) {
      console.error('Error setting migration version:', error);
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  static async runMigrations(db: SQLiteDatabase): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      console.log(`Current migration version: ${currentVersion}`);

      // Get pending migrations
      const pendingMigrations = migrations.filter(m => m.version > currentVersion);

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migration(s)`);

      // Run each migration in order
      for (const migration of pendingMigrations) {
        console.log(`Running migration ${migration.version}: ${migration.name}`);
        await migration.up(db);
        await this.setCurrentVersion(migration.version);
        console.log(`✓ Migration ${migration.version} completed`);
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Error running migrations:', error);
      throw error;
    }
  }

  /**
   * Rollback to a specific version
   */
  static async rollbackTo(db: SQLiteDatabase, targetVersion: number): Promise<void> {
    try {
      const currentVersion = await this.getCurrentVersion();
      console.log(`Rolling back from version ${currentVersion} to ${targetVersion}`);

      if (targetVersion >= currentVersion) {
        console.log('Nothing to rollback');
        return;
      }

      // Get migrations to rollback (in reverse order)
      const migrationsToRollback = migrations
        .filter(m => m.version > targetVersion && m.version <= currentVersion)
        .reverse();

      // Run each migration's down function
      for (const migration of migrationsToRollback) {
        console.log(`Rolling back migration ${migration.version}: ${migration.name}`);
        await migration.down(db);
        await this.setCurrentVersion(migration.version - 1);
        console.log(`✓ Migration ${migration.version} rolled back`);
      }

      console.log(`Rollback to version ${targetVersion} completed`);
    } catch (error) {
      console.error('Error rolling back migrations:', error);
      throw error;
    }
  }

  /**
   * Get migration status
   */
  static async getStatus(): Promise<{
    currentVersion: number;
    latestVersion: number;
    pendingMigrations: number;
  }> {
    const currentVersion = await this.getCurrentVersion();
    const latestVersion = migrations.length > 0 ? Math.max(...migrations.map(m => m.version)) : 0;
    const pendingMigrations = migrations.filter(m => m.version > currentVersion).length;

    return {
      currentVersion,
      latestVersion,
      pendingMigrations,
    };
  }
}
