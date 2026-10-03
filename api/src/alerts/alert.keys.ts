/** Redis hash of one watch. The writer deletes it after Discord accepts the message. */
export function alertRecordKey(id: string): string {
  return `alert:${id}`;
}

/** Set of alert ids watching one market cell. */
export function alertIndexKey(cellKey: string): string {
  return `alerts:${cellKey}`;
}

/** One alert per user, cell, and side. A new command replaces this id. */
export function alertOwnerKey(userId: string, cellKey: string, side: string): string {
  return `alert-owner:${userId}:${cellKey}:${side}`;
}
