const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/$/, "");
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasRedis = Boolean(redisUrl && redisToken);
export async function redis<T = unknown>(...command: (string | number)[]): Promise<T> {
  if (!redisUrl || !redisToken) throw new Error("Upstash Redis is not configured.");
  const response = await fetch(redisUrl, { method: "POST", headers: { Authorization: `Bearer ${redisToken}`, "Content-Type": "application/json" }, body: JSON.stringify(command) });
  if (!response.ok) throw new Error(`Upstash Redis request failed (${response.status}).`);
  const body = await response.json() as { result?: T; error?: string };
  if (body.error) throw new Error(body.error);
  return body.result as T;
}
export async function hashIdentifier(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
