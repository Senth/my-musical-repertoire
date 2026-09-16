/*
 * Stamped by deploy.yml, which writes the same variable into `.env.local`
 * before `Build web`. Both places must fall back the same way: the variable
 * is set on every deploy, so "dev" can only mean a local build or the dev
 * server, and the stamp must not be able to disguise one as a deploy.
 */
export const buildId = process.env.EXPO_PUBLIC_BUILD ?? "dev";
