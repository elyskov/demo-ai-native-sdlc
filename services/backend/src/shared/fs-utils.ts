import { promises as fs } from 'node:fs';
import * as path from 'node:path';

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function atomicWriteFile(
  filePath: string,
  data: string | Buffer,
): Promise<void> {
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const tmpPath = path.join(
    dir,
    `.${base}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`,
  );

  await fs.writeFile(tmpPath, data);
  await fs.rename(tmpPath, filePath);
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}
