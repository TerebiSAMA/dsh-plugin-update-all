/**
 * 一键插件更新：状态仓库与动作。
 *
 * 所有版本事实都来自官方 `pluginManager` 远程服务：
 * - `listBundles()` 列出 profile 里已装、且被判为「可更新」的 bundle；
 * - `listVersions(name)` 直接问 registry（不经过插件市场索引，所以市场没收录的插件也能查）；
 * - `updateBundle(name, version, { spec, requestId })` 执行更新，宿主负责兼容性、豁免与回滚。
 *
 * Git 源（`update: 'git'`）的 bundle 由 `listVersions` 明确拒绝，所以这一类自己解析来源，
 * 取上游 HEAD 提交与该提交上的 package.json 版本，再把钉住完整 commit 的 spec 交给宿主。
 */

import { createSnapshotStore, type SnapshotStore } from '@deepseek-ai/dsh-client-store'

/** 一个可更新插件的检查结果。 */
export interface UpdateItem {
  /** npm 包名。 */
  readonly name: string
  /** 已安装版本。 */
  readonly installed: string
  /** 找到的更新版本。 */
  readonly latest?: string
  /** 更新方式。 */
  readonly kind: 'registry' | 'git'
  /** 检查结论。 */
  readonly status: 'up-to-date' | 'update' | 'blocked' | 'unknown'
  /** 不能更新或读不出来时的原因。 */
  readonly reason?: string
  /** Git 源的目标 spec（钉住完整 commit）。 */
  readonly spec?: string
  /** Git 源的上游提交。 */
  readonly commit?: string
  /** 版本的发布时间。 */
  readonly publishedAt?: string
}

/** 一次更新的结果。 */
export interface UpdateOutcome {
  readonly name: string
  readonly ok: boolean
  readonly message: string
}

/** 标签页共享的状态。 */
export interface UpdateState {
  /** `idle` 尚未检查；`checking` 检查中；`ready` 有结论；`updating` 更新中；`error` 检查失败。 */
  readonly status: 'idle' | 'checking' | 'ready' | 'updating' | 'error'
  /** 逐个插件的检查结论。 */
  readonly items: readonly UpdateItem[]
  /** 本轮更新的逐条结果。 */
  readonly outcomes: readonly UpdateOutcome[]
  /** 检查失败时的原因。 */
  readonly error?: string
  /** 当前正在更新的插件与宿主阶段。 */
  readonly progress?: { readonly name: string; readonly step: string }
}

/** 标签页通过注入拿到的动作。 */
export interface UpdateFace {
  /** 渲染进程绑定为 `useUpdates` 的响应式状态源。 */
  readonly hooks: { readonly updates: SnapshotStore<UpdateState> }
  /** 标签页第一次渲染时检查一次。 */
  ensure: () => void
  /** 重新检查所有插件。 */
  check: () => void
  /** 更新所有可更新的插件。 */
  updateAll: () => void
}

const INITIAL: UpdateState = { status: 'idle', items: [], outcomes: [] }

/** Git 仓库 shorthand 与 URL 解析出的目标。 */
interface GitTarget {
  readonly owner: string
  readonly repo: string
  /** 仓库内的子目录（pnpm 的 `path:` 片段）。 */
  readonly path?: string
}

/** 一次 Git 上游查询的结果。 */
interface GitHead {
  readonly sha: string
  readonly message: string
  readonly version?: string
}

/**
 * 远程调用的信封：宿主对每个 Remote 方法都答 `{ ok, value, error }`。
 * @param answer - 远程方法的原始应答。
 * @returns 成功时的值。
 * @throws 失败或被拒绝时抛出带宿主说明的错误。
 */
function unwrap<T>(answer: any): T {
  if (answer?.ok === true) return answer.value as T
  const reason = answer?.error?.message ?? answer?.error?.code ?? 'the Host refused the call'
  throw new Error(String(reason))
}

/** 把错误压成一行文字。 */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  const text = String(error ?? '')
  return text === '' ? 'unknown error' : text
}

/**
 * 解析一个 Git 形式的安装来源。
 * @param source - profile 里保存的来源，例如 `github:owner/repo#<commit>`。
 * @returns 仓库坐标，或 undefined 表示读不出来。
 */
export function parseGitSource(source: string | undefined): GitTarget | undefined {
  if (source === undefined) return undefined
  const withoutFragment = source.split('#')[0]?.trim() ?? ''
  if (withoutFragment === '') return undefined

  let rest = withoutFragment
  const shorthand = /^(?:github|gitlab|bitbucket|gist):(.+)$/i.exec(withoutFragment)
  if (shorthand !== null) {
    rest = shorthand[1] ?? ''
  } else {
    const url = /^(?:git\+)?(?:https?|git|ssh):\/\/[^/]+\/(.+?)(?:\.git)?$/i.exec(withoutFragment)
    if (url !== null) rest = url[1] ?? ''
    else return undefined
  }

  let path: string | undefined
  const withPath = /^(.*?)\/path:(.+)$/.exec(rest)
  if (withPath !== null) {
    rest = withPath[1] ?? ''
    path = withPath[2]
  }
  const parts = rest.split('/').filter(part => part !== '')
  const owner = parts[0]
  const repo = parts[1]?.replace(/\.git$/i, '')
  if (owner === undefined || owner === '' || repo === undefined || repo === '') return undefined
  return { owner, repo, ...path === undefined ? {} : { path } }
}

/**
 * 比较两个语义化版本的大小。
 * @param left - 左边版本。
 * @param right - 右边版本。
 * @returns 大于 0 表示 left 更新，等于 0 表示相同，小于 0 表示 left 更旧。
 */
export function compareVersions(left: string, right: string): number {
  const parse = (value: string): { readonly core: number[]; readonly pre: string } => {
    const [core = '', pre = ''] = value.split('-', 2)
    const parts = core.split('.').map(part => Number.parseInt(part, 10))
    return { core: [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0], pre }
  }
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    const diff = (a.core[index] ?? 0) - (b.core[index] ?? 0)
    if (diff !== 0) return diff
  }
  if (a.pre === b.pre) return 0
  if (a.pre === '') return 1
  if (b.pre === '') return -1
  return a.pre < b.pre ? -1 : 1
}

/** 拥有这个控制器的标签页。 */
export class UpdateController {
  /** 共享状态源。 */
  readonly store: SnapshotStore<UpdateState> = createSnapshotStore<UpdateState>(INITIAL)
  private readonly ctx: any
  private current: UpdateState = INITIAL
  private readonly disposers: (() => void)[] = []
  private checked = false
  /** 当前更新请求 id 到插件名的对应。 */
  private readonly running = new Map<string, string>()

  /**
   * 构造控制器。
   * @param ctx - 浏览器插件上下文。
   */
  constructor(ctx: any) {
    this.ctx = ctx
    this.disposers.push(ctx.remote.$on('plugin-manager/update-state', (payload: any) => { this.onProgress(payload) }))
  }

  /** 取消订阅。 */
  dispose(): void {
    for (const dispose of this.disposers) dispose()
    this.disposers.length = 0
  }

  /**
   * 标签页拿到的动作。
   * @returns 注入用 face。
   */
  face(): UpdateFace {
    return {
      hooks: { updates: this.store },
      ensure: () => { void this.ensure() },
      check: () => { void this.check() },
      updateAll: () => { void this.updateAll() },
    }
  }

  /** 发布状态。 */
  private publish(next: Partial<UpdateState>): void {
    this.current = { ...this.current, ...next }
    this.store.set(this.current)
  }

  /** 第一次渲染时检查一次。 */
  private async ensure(): Promise<void> {
    if (this.checked) return
    this.checked = true
    await this.check()
  }

  /** 检查所有可更新的插件。 */
  private async check(): Promise<void> {
    this.publish({ status: 'checking', error: undefined, outcomes: [] })
    try {
      const bundles = unwrap<any[]>(await this.ctx.remote.pluginManager.listBundles())
      const updatable = (bundles ?? []).filter(bundle => bundle?.installed === true && (bundle?.update === 'registry' || bundle?.update === 'git'))
      const items: UpdateItem[] = []
      for (const bundle of updatable) {
        items.push(bundle.update === 'git' ? await this.checkGit(bundle) : await this.checkRegistry(bundle))
      }
      this.publish({ status: 'ready', items })
    } catch (error) {
      this.publish({ status: 'error', error: messageOf(error) })
    }
  }

  /**
   * 检查一个 registry 源的插件。
   * @param bundle - 宿主列出的 bundle。
   * @returns 检查结论。
   */
  private async checkRegistry(bundle: any): Promise<UpdateItem> {
    const name = String(bundle.name)
    const installed = String(bundle.version ?? '')
    try {
      const answer = unwrap<any>(await this.ctx.remote.pluginManager.listVersions(name, {}))
      if (answer?.status !== 'listed') {
        return { name, installed, kind: 'registry', status: 'blocked', reason: String(answer?.reason ?? 'refused') }
      }
      const versions = (answer.versions ?? []) as any[]
      const usable = versions.filter(version => version?.incompatible === undefined)
      if (usable.length === 0) {
        const first = versions[0]
        return {
          name,
          installed,
          kind: 'registry',
          status: 'blocked',
          ...first?.publishedAt === undefined ? {} : { publishedAt: String(first.publishedAt) },
          reason: first?.incompatible === undefined ? 'no newer version' : 'the newest version does not accept this DSH',
        }
      }
      const latest = usable[0]
      return {
        name,
        installed,
        latest: String(latest.version),
        kind: 'registry',
        status: 'update',
        ...latest?.publishedAt === undefined ? {} : { publishedAt: String(latest.publishedAt) },
      }
    } catch (error) {
      return { name, installed, kind: 'registry', status: 'unknown', reason: messageOf(error) }
    }
  }

  /**
   * 检查一个 Git 源的插件：取上游 HEAD 与该提交上的版本。
   * @param bundle - 宿主列出的 bundle。
   * @returns 检查结论。
   */
  private async checkGit(bundle: any): Promise<UpdateItem> {
    const name = String(bundle.name)
    const installed = String(bundle.version ?? '')
    const target = parseGitSource(bundle.source ?? bundle.installTarget?.spec)
    if (target === undefined) {
      return { name, installed, kind: 'git', status: 'unknown', reason: 'the Git source cannot be read' }
    }
    try {
      const head = await this.readGitHead(target)
      const latest = head.version
      if (latest === undefined) {
        return { name, installed, kind: 'git', status: 'unknown', commit: head.sha, reason: 'the upstream commit has no readable version' }
      }
      if (compareVersions(latest, installed) <= 0) {
        return { name, installed, latest, kind: 'git', status: 'up-to-date', commit: head.sha }
      }
      return {
        name,
        installed,
        latest,
        kind: 'git',
        status: 'update',
        commit: head.sha,
        spec: this.gitSpec(target, head.sha),
      }
    } catch (error) {
      return { name, installed, kind: 'git', status: 'unknown', reason: messageOf(error) }
    }
  }

  /**
   * 读上游仓库的 HEAD 提交与它上面的包版本。
   * @param target - 仓库坐标。
   * @returns 提交与版本。
   */
  private async readGitHead(target: GitTarget): Promise<GitHead> {
    const commits = await fetch(`https://api.github.com/repos/${target.owner}/${target.repo}/commits?per_page=1`, {
      headers: { accept: 'application/vnd.github+json' },
    })
    if (!commits.ok) throw new Error(`GitHub answered ${commits.status}`)
    const list = (await commits.json()) as any[]
    const head = list[0]
    const sha = String(head?.sha ?? '')
    if (sha === '') throw new Error('GitHub returned no commit')
    const message = String(head?.commit?.message ?? '').split('\n')[0] ?? ''
    const file = `${target.path ?? ''}${target.path === undefined ? '' : '/'}package.json`
    const manifest = await fetch(`https://raw.githubusercontent.com/${target.owner}/${target.repo}/${sha}/${file}`)
    if (!manifest.ok) throw new Error(`the upstream package.json answered ${manifest.status}`)
    const parsed = JSON.parse(await manifest.text()) as any
    const version = typeof parsed.version === 'string' ? parsed.version : undefined
    return { sha, message, ...version === undefined ? {} : { version } }
  }

  /**
   * 生成钉住完整 commit 的 Git spec。
   * @param target - 仓库坐标。
   * @param sha - 目标提交。
   * @returns 安装 spec。
   */
  private gitSpec(target: GitTarget, sha: string): string {
    const base = `github:${target.owner}/${target.repo}`
    const withPath = target.path === undefined ? '' : `/path:${target.path}`
    return `${base}${withPath}#${sha}`
  }

  /** 宿主报告一次更新阶段。 */
  private onProgress(payload: any): void {
    const requestId = String(payload?.requestId ?? '')
    const name = this.running.get(requestId)
    if (name === undefined) return
    this.publish({ progress: { name, step: String(payload?.step ?? '') } })
  }

  /** 更新所有可更新的插件。 */
  private async updateAll(): Promise<void> {
    const targets = this.current.items.filter(item => item.status === 'update' && item.latest !== undefined)
    if (targets.length === 0) return
    this.publish({ status: 'updating', outcomes: [], error: undefined })
    const outcomes: UpdateOutcome[] = []
    for (const item of targets) {
      const requestId = `dsh-plugin-update-all-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
      this.running.set(requestId, item.name)
      this.publish({ progress: { name: item.name, step: 'checking' } })
      try {
        const answer = await this.ctx.remote.pluginManager.updateBundle(item.name, item.latest, {
          requestId,
          ...item.spec === undefined ? {} : { spec: item.spec },
        })
        if (answer?.ok !== true) {
          outcomes.push({ name: item.name, ok: false, message: String(answer?.error?.message ?? 'the Host refused the update') })
        } else {
          outcomes.push({ name: item.name, ok: answer.value?.result?.changed === true, message: this.describeOutcome(answer.value) })
        }
      } catch (error) {
        outcomes.push({ name: item.name, ok: false, message: messageOf(error) })
      } finally {
        this.running.delete(requestId)
      }
    }
    this.publish({ status: 'ready', outcomes, progress: undefined })
    await this.check()
  }

  /**
   * 把宿主的更新结果读成一行文字。
   * @param result - 宿主的更新结果。
   * @returns 一行说明。
   */
  private describeOutcome(result: any): string {
    const application = String(result?.result?.application ?? 'unknown')
    const changed = result?.result?.changed === true
    const error = result?.result?.error?.diagnostic
    if (error !== undefined && error !== '') return String(error)
    if (!changed) return application
    return application === 'applied' ? 'installed' : application
  }
}
