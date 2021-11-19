const path = require("path");
const exec = require("executive");
const fp = require("lodash/fp");
const fse = require("fs-extra");

const { version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");
const { getDistNames } = require("./configHelper");

const binaryDir = path.resolve(__dirname, "additional-binaries");
const buildReleaseDir = path.resolve(__dirname, "..", "build", "Release");

const getBinaryName = (distName, version) => `nodegit-${version}-${distName}.node`;

const buildWithDockerImage = async (distName, dockerImage, patchedDistName, configEnv = '') => {
  const { stdout: groupId } = await exec("id -g");
  const { stdout: userId } = await exec("id -u");
  const { stdout: username } = await exec("whoami");

  const electronVersion = process.env.GK_ELECTRON_TARGET;
  const envElectronVersion = `-e "GK_ELECTRON_TARGET=${fp.trim(electronVersion)}"`;
  const envGroupId = `-e "HOST_GROUP_ID=${fp.trim(groupId)}"`;
  const envUserId = `-e HOST_USER_ID=${fp.trim(userId)}`;
  const envUsername = `-e HOST_USERNAME=${fp.trim(username)}`;
  const environmentVars = `${envElectronVersion} ${envGroupId} ${envUserId} ${envUsername} ${configEnv}`;
  const volume = `--volume=${path.resolve(__dirname, "..")}:/nodegit`;
  const nodeGypArch = "--arch=x64";
  const nodeGypTarget = `--target=v${electronVersion}`;
  const nodeGypDistUrl = "--dist-url=https://electronjs.org/headers";
  const nodeGypArguments = `${nodeGypArch} ${nodeGypTarget} ${nodeGypDistUrl}`;

  await exec(
    `docker run ${environmentVars} ${volume} ${dockerImage} ${nodeGypArguments}`,
    { strict: true }
  );

  await fse.copy(
    path.join(buildReleaseDir, "nodegit.node"),
    path.join(binaryDir, getBinaryName(distName, version))
  );

  if (patchedDistName) {
    await fse.copy(
      path.join(buildReleaseDir, "nodegit-patched.node"),
      path.join(binaryDir, getBinaryName(patchedDistName, version))
    );
  }
}

const buildAllImages = async () => {
  for (const [distName, { image: dockerImage, patchedDistName, env }] of fp.entries(rebuildConfig)) {
    await buildWithDockerImage(distName, dockerImage, patchedDistName, env);
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
    const binaryName = getBinaryName(distName, version);
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
