const path = require("path");
const exec = require("executive");
const fp = require("lodash/fp");
const fse = require("fs-extra");

const { version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");

const binaryDir = path.resolve(__dirname, "additional-binaries");
const buildReleaseDir = path.resolve(__dirname, "..", "build", "Release");

const getBinaryName = (distName, version) => `nodegit-${version}-${distName}.node`;

const buildWithDockerImage = async (distName, dockerImage) => {
  const { stdout: groupId } = await exec("id -g");
  const { stdout: userId } = await exec("id -u");
  const { stdout: username } = await exec("whoami");

  const electronVersion = process.env.GK_ELECTRON_TARGET;
  const envGroupId = `-e "HOST_GROUP_ID=${fp.trim(groupId)}"`;
  const envUserId = `-e HOST_USER_ID=${fp.trim(userId)}`;
  const envUsername = `-e HOST_USERNAME=${fp.trim(username)}`;
  const environmentVars = `${envGroupId} ${envUserId} ${envUsername}`;
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
}

const buildAllImages = async () => {
  for (const [distName, dockerImage] of fp.entries(rebuildConfig)) {
    await buildWithDockerImage(distName, dockerImage);
  }
}

const pullAllImages = async () => {
  for (const [distName, dockerImage] of fp.entries(rebuildConfig)) {
    await exec(
      `docker pull ${dockerImage}`,
      { strict: true }
    );
  }
}

const copyBinaries = async () => {
  for (const [distName] of fp.entries(rebuildConfig)) {
    const binaryName = getBinaryName(distName, version);
    await fse.copy(
      path.join(binaryDir, binaryName),
      path.join(buildReleaseDir, binaryName)
    );
  }
}

const rebuildInDocker = async () => {
  await pullAllImages();
  await buildAllImages();
  await copyBinaries();
}

module.exports = rebuildInDocker;

if (require.main === module) {
  module.exports();
}
