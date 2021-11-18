const fp = require("lodash/fp");

const getDistNames = (rebuildConfig) => {
  const distNames = [];
  for (const [distName, { patchedDistName }] of fp.entries(rebuildConfig)) {
    distNames.push(distName);
    if (patchedDistName) {
      distNames.push(patchedDistName);
    }
  }

  return distNames;
}

module.exports = {
  getDistNames
};
