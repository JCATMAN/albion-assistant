/** Redis hash of one watch. The writer deletes it after Discord accepts the message. */
export function alertRecordKey(id: string): string {
  return `alert:${id}`;
}

/** Set of alert ids watching one base item, in any city. */
export function alertIndexKey(item: string): string {
  return `alerts:item:${item}`;
}

/** One alert per user, item, and side. A new command replaces this id. */
export function alertOwnerKey(userId: string, item: string, side: string): string {
  return `alert-owner:${userId}:${item}:${side}`;
}
