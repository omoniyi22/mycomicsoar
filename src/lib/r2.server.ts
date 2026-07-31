// Cloudflare R2 client (S3-compatible) using aws4fetch (Worker-safe).
// Server-only. Do NOT import from client-side code or *.functions.ts module scope.
import { AwsClient } from "aws4fetch";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

export function getR2Config() {
  // console.log("[R2] getR2Config: Reading config");
  const accountId = requireEnv("R2_ACCOUNT_ID");
  const bucket = requireEnv("R2_BUCKET");
  const publicBase = (process.env.R2_PUBLIC_BASE_URL ?? "").replace(/\/+$/, "");
  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  // console.log("[R2] Config loaded:", { bucket, publicBase, endpoint });
  return { accountId, bucket, publicBase, endpoint };
}

let _client: AwsClient | undefined;
export function getR2Client(): AwsClient {
  if (_client) {
    // console.log("[R2] getR2Client: Returning existing client");
    return _client;
  }
  // console.log("[R2] getR2Client: Creating new R2 client");
  _client = new AwsClient({
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    service: "s3",
    region: "auto",
  });
  // console.log("[R2] getR2Client: Client created");
  return _client;
}

export function r2PublicUrl(key: string): string {
  const { publicBase } = getR2Config();
  const clean = key.replace(/^\/+/, "");
  const url = `${publicBase}/${clean}`;
  // console.log(`[R2] r2PublicUrl: ${key} → ${url}`);
  return url;
}

export function r2ObjectUrl(key: string): string {
  const { endpoint, bucket } = getR2Config();
  const clean = key.replace(/^\/+/, "");
  const url = `${endpoint}/${bucket}/${clean}`;
  // console.log(`[R2] r2ObjectUrl: ${key} → ${url}`);
  return url;
}

export async function r2Put(
  key: string,
  body: Uint8Array | ArrayBuffer | Blob,
  contentType?: string,
): Promise<{ key: string; url: string }> {
  // console.log(`[R2] r2Put: START key="${key}", contentType="${contentType || 'auto'}"`);
  const client = getR2Client();
  const url = r2ObjectUrl(key);
  // console.log(`[R2] r2Put: Sending PUT request to ${url}`);
  const res = await client.fetch(url, {
    method: "PUT",
    body: body as any,
    headers: contentType ? { "content-type": contentType } : {},
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // console.error(`[R2] r2Put: FAILED with status ${res.status}: ${txt}`);
    throw new Error(`R2 PUT failed ${res.status}: ${txt}`);
  }
  const publicUrl = r2PublicUrl(key);
  // console.log(`[R2] r2Put: SUCCESS, public URL: ${publicUrl}`);
  return { key, url: publicUrl };
}

export async function r2Delete(key: string): Promise<void> {
  // console.log(`[R2] r2Delete: START key="${key}"`);
  const client = getR2Client();
  const url = r2ObjectUrl(key);
  // console.log(`[R2] r2Delete: Sending DELETE request to ${url}`);
  const res = await client.fetch(url, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => "");
    // console.error(`[R2] r2Delete: FAILED with status ${res.status}: ${txt}`);
    throw new Error(`R2 DELETE failed ${res.status}: ${txt}`);
  }
  if (res.status === 404) {
    // console.log(`[R2] r2Delete: File not found (404) – treated as success`);
  } else {
    // console.log(`[R2] r2Delete: SUCCESS, status ${res.status}`);
  }
}

export async function r2Head(key: string): Promise<{ exists: boolean; size?: number; contentType?: string }> {
  // console.log(`[R2] r2Head: START key="${key}"`);
  const client = getR2Client();
  const url = r2ObjectUrl(key);
  // console.log(`[R2] r2Head: Sending HEAD request to ${url}`);
  const res = await client.fetch(url, { method: "HEAD" });
  if (res.status === 404) {
    // console.log(`[R2] r2Head: File does not exist (404)`);
    return { exists: false };
  }
  if (!res.ok) {
    // console.error(`[R2] r2Head: FAILED with status ${res.status}`);
    throw new Error(`R2 HEAD failed ${res.status}`);
  }
  const size = Number(res.headers.get("content-length") ?? 0);
  const contentType = res.headers.get("content-type") ?? undefined;
  // console.log(`[R2] r2Head: EXISTS, size=${size}, contentType=${contentType || 'unknown'}`);
  return { exists: true, size, contentType };
}

export async function r2Get(key: string): Promise<Response> {
  // console.log(`[R2] r2Get: START key="${key}"`);
  const client = getR2Client();
  const url = r2ObjectUrl(key);
  // console.log(`[R2] r2Get: Sending GET request to ${url}`);
  const res = await client.fetch(url, { method: "GET" });
  if (!res.ok) {
    // console.error(`[R2] r2Get: FAILED with status ${res.status}`);
    throw new Error(`R2 GET failed ${res.status}`);
  }
  // console.log(`[R2] r2Get: SUCCESS, status ${res.status}`);
  return res;
}


// lib/r2.server.ts – add this function
export async function r2List(prefix: string): Promise<string[]> {
  // console.log(`[R2] r2List: Listing prefix: ${prefix}`);
  const client = getR2Client();
  const { endpoint, bucket } = getR2Config();
  // Use S3 ListObjectsV2 API
  const url = `${endpoint}/${bucket}?prefix=${encodeURIComponent(prefix)}&list-type=2`;
  const res = await client.fetch(url, { method: "GET" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    // console.error(`[R2] r2List: FAILED ${res.status}: ${txt}`);
    throw new Error(`R2 LIST failed ${res.status}: ${txt}`);
  }
  const xml = await res.text();
  // Quick XML parsing – extract <Key>...</Key> tags
  const keys: string[] = [];
  const regex = /<Key>(.*?)<\/Key>/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    keys.push(match[1]);
  }
  // console.log(`[R2] r2List: Found ${keys.length} keys`);
  return keys;
}