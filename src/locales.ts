/**
 * 一键插件更新的文案。字典命名空间是 `pluginUpdateAll`。
 */

/** 简体中文字典。 */
export const zh = {
  'title': '一键更新',
  'check': '检查更新',
  'updateAll': '全部更新',
  'checking': '正在检查…',
  'updating': '正在更新…',
  'idle': '点「检查更新」开始。',
  'summary': '{count} 个插件可以更新',
  'summaryNone': '所有插件都是最新的',
  'empty': '没有可更新的插件（只有 profile 里声明、且宿主判为可更新的依赖会被检查）。',
  'installed': '已装',
  'latest': '最新',
  'upToDate': '已是最新',
  'update': '可更新',
  'blocked': '不能更新',
  'unknown': '无法检查',
  'registry': 'registry',
  'git': 'git',
  'incompatible': '与当前 DSH 不兼容',
  'reason': '原因',
  'outcomes': '本轮结果',
  'succeeded': '成功',
  'failed': '失败',
  'restartHint': '部分更新需要重启 DSH 后才会生效。',
  'error': '检查失败',
  'reload': '重新检查',
} as const

/** 英文字典。 */
export const en = {
  'title': 'Update All',
  'check': 'Check for updates',
  'updateAll': 'Update all',
  'checking': 'Checking…',
  'updating': 'Updating…',
  'idle': 'Press "Check for updates" to start.',
  'summary': '{count} plugin(s) can be updated',
  'summaryNone': 'Every plugin is up to date',
  'empty': 'No updatable plugin (only profile dependencies the Host marks updatable are checked).',
  'installed': 'Installed',
  'latest': 'Latest',
  'upToDate': 'Up to date',
  'update': 'Update available',
  'blocked': 'Cannot update',
  'unknown': 'Cannot check',
  'registry': 'registry',
  'git': 'git',
  'incompatible': 'Incompatible with this DSH',
  'reason': 'Reason',
  'outcomes': 'This round',
  'succeeded': 'Succeeded',
  'failed': 'Failed',
  'restartHint': 'Some updates take effect after a restart of DSH.',
  'error': 'Check failed',
  'reload': 'Check again',
} as const

/** 字典键。 */
export type UpdateLocaleKey = keyof typeof zh
