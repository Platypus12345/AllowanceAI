const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// Resolve @/* TypeScript path aliases (same as tsconfig paths)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    const target = path.join(projectRoot, moduleName.slice(2));
    return context.resolveRequest(context, target, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
