---
title: 利用 GitHub Actions 处理 Pull Request 的细节
date: 2024-04-20 14:50:11
updated: 2024-04-20 14:50:11
category: 技术
---
## 缘起
在处理 [ArcticLampyrid/action-wait-for-workflow#171](https://github.com/ArcticLampyrid/action-wait-for-workflow/issues/171) 时，发现 Pull Request 事件中拿到的 `GITHUB_SHA` 是个奇怪的值，于是决定深入了解一下 GitHub Actions 中处理 Pull Request 的细节。

## `pull_request` 事件
参阅相关文档 [Events that trigger workflows#pull_request](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#pull_request) {% blur （相信没读过的不止我一个） %}，发现一些易被忽略的细节：

- GitHub 会生成一个临时的合并提交（merge commit）来触发 `pull_request` 事件，并将 `GITHUB_SHA` 设置为这个合并提交的 SHA，将 `GITHUB_REF` 设置为 `refs/pull/:prNumber/merge`。
- 如果 Pull Request 存在合并冲突（conflict），则 Action 不会触发。
- 虽然 `GITHUB_SHA` 是 merge commit 的 SHA，但通过 GitHub API 读取 workflow runs 时，其中的 `head_sha` 会指向 PR 的 head commit。
- 可以从 `github.event.pull_request.head.sha` 获取 PR 的 head commit SHA，或者从 `github.head_ref` 获取 PR 的 head ref。

## `pull_request_target` 事件
`pull_request_target` 是另一个处理 Pull Request 的事件，它的行为与 `pull_request` 事件有所不同：

- `GITHUB_SHA` 和 `GITHUB_REF` 分别指向基分支（base branch）而非合并提交（merge commit）或目标分支（target branch）。直接 `git checkout $GITHUB_SHA` 会得到基分支的代码。
- `GITHUB_TOKEN` 默认提供读写权限，即使 PR 来自 fork 仓库，故需要注意安全问题。
- 无论 PR 是否存在合并冲突，Action 都会触发。
- 可以从 `github.event.pull_request.head.sha` 获取 PR 的 head commit SHA，或者从 `github.head_ref` 获取 PR 的 head ref。

如果需要在 `pull_request_target` 事件中检出（checkout）PR 的代码，需要手动指定 ref：

```yaml
uses: actions/checkout@v4
with:
    ref: ${{ github.head_ref }}
    token: ${{ github.token }}
```

由于这可能 checkout 来自外部仓库的代码，故需要注意安全问题。

## 读取同一 PR 的其他 workflow runs 信息
由于 workflow runs 中的 `head_sha` 指向 PR 的 head commit，而非 merge commit，故需要使用 `github.event.pull_request.head.sha` 来筛选同一 PR 的 workflow runs。

参考的 Action 代码如下：
```typescript
import * as core from '@actions/core'
import * as github from '@actions/github'

let sha = github.context.sha

// Handle pull-request-related events
const pr_head_sha = github.context.payload.pull_request?.head?.sha
if (typeof pr_head_sha === 'string' && pr_head_sha.length > 0) {
    sha = pr_head_sha
}

for await (const runs of client.paginate.iterator(
    client.rest.actions.listWorkflowRuns,
    {
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        head_sha: sha
    }
)) {
    // Do something with filtered workflow runs
}
```

## 结语
自 v1.2.0 起，[(Action) wait-for-workflow](https://github.com/marketplace/actions/wait-for-workflow) 支持等待由同一 PR 触发的其他 workflow 完成，欢迎试用。

```yaml
# in ci:test.yml
name: Wait for build workflow to succeed
uses: ArcticLampyrid/action-wait-for-workflow@v1
with:
    workflow: ci:build.yml
    sha: auto
```
