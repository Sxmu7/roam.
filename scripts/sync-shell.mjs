import {readFile,writeFile} from 'node:fs/promises';
const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
await writeFile(new URL('../app/shell.ts',import.meta.url),'export const shell = '+JSON.stringify(html)+';\n');
