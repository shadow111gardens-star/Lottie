import { readFile, readdir } from 'node:fs/promises';
import { config } from 'dotenv';
import path from 'node:path';
config({ quiet: true });
const secrets = ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_ACCOUNT_ID', 'R2_ENDPOINT', 'R2_BUCKET_NAME']
  .map(name => process.env[name]).filter(value => value && value.length > 3);
const files = [];
async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await scan(file);
    else if (/\.(html|js|css|json|map)$/.test(file)) files.push(file);
  }
}
await scan('dist');
for (const file of files) {
  const text = await readFile(file, 'utf8');
  if (secrets.some(value => text.includes(value))) throw new Error(`Server storage configuration found in ${file}.`);
  if (/firebase-admin|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID|@aws-sdk\/client-s3/.test(text)) throw new Error(`Server storage code found in ${file}.`);
}
console.log(`PASS ${files.length} production browser assets contain no R2 credentials, R2 configuration values or server storage SDKs`);
