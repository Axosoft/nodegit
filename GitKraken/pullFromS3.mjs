import fs from "fs"
import fse from "fs-extra"
import path from "path"
import got from "got"
import stream from "stream"
import util from "util"

import { getDistNames } from "./configHelper.js";

import gkPkgJson from './package.json' with { type: "json" };
import rootPkgJson from '../package.json' with { type: "json" };
import rebuildConfig from "./rebuild_docker_config.json" with { type: "json" };

const { version } = rootPkgJson;
const { gitkrakenPrebuilts: { bucketName } } = gkPkgJson;

const pipeline = util.promisify(stream.pipeline);

const binaryDir = path.resolve(import.meta.dirname, "additional-binaries");
const buildReleaseDir = path.resolve(import.meta.dirname, "..", "build", "Release");

const getBinaryName = (distName, version, arch) => `nodegit-${version}-${arch}-${distName}.node`;
const getFriendlyBinaryName = (distName, arch) => `nodegit-${arch}-${distName}.node`;

const downloadBinaryFromS3 = async binaryName => {
  console.log(`Downloading https://${bucketName}.s3.amazonaws.com/${binaryName}`);
  await pipeline(
    got.stream(`https://${bucketName}.s3.amazonaws.com/${binaryName}`),
    fs.createWriteStream(path.resolve(binaryDir, binaryName))
  )
};

const downloadAllBinaries = async () => {
  const arch = process.arch;
  const distNames = getDistNames(rebuildConfig);
  for (const distName of distNames) {
    const binaryName = getBinaryName(distName, version, arch);
    await downloadBinaryFromS3(binaryName);
  }
};

const copyBinaries = async () => {
  const arch = process.arch;
  const distNames = getDistNames(rebuildConfig);
  for (const distName of distNames) {
    const binaryName = getBinaryName(distName, version, arch);
    const friendlyBinaryName = getFriendlyBinaryName(distName, arch);

    await fse.copy(
      path.resolve(binaryDir, binaryName),
      path.resolve(buildReleaseDir, friendlyBinaryName)
    );
  }
};

const cleanup = async () => {
  await fse.remove(binaryDir);
  await fse.remove(path.join(import.meta.dirname, 'node_modules'));
};

export const acquireBinariesFromS3 = async () => {
  await fse.ensureDir(binaryDir);
  await downloadAllBinaries();
  await copyBinaries();
  await cleanup();
};

if (process.argv[1] === import.meta.filename) {
  try {
    await acquireBinariesFromS3();
  }
  catch(error) {
    console.error('Pull from S3 failed: ', error);
    process.exit(1);
  };
}
