"use strict";

const path = require("path");

function loadWithMocks(targetRelativePath, mockMap) {
  const targetPath = path.resolve(__dirname, "..", "..", targetRelativePath);
  const touched = [];

  for (const [relativePath, mockExports] of Object.entries(mockMap)) {
    const modulePath = path.resolve(__dirname, "..", "..", relativePath);
    const resolved = require.resolve(modulePath);
    touched.push({ resolved, previous: require.cache[resolved] });
    require.cache[resolved] = {
      id: resolved,
      filename: resolved,
      loaded: true,
      exports: mockExports,
    };
  }

  const resolvedTarget = require.resolve(targetPath);
  touched.push({
    resolved: resolvedTarget,
    previous: require.cache[resolvedTarget],
  });
  delete require.cache[resolvedTarget];

  const loaded = require(resolvedTarget);

  const restore = () => {
    for (let i = touched.length - 1; i >= 0; i -= 1) {
      const item = touched[i];
      if (item.previous) {
        require.cache[item.resolved] = item.previous;
      } else {
        delete require.cache[item.resolved];
      }
    }
  };

  return { loaded, restore };
}

module.exports = { loadWithMocks };
