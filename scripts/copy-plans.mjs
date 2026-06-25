import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const srcPlansDir = path.join(rootDir, 'src', 'plans');
const distPlansDir = path.join(rootDir, 'dist', 'plans');

if (fs.existsSync(srcPlansDir)) {
    fs.mkdirSync(distPlansDir, { recursive: true });
    const files = fs.readdirSync(srcPlansDir);
    let copiedCount = 0;
    for (const file of files) {
        if (file.endsWith('.json')) {
            fs.copyFileSync(
                path.join(srcPlansDir, file),
                path.join(distPlansDir, file)
            );
            copiedCount++;
        }
    }
    console.log(`Copied ${copiedCount} plan(s) from src/plans/ to dist/plans/`);
} else {
    console.log('No src/plans directory found, skipping plan copy.');
}
