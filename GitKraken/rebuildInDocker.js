const path = require("path");
const exec = require("executive");
const fp = require("lodash/fp");
const fse = require("fs-extra");

const { version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");
const { getDistNames } = require("./configHelper");

const binaryDir = path.resolve(__dirname, "additional-binaries");
const buildReleaseDir = path.resolve(__dirname, "..", "build", "Release");

const getBinaryName = (distName, version, arch) => `nodegit-${version}-${arch}-${distName}.node`;

const targetArch = process.env.GK_TARGET_ARCH ?? process.arch;

const buildWithDockerImage = async (distName, dockerImage, patchedDistName, configEnv = '') => {
  const { stdout: groupId } = await exec("id -g");
  const { stdout: userId } = await exec("id -u");
  const { stdout: username } = await exec("whoami");

  const electronVersion = process.env.GK_ELECTRON_TARGET;

  const envVars = {
    GK_ELECTRON_TARGET: electronVersion,
    ELECTRON_CHROMIUM_VERSION: process.env.ELECTRON_CHROMIUM_VERSION,
    GK_CXXFLAGS: process.env.GK_CXXFLAGS,
    GK_LDFLAGS: process.env.GK_LDFLAGS,
    GK_TARGET_ARCH: targetArch,
    npm_config_arch: targetArch,
    HOST_GROUP_ID: groupId,
    HOST_USER_ID: userId,
    HOST_USERNAME: username,
  }

  const environmentVariables = Object.entries(envVars)
    .map(([key, value]) => `-e "${key}=${fp.trim(value)}"`)
    .join(" ");

  const volume = `--volume=${path.resolve(__dirname, "..")}:/nodegit`;

  console.log(`running docker with ${environmentVariables} ${configEnv} ${volume} ${dockerImage}`);
  await exec(
    `docker run ${environmentVariables} ${configEnv} ${volume} ${dockerImage}`,
    { strict: true }
  );

  await fse.copy(
    path.join(buildReleaseDir, "nodegit.node"),
    path.join(binaryDir, getBinaryName(distName, version, targetArch))
  );

  if (patchedDistName) {
    await fse.copy(
      path.join(buildReleaseDir, "nodegit-patched.node"),
      path.join(binaryDir, getBinaryName(patchedDistName, version, targetArch))
    );
  }
}

const buildAllImages = async () => {
  for (const [distName, { image: dockerImage, patchedDistName, env }] of fp.entries(rebuildConfig)) {
    console.log(`Building ${distName}/${dockerImage}...`);
    await buildWithDockerImage(distName, dockerImage, patchedDistName, env);
    console.log('Done.');
  }
}

const pullAllImages = async () => {
  for (const [distName, { image: dockerImage }] of fp.entries(rebuildConfig)) {
    await exec(
      `docker pull ${dockerImage}`,
      { strict: true }
    );
  }
}

const copyBinaries = async () => {
  const distNames = getDistNames(rebuildConfig);
  for (const distName of distNames) {
    const binaryName = getBinaryName(distName, version, targetArch);
    await fse.copy(
      path.join(binaryDir, binaryName),
      path.join(buildReleaseDir, binaryName)
    );
  }
}

const cleanup = async () => {
  try {
    await fse.remove(path.join(buildReleaseDir, "nodegit-patched.node"));
  } catch { }
  await fse.remove(path.join(buildReleaseDir, "acquireOpenSSL.node"));
  await fse.remove(path.join(buildReleaseDir, "configureLibssh2.node"));
}

const rebuildInDocker = async () => {
  await pullAllImages();
  await buildAllImages();
  await copyBinaries();
  await cleanup();
}

module.exports = rebuildInDocker;

if (require.main === module) {
  module.exports().catch((error) => {
    console.error('Rebuild in docker failed: ', error);
    process.exit(1);
  });
}
