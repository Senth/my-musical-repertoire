const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

const literal = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A watched write here clears the SSR module registry mid-render (expo/expo#51871).
config.resolver.blockList = [
	...[config.resolver.blockList ?? []].flat(),
	new RegExp(`^${literal(path.join(__dirname, ".tmp"))}([\\\\/].*)?$`),
	new RegExp(`^${literal(path.join(__dirname, ".expo", "devices.json"))}$`),
];

module.exports = config;
