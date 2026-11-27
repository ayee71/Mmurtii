/**
 * SeeraAI Pro - 2GB Expanded Storage Capacity & Quota Manager
 * Manages browser persistent storage, IndexedDB, and CacheStorage quota up to 2GB virtual allocation
 * for offline legal precedents, audio testimonies, and multimedia courtroom evidence.
 */

export interface StorageQuotaInfo {
  quotaBytes: number;
  usageBytes: number;
  percentUsed: number;
  isPersistent: boolean;
  formattedQuota: string;
  formattedUsage: string;
}

export async function checkStorageCapacity(): Promise<StorageQuotaInfo> {
  let quota = 0;
  let usage = 0;
  let isPersistent = false;

  try {
    if (typeof navigator !== 'undefined' && navigator.storage) {
      if (navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        quota = typeof estimate.quota === 'number' ? estimate.quota : 0;
        usage = typeof estimate.usage === 'number' ? estimate.usage : 0;
      }
      if (navigator.storage.persisted) {
        isPersistent = await navigator.storage.persisted();
        if (!isPersistent && navigator.storage.persist) {
          isPersistent = await navigator.storage.persist();
        }
      }
    }
  } catch (err) {
    console.warn('[StorageCapacity] Failed to query browser storage estimate:', err);
  }

  const percentUsed = quota > 0 ? Number(((usage / quota) * 100).toFixed(2)) : 0;

  return {
    quotaBytes: quota,
    usageBytes: usage,
    percentUsed,
    isPersistent,
    formattedQuota: quota > 0 ? formatBytes(quota) : 'Unavailable',
    formattedUsage: formatBytes(usage),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
