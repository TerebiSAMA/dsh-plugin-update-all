/**
 * 标签页样式。手写 bundle 不经过 CSS Modules 构建，因此这里是一段普通 CSS 文本，
 * 由组件在挂载时注入一次（幂等）。
 *
 * 取色沿用 DSH 的设计令牌（`--dsw-alias-*`），跟随应用主题自动切换。
 */

/** 页面样式表。 */
export const PAGE_CSS = `
.pua-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
  padding: 4px 2px 24px;
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.5;
}

.pua-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.pua-summary {
  color: var(--dsw-alias-label-secondary);
}

.pua-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pua-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--dsw-alias-border-default);
  border-radius: 8px;
}

.pua-rowMain {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.pua-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pua-meta {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pua-reason {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}

.pua-versions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.pua-arrow {
  color: var(--dsw-alias-label-tertiary);
}

.pua-outcomes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pua-outcome {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--dsw-alias-label-secondary);
}

.pua-note {
  color: var(--dsw-alias-label-secondary);
}

.pua-error {
  color: var(--dsw-alias-label-error, var(--dsw-alias-label-primary));
}
`
