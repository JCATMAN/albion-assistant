/** Type 5 acknowledges a command. Type 6 acknowledges a button. Undefined means answer inline. */
export function discordDeferType(body: unknown): 5 | 6 | undefined {
  const record = asRecord(body);
  if (!record || typeof record.type !== 'number') {
    return undefined;
  }
  if (record.type === 2) {
    const data = asRecord(record.data);
    return data?.name === 'price' ? 5 : undefined;
  }
  if (record.type === 3) {
    const data = asRecord(record.data);
    return typeof data?.custom_id === 'string' &&
      (data.custom_id.startsWith('pq:') || data.custom_id.startsWith('pe:'))
      ? 6
      : undefined;
  }
  return undefined;
}

/** Application id and interaction token needed to edit the deferred message. */
export function discordCallback(
  body: unknown,
): { applicationId: string; token: string } | undefined {
  const record = asRecord(body);
  if (!record) {
    return undefined;
  }
  const applicationId = record.application_id;
  const token = record.token;
  if (typeof applicationId !== 'string' || typeof token !== 'string') {
    return undefined;
  }
  if (applicationId === '' || token === '') {
    return undefined;
  }
  return { applicationId, token };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}
