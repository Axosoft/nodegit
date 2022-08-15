const aws = require('aws-sdk');
const fs = require("fs");
const path = require("path");

const { gitkrakenPrebuilts: { bucketName: defaultBucketName } } = require('./package.json');
const { version } = require("../package.json");
const rebuildConfig = require("./rebuild_docker_config.json");
const { getDistNames } = require("./configHelper");
const { getOpenSSLPackageName } = require('../utils/acquireOpenSSL');

const binaryDir = path.resolve(__dirname, "additional-binaries");
const projectRoot = path.resolve(__dirname, '..');

const getBinaryName = (distName, version) => `nodegit-${version}-${distName}.node`;

const s3 = new aws.S3();

const uploadBinaryToS3 = (binaryName, bucketName, pathToFile) =>
  s3.upload({
    Body: fs.createReadStream(pathToFile || path.join(binaryDir, binaryName)),
    Bucket: bucketName,
    Key: binaryName,
    ACL: "public-read"
  }).promise();

const uploadAllBinaries = async () => {
  const distNames = getDistNames(rebuildConfig);
  for (const distName of distNames) {
    const binaryName = getBinaryName(distName, version);
    await uploadBinaryToS3(binaryName, defaultBucketName);
  }
}

const uploadOpenSSL = async () => {
  const binaryName = getOpenSSLPackageName();
  const pathToFile = path.join(projectRoot, binaryName);
  await uploadBinaryToS3(binaryName, defaultBucketName, pathToFile);
};

module.exports = {
  uploadAllBinaries,
  uploadOpenSSL
};

if (require.main === module) {
  const uploadFn = process.argv[2] === 'upload-openssl'
    ? module.exports.uploadOpenSSL
    : module.exports.uploadAllBinaries;
  uploadFn().catch((error) => {
    console.error('Push to S3 failed: ', error);
    process.exit(1);
  });
}
