// =============================================================================
// SettingsRepository — CRUD for the `settings` key-value table
// =============================================================================
// Key-value store for application configuration.
// Values are JSON-serialized strings (validated by Zod in the caller).
//
// Layer: Infrastructure (Layer 1)
// =============================================================================

import type { Result, StorageError } from '@core/interfaces'
import { Err, Ok } from '@core/interfaces'

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export class SettingsRepository {
  /**
   * Get a raw setting value string by key.
   * Returns null if the key has never been set.
   */
  async getSetting(key: string): Promise<Result<string | null, StorageError>> {
    try {
      const value = await tauriInvoke<string | null>('storage_get_setting', { key })
      return Ok(value)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'READ_FAILED' as const,
        message: `Failed to read setting "${key}": ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Set a setting value. Creates the row if it does not exist (UPSERT).
   */
  async setSetting(key: string, value: string): Promise<Result<void, StorageError>> {
    try {
      await tauriInvoke('storage_set_setting', { key, value })
      return Ok(undefined)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to write setting "${key}": ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Get a typed setting by key with a default value.
   * The caller is responsible for parsing the JSON string.
   */
  async getSettingWithDefault<T>(key: string, defaultValue: T): Promise<Result<T, StorageError>> {
    const result = await this.getSetting(key)
    if (!result.ok) return result
    if (result.value === null) return Ok(defaultValue)
    try {
      return Ok(JSON.parse(result.value) as T)
    } catch {
      // Corrupted value — return default
      return Ok(defaultValue)
    }
  }

  /**
   * Set a typed value (automatically JSON-serializes).
   */
  async setTypedSetting<T>(key: string, value: T): Promise<Result<void, StorageError>> {
    try {
      const serialized = JSON.stringify(value)
      return this.setSetting(key, serialized)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to serialize setting "${key}": ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }

  /**
   * Delete all settings (used for app reset).
   */
  async clearAllSettings(): Promise<Result<void, StorageError>> {
    try {
      await tauriInvoke('storage_clear_settings')
      return Ok(undefined)
    } catch (err) {
      return Err({
        module: 'storage' as const,
        code: 'WRITE_FAILED' as const,
        message: `Failed to clear settings: ${err instanceof Error ? err.message : String(err)}`,
      })
    }
  }
}
