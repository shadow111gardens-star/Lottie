import { mkdir, readdir, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
const environment = { ...process.env };
if (process.platform === 'win32') {
  const cache = path.join(tmpdir(), 'svgforge-test-java21');
  await mkdir(cache, { recursive: true });
  let javaHome = (await readdir(cache)).find(name => name.startsWith('jdk-'));
  if (!javaHome) {
    console.log('Preparing a temporary Java runtime for Firebase emulator tests…');
    const response = await fetch('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse');
    if (!response.ok) throw new Error('Could not resolve the emulator Java runtime.');
    const [release] = await response.json();
    const archive = await fetch(release.binary.package.link);
    if (!archive.ok) throw new Error('Could not download the emulator Java runtime.');
    const bytes = Buffer.from(await archive.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== release.binary.package.checksum) throw new Error('Java runtime checksum mismatch.');
    const zip = path.join(cache, 'runtime.zip');
    await writeFile(zip, bytes);
    await new Promise((resolve, reject) => {
      const script = `Expand-Archive -LiteralPath '${zip.replaceAll("'", "''")}' -DestinationPath '${cache.replaceAll("'", "''")}' -Force`;
      const child = spawn('powershell.exe', ['-NoProfile', '-Command', script], { stdio: 'inherit', windowsHide: true });
      child.on('exit', code => code === 0 ? resolve() : reject(new Error('Could not unpack the Java runtime.')));
    });
    javaHome = (await readdir(cache)).find(name => name.startsWith('jdk-'));
  }
  environment.JAVA_HOME = path.join(cache, javaHome);
  await access(path.join(environment.JAVA_HOME, 'bin/java.exe'));
  const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path');
  const existingPath = environment[pathKey] || '';
  if (pathKey) delete environment[pathKey];
  environment.PATH = `${path.dirname(process.execPath)};${path.join(environment.JAVA_HOME, 'bin')};${existingPath}`;
  // Windows packaged app contexts can reject AF_UNIX connects. An unavailable
  // socket directory makes OpenJDK's pipe listener fall back to TCP loopback.
  environment.JAVA_TOOL_OPTIONS = `${environment.JAVA_TOOL_OPTIONS || ''} -Djdk.net.unixdomain.tmpdir=${path.join(cache, 'unavailable-socket-directory')}`;
}
const args = ['emulators:exec', '--only', 'firestore,auth', '--project', 'demo-svgforge', `"${process.execPath}" tests/cloud-flow.mjs`];
const cli = process.platform === 'win32' ? path.join(process.env.APPDATA, 'npm/node_modules/firebase-tools/lib/bin/firebase.js') : null;
const child = spawn(cli ? process.execPath : 'firebase', cli ? [cli, ...args] : args, { env: environment, stdio: 'inherit', windowsHide: true });
child.on('exit', code => { process.exitCode = code ?? 1; });
