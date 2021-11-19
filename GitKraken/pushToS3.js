const aws = require('aws-sdk');
const fs = require("fs");
const path = require("path");

const { gitkrakenPrebuilts: { bucketName } } = require('./package.json');
const { version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");
const { getDistNames } = require("./configHelper");

const binaryDir = path.resolve(__dirname, "additional-binaries");

const getBinaryName = (distName, version) => `nodegit-${version}-${distName}.node`;

const s3 = new aws.S3();

const uploadBinaryToS3 = binaryName =>
  s3.upload({
    Body: fs.createReadStream(path.join(binaryDir, binaryName)),
    Bucket: bucketName,
    Key: binaryName,
    ACL: "public-read"
  }).promise();

const uploadAllBinaries = async () => {
  const distNames = getDistNames(rebuildConfig);
  for (const distName of distNames) {
    const binaryName = getBinaryName(distName, version);
    await uploadBinaryToS3(binaryName);
  }
}

module.exports = uploadAllBinaries;

if (require.main === module) {
  module.exports().catch((error) => {
    console.error('Push to S3 failed: ', error);
    process.exit(1);
  });
}
