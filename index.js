/**
 * 一键插件更新，宿主半（Host half）。
 *
 * 浏览器半（`exports["./client"]`）在 DSH 的【设置 → 插件】里注册一个「一键更新」标签页。
 * 它不做任何自己的数据采集：检查版本、列出可更新版本、执行更新，全部走官方
 * `pluginManager` 远程服务（`ctx.remote.pluginManager.*`），因此兼容性判断、版本豁免、
 * 回滚与进度事件都由宿主负责，本插件不重复实现。
 *
 * 宿主半只负责让这个 bundle 在 profile 里有一行，并把它加载起来。
 */

/** 宿主插件名（cordis entry name）。 */
export const name = 'plugin-update-all'

/** 需要的宿主服务。 */
export const inject = []

/**
 * 挂载插件。
 * @param ctx - 宿主 cordis 上下文。
 */
export function apply(ctx) {
  ctx.logger?.info?.('plugin-update-all: ready')
}
