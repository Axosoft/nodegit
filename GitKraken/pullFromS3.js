const fs = require("fs");
const fse = require("fs-extra");
const fp = require("lodash/fp");
const path = require("path");
const request = require("request");

const { baseNodeGitVersion: version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");

const bucketName = `${process.env.BUCKET_NAME}`;
const binaryDir = path.resolve(__dirname, "additional-binaries");
const buildReleaseDir = path.resolve(__dirname, "..", "build", "Release");

const getBinaryName = (distName, version) => `nodegit-${version}-${distName}.node`;
const getFriendlyBinaryName = distName => `nodegit-${distName}.node`

const downloadBinaryFromS3 = binaryName => new Promise((resolve, reject) => {
  const writeStream = fs.createWriteStream(path.resolve(binaryDir, binaryName))
  request(`https://${bucketName}.s3.amazonaws.com/${binaryName}`).pipe(writeStream);

  writeStream.on("finish", resolve);
  writeStream.on("error", reject);
})

const downloadAllBinaries = async () => {
  for (const [distName] of fp.entries(rebuildConfig)) {
    const binaryName = getBinaryName(distName, version);
    await downloadBinaryFromS3(binaryName);
  }
}

const copyBinaries = async () => {
  for (const [distName] of fp.entries(rebuildConfig)) {
    const binaryName = getBinaryName(distName, version);
    const friendlyBinaryName = getFriendlyBinaryName(distName);

    await fse.copy(
      path.resolve(binaryDir, binaryName),
      path.resolve(buildReleaseDir, friendlyBinaryName)
    );
  }
}

const acquireBinariesFromS3 = async () => {
  await fse.ensureDir(binaryDir);
  await downloadAllBinaries();
  await copyBinaries();
}

module.exports = acquireBinariesFromS3;

if (require.main === module) {
  module.exports();
}
