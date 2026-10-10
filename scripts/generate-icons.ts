import sharp from 'sharp';
import {fileURLToPath} from 'node:url';
const source = fileURLToPath(new URL('../public/icons/icon.svg', import.meta.url));
await Promise.all([192, 512].map((size) => sharp(source).resize(size, size).png().toFile(fileURLToPath(new URL(`../public/icons/icon-${size}.png`, import.meta.url)))));
