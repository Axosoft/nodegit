const extract = require('extract-zip');
const fs = require('fs-extra');
const path = require('path');
const downloadArtifact = require('@electron/get').downloadArtifact;

async function downloadLibcxxHeaders(outDir, electronVersion, libName) {
  if (await fs.pathExists(path.resolve(outDir, 'include'))) {
    return;
  }

  if (!await fs.pathExists(outDir)) {
    await fs.mkdirp(outDir);
  }

  console.log(`downloading ${libName}_headers`);
  const headers = await downloadArtifact({
    version: electronVersion,
    isGeneric: true,
    artifactName: `${libName}_headers.zip`
  });

  console.log(`unpacking ${libName}_headers from ${headers}`);
  await extract(headers, { dir: outDir });
}

async function downloadLibcxxObjects(outDir, electronVersion, targetArch = 'x64') {
  if (await fs.pathExists(path.resolve(outDir, 'libc++.a'))) {
    return;
  }

  if (!await fs.pathExists(outDir)) {
    await fs.mkdirp(outDir);
  }

  console.log(`downloading libcxx-objects-linux-${targetArch}`);
  const objects = await downloadArtifact({
    version: electronVersion,
    platform: 'linux',
    artifactName: 'libcxx-objects',
    arch: targetArch
  });

  console.log(`unpacking libcxx-objects from ${objects}`);
  await extract(objects, { dir: outDir });
}

async function main() {
  const libcxxObjectsDirPath = process.env.GK_LIBCXX_OBJECTS_DIR;
  const libcxxHeadersDownloadDir = process.env.GK_LIBCXX_HEADERS_DIR;
  const libcxxabiHeadersDownloadDir = process.env.GK_LIBCXXABI_HEADERS_DIR;
  const arch = process.env.GK_ARCH;
  const electronVersion = process.env.GK_ELECTRON_TARGET;

  if (!libcxxObjectsDirPath || !libcxxHeadersDownloadDir || !libcxxabiHeadersDownloadDir) {
    throw new Error('Required build env not set');
  }

  await downloadLibcxxObjects(libcxxObjectsDirPath, electronVersion, arch);
  await downloadLibcxxHeaders(libcxxHeadersDownloadDir, electronVersion, 'libcxx');
  await downloadLibcxxHeaders(libcxxabiHeadersDownloadDir, electronVersion, 'libcxxabi');
}

module.exports = {
  downloadLibcxxHeaders,
  downloadLibcxxObjects
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
