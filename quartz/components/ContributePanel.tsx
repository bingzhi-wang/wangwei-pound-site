import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface Options {
  /** GitHub 仓库，形如 "用户名/仓库名" */
  repo: string
  /** 分支名 */
  branch: string
}

const ContributePanel: QuartzComponentConstructor<Options> = (opts: Options) => {
  const Panel: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    const rel = (fileData.relativePath ?? "") as string
    if (!rel || !opts.repo || opts.repo.includes("__GH_USER__")) return null

    const encoded = rel
      .split("/")
      .map((s) => encodeURIComponent(s))
      .join("/")
    const editUrl = `https://github.com/${opts.repo}/edit/${opts.branch}/content/${encoded}`
    const title = (fileData.frontmatter?.title ?? rel) as string
    const issueUrl =
      `https://github.com/${opts.repo}/issues/new?title=` +
      encodeURIComponent(`[补充/勘误] ${title}`) +
      `&body=` +
      encodeURIComponent(
        `**页面**：${title}\n\n**要补充或订正的内容**：\n\n\n**出处**（书名、页码或链接）：\n`,
      )

    return (
      <div class="contribute-panel">
        <span class="contribute-hint">发现错漏，或想补充材料？</span>
        <span class="contribute-links">
          <a href={editUrl} target="_blank" rel="noopener noreferrer">
            ✎ 直接编辑此页
          </a>
          <a href={issueUrl} target="_blank" rel="noopener noreferrer">
            ✳ 提交补充 / 勘误
          </a>
        </span>
      </div>
    )
  }

  Panel.css = `
.contribute-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem 1rem;
  margin-top: 2.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--lightgray);
  font-size: 0.85rem;
  color: var(--gray);
}
.contribute-panel .contribute-links {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.contribute-panel a {
  color: var(--secondary);
  background: none;
  text-decoration: none;
  white-space: nowrap;
}
.contribute-panel a:hover {
  text-decoration: underline;
}
`
  return Panel
}

export default ContributePanel
