import "server-only";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export interface StorageProvider {
  /** Saves a file and returns a publicly reachable URL. */
  save(companyId: string, fileName: string, data: Buffer, contentType: string): Promise<string>;
}

const UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads");

class LocalStorageProvider implements StorageProvider {
  async save(companyId: string, fileName: string, data: Buffer): Promise<string> {
    const ext = path.extname(fileName) || "";
    const safeName = `${randomUUID()}${ext}`;
    const dir = path.join(UPLOAD_ROOT, companyId);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, safeName), data);
    return `/uploads/${companyId}/${safeName}`;
  }
}

class S3StorageProvider implements StorageProvider {
  async save(): Promise<string> {
    // Real S3-compatible object storage integration point. Wire up
    // @aws-sdk/client-s3 here using S3_BUCKET / S3_REGION / S3_ACCESS_KEY_ID /
    // S3_SECRET_ACCESS_KEY once those are provisioned for production.
    throw new Error(
      "S3 storage is not configured yet. Set STORAGE_DRIVER=local for development, or implement S3StorageProvider.save()."
    );
  }
}

export function getStorageProvider(): StorageProvider {
  if (process.env.STORAGE_DRIVER === "s3") {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}
