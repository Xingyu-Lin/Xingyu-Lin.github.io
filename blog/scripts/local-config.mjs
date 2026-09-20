import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url)).replace(/\/$/, '');
export const workspaceId = createHash('sha256').update(repoRoot).digest('hex').slice(0, 12);
export const libraryDirectory = () => process.env.BLOG_LIBRARY_DIR || path.join(os.homedir(), '.local', 'share', 'xingyu-blog', workspaceId);
export const application = 'xingyu-blog-writer';
