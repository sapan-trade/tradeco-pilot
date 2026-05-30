import crypto from "node:crypto";

export interface PresignedUploadUrl {
  uploadUrl: string;
  fileToken: string;
  expiresAt: number;
}

export interface ObjectStore {
  presignUpload(args: { kind: "csv" | "image"; orgId: string }): Promise<PresignedUploadUrl>;
  putObject(fileToken: string, content: Buffer | string, contentType?: string): Promise<void>;
  getObject(fileToken: string): Promise<Buffer | null>;
}

const memStore = new Map<string, { content: Buffer; contentType: string }>();

class InMemoryObjectStore implements ObjectStore {
  async presignUpload({ kind, orgId }: { kind: "csv" | "image"; orgId: string }) {
    const fileToken = `${orgId}/${kind}/${crypto.randomBytes(12).toString("hex")}`;
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    return {
      uploadUrl: `${base}/api/connectors/upload/put?token=${encodeURIComponent(fileToken)}`,
      fileToken,
      expiresAt: Date.now() + 60 * 60 * 1000,
    };
  }
  async putObject(fileToken: string, content: Buffer | string, contentType = "application/octet-stream") {
    const buf = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    memStore.set(fileToken, { content: buf, contentType });
  }
  async getObject(fileToken: string) {
    return memStore.get(fileToken)?.content ?? null;
  }
}

class S3ObjectStore implements ObjectStore {
  private fallback = new InMemoryObjectStore();
  async presignUpload(args: { kind: "csv" | "image"; orgId: string }): Promise<PresignedUploadUrl> {
    // TODO: replace with @aws-sdk/s3-request-presigner once AWS_S3_BUCKET + AWS creds land.
    console.log("[s3-stub] presignUpload called but real S3 SDK not wired; using memory store.");
    return this.fallback.presignUpload(args);
  }
  async putObject(fileToken: string, content: Buffer | string, contentType?: string) {
    return this.fallback.putObject(fileToken, content, contentType);
  }
  async getObject(fileToken: string) {
    return this.fallback.getObject(fileToken);
  }
}

let cached: ObjectStore | null = null;

export function getObjectStore(): ObjectStore {
  if (cached) return cached;
  cached = process.env.AWS_S3_BUCKET ? new S3ObjectStore() : new InMemoryObjectStore();
  return cached;
}

export function resetObjectStoreForTests(): void {
  memStore.clear();
  cached = null;
}
