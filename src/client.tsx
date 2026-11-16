/**
 * 一键插件更新，浏览器半。
 *
 * 在 DSH 的【设置 → 插件】里注册一个「一键更新」标签页：一键检查所有已装插件有没有
 * 新版本，一键全部升级。所有事实与动作都走官方 `pluginManager` 远程服务，
 * 本插件不直接碰 profile 的 package.json 或 pnpm。
 */

import * as React from 'react'
import { useEffect } from 'react'
import { Button, IconRefreshOutlineRegular, Pill, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import { en, zh } from './locales.ts'
import { PAGE_CSS } from './styles.ts'
import { UpdateController, type UpdateItem, type UpdateState } from './store.ts'

/** 字典命名空间。 */
const NS = 'pluginUpdateAll'

/** 需要的浏览器服务。 */
export const inject = ['slots', 'locale', 'remote', 'remote.pluginManager']

/** 样式表 id。 */
const STYLE_ID = 'plugin-update-all-style'

/**
 * 注入页面样式（幂等）。
 */
function useStyle(): void {
  React.useEffect(() => {
    if (document.getElementById(STYLE_ID) !== null) return
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = PAGE_CSS
    document.head.appendChild(style)
  }, [])
}

/** 一个插件行。 */
function ItemRow({ item, t }: { readonly item: UpdateItem; readonly t: Translate }): React.ReactNode {
  const status = item.status === 'update'
    ? { state: 'ongoing' as const, label: t('update') }
    : item.status === 'up-to-date'
      ? { state: 'done' as const, label: t('upToDate') }
      : item.status === 'blocked'
        ? { state: 'error' as const, label: t('blocked') }
        : { state: 'error' as const, label: t('unknown') }
  return (
    <li className="pua-row">
      <div className="pua-rowMain">
        <span className="pua-name">{item.name}</span>
        <span className="pua-meta">
          {item.kind === 'git' ? t('git') : t('registry')}
          {item.commit === undefined ? '' : ` · ${item.commit.slice(0, 8)}`}
        </span>
        {item.reason === undefined ? null : <span className="pua-reason">{item.reason}</span>}
      </div>
      <div className="pua-versions">
        <span>{item.installed === '' ? '—' : item.installed}</span>
        {item.latest === undefined ? null : (
          <>
            <span className="pua-arrow">→</span>
            <span>{item.latest}</span>
          </>
        )}
        <Pill>
          <StateDot state={status.state} size={8} />
          {status.label}
        </Pill>
      </div>
    </li>
  )
}

/** 文案函数。 */
type Translate = (key: string, values?: Record<string, string | number>) => string

/**
 * 渲染「一键更新」标签页。
 * @param props - 标签页属性（注入的动作与状态源）。
 * @returns 页面内容。
 */
export function UpdateAllSection(props: any): React.ReactNode {
  useStyle()
  const state = props.useUpdates((snapshot: UpdateState) => snapshot) as UpdateState
  const t = props.t as Translate
  const busy = state.status === 'checking' || state.status === 'updating'
  const updatable = state.items.filter(item => item.status === 'update')
  useEffect(() => { props.ensure() }, [props.ensure])

  return (
    <div className="pua-page" data-plugin-tab="update-all">
      <div className="pua-toolbar">
        <Button variant="primary" size="sm" disabled={busy}
          icon={<IconRefreshOutlineRegular size={13} />}
          onClick={() => { props.check() }}>
          {state.status === 'checking' ? t('checking') : t('check')}
        </Button>
        <Button variant="outline" size="sm" disabled={busy || updatable.length === 0}
          onClick={() => { props.updateAll() }}>
          {state.status === 'updating' ? t('updating') : t('updateAll')}
        </Button>
        {state.status === 'ready'
          ? (
            <span className="pua-summary">
              {updatable.length === 0 ? t('summaryNone') : t('summary', { count: updatable.length })}
            </span>
          )
          : null}
      </div>

      {state.progress === undefined ? null : (
        <p className="pua-note" role="status">{state.progress.name} · {state.progress.step}</p>
      )}
      {state.error === undefined ? null : (
        <p className="pua-error" role="alert">{t('error')}: {state.error}</p>
      )}

      {state.items.length === 0
        ? <p className="pua-note">{state.status === 'idle' ? t('idle') : t('empty')}</p>
        : (
          <ul className="pua-list">
            {state.items.map(item => <ItemRow key={item.name} item={item} t={t} />)}
          </ul>
        )}

      {state.outcomes.length === 0 ? null : (
        <>
          <h4 className="pua-note">{t('outcomes')}</h4>
          <ul className="pua-outcomes">
            {state.outcomes.map(outcome => (
              <li key={outcome.name} className="pua-outcome">
                <StateDot state={outcome.ok ? 'done' : 'error'} size={8} />
                <span>{outcome.name}</span>
                <span className="pua-meta">{outcome.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="pua-note">{t('restartHint')}</p>
    </div>
  )
}

/**
 * 挂载「一键更新」标签页。
 * @param ctx - 浏览器插件上下文。
 */
export function apply(ctx: any): void {
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'plugin-update-all: dictionaries')
  const controller = new UpdateController(ctx)
  const face = controller.face()
  ctx.effect(() => () => { controller.dispose() }, 'plugin-update-all: controller')
  ctx.effect(() => {
    const disposers = [
      ctx.remote.$on('plugin-manager/changed', () => { face.check() }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'plugin-update-all: host invalidations')
  ctx.slots.inject('plugins.tab', () => ctx.slots.register({
    name: 'plugins.tab', id: 'update-all', order: 30, label: () => t('title'), locale: NS, inject: () => face,
  }, UpdateAllSection))
}
