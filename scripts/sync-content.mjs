#!/usr/bin/env node
/**
 * 把 Obsidian 知识库（wiki/ 与 index.md）同步到 Quartz 的 content/。
 *
 *   node scripts/sync-content.mjs           # 同步
 *   node scripts/sync-content.mjs --check   # 只比对，列出 content/ 里与知识库不一致的文件
 *                                           # （= 读者通过 PR 提交、尚未回填到知识库的改动）
 *
 * 处理内容：
 *   1. 给每页加 YAML frontmatter（title 取正文首个 H1，tags 取所在子目录）
 *   2. 把指向 raw/ 里本地 PDF 的链接降级为纯文本（网站上打不开，本地 Obsidian 不受影响）
 *   3. 页面之间的 [[双链]] 原样保留，由 Quartz 解析
 */
import fs from "node:fs"
import path from "node:path"
import os from "node:os"

const ROOT = path.resolve(import.meta.dirname, "..")
const VAULT = path.resolve(process.env.VAULT ?? path.join(ROOT, "..", "2026 王维 庞德"))
const CHECK = process.argv.includes("--check")

const FOLDER_TAGS = {
  concepts: "概念",
  entities: "人物",
  sources: "来源",
}

/**
 * 允许随站点发布的 raw/ 资源：知识库里的路径 -> 站点上的文件名。
 * 指向这些文件的链接不会被降级成纯文字，而是改写成指向站点副本，
 * `#page=N` 保留，浏览器里可以直接跳到该页。
 * 其余 raw/ 文件（扫描件、整本专著）一律不上传。
 */
const PUBLISHED_ASSETS = {
  "raw/1 王维/《王右丞集笺注》 王维 诗集！！重要可复制！.pdf": "王右丞集笺注.pdf",
}

if (!fs.existsSync(path.join(VAULT, "wiki"))) {
  console.error(`找不到知识库：${VAULT}\n用 VAULT=/path/to/vault node scripts/sync-content.mjs 指定路径。`)
  process.exit(1)
}

/** 把指向已发布资源的链接改写成站点上的相对路径（保留 #page=N） */
function rewriteAssetLinks(md, depth) {
  const prefix = "../".repeat(depth)
  for (const [vaultPath, siteName] of Object.entries(PUBLISHED_ASSETS)) {
    const esc = vaultPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const encoded = vaultPath.replace(/ /g, "%20").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const src = `(?:${esc}|${encoded})`
    const target = (frag) => prefix + siteName + frag
    md = md
      // [[路径#page=n|显示文字]]
      .replace(new RegExp(`\\[\\[\\s*${src}(#page=\\d+)?\\s*\\|([^\\]]*?)\\]\\]`, "g"),
        (_m, frag, label) => `[${label}](${target(frag || "")})`)
      // [[路径#page=n]]
      .replace(new RegExp(`\\[\\[\\s*${src}(#page=\\d+)?\\s*\\]\\]`, "g"),
        (_m, frag) => `[${siteName.replace(/\.pdf$/i, "")}](${target(frag || "")})`)
      // [显示文字](<路径#page=n>) 或 [显示文字](路径#page=n)
      .replace(new RegExp(`\\[([^\\]\n]*)\\]\\(\\s*<?\\s*${src}(#page=\\d+)?\\s*>?\\s*\\)`, "g"),
        (_m, label, frag) => `[${label}](${target(frag || "")})`)
  }
  return md
}

/** 把指向 raw/ 的 PDF 链接换成纯文本 */
function degradeRawLinks(md) {
  return (
    md
      // ![[raw/...]] 嵌入
      .replace(/!\[\[\s*raw\/[^\]]*?\]\]/g, "")
      // [[raw/...|显示文字]]
      .replace(/\[\[\s*raw\/[^\]|]*\|([^\]]*?)\]\]/g, "$1")
      // [[raw/...]]（无显示文字）→ 文件名
      .replace(/\[\[\s*raw\/([^\]|]*?)\]\]/g, (_m, p) =>
        decodeURIComponent(path.basename(p)).replace(/#page=\d+/g, "").replace(/\.pdf$/i, ""),
      )
      // [显示文字](raw/...) 或 [显示文字](<raw/...>)
      .replace(/\[([^\]\n]*)\]\(\s*<?\s*raw\/[^)\n]*?>?\s*\)/g, "$1")
  )
}

function buildFrontmatter(title, tags) {
  const lines = ["---", `title: "${title.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`]
  if (tags.length) {
    lines.push("tags:")
    for (const t of tags) lines.push(`  - ${t}`)
  }
  lines.push("---", "")
  return lines.join("\n")
}

function transform(raw, fallbackTitle, tags, depth = 0) {
  let md = rewriteAssetLinks(raw.replace(/\r\n/g, "\n"), depth)
  if (md.startsWith("---\n")) return degradeRawLinks(md) // 已有 frontmatter，原样处理

  const lines = md.split("\n")
  let title = fallbackTitle
  const idx = lines.findIndex((l) => l.trim() !== "")
  if (idx !== -1 && /^#\s+\S/.test(lines[idx])) {
    title = lines[idx].replace(/^#\s+/, "").trim()
    lines.splice(idx, 1)
    while (lines[idx] !== undefined && lines[idx].trim() === "") lines.splice(idx, 1)
  }
  return buildFrontmatter(title, tags) + degradeRawLinks(lines.join("\n")).replace(/^\n+/, "")
}

function collect() {
  /** @type {Map<string,string>} 相对 content/ 的路径 -> 文件内容 */
  const out = new Map()

  const indexPath = path.join(VAULT, "index.md")
  if (fs.existsSync(indexPath)) {
    let body = transform(fs.readFileSync(indexPath, "utf-8"), "索引", [], 0)
    const banner =
      "\n> [!info] 关于本站\n" +
      "> 这是课程知识库的网页版。课程藏书原件（PDF）因版权未公开，页面中的「文件 / 定位 / pg-xxx」等页码标注仅供对照原书之用，在网页上不可点击。\n" +
      "> 欢迎在任意页面底部留言，或用「编辑此页」提交修改。\n"
    body = body.replace(/^(---\n[\s\S]*?\n---\n)/, "$1" + banner)
    out.set("index.md", body)
  }

  const wikiRoot = path.join(VAULT, "wiki")
  const walk = (dir, rel) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue
      const abs = path.join(dir, entry.name)
      const relPath = rel ? path.join(rel, entry.name) : entry.name
      if (entry.isDirectory()) {
        walk(abs, relPath)
      } else if (entry.name.endsWith(".md")) {
        const top = relPath.split(path.sep)[0]
        const tags = FOLDER_TAGS[top] ? [FOLDER_TAGS[top]] : []
        const base = entry.name.replace(/\.md$/, "")
        out.set(relPath, transform(fs.readFileSync(abs, "utf-8"), base, tags, relPath.split(path.sep).length - 1))
      }
    }
  }
  walk(wikiRoot, "")
  return out
}

const generated = collect()
const contentDir = path.join(ROOT, "content")

if (CHECK) {
  const diffs = []
  const onDisk = new Set()
  const walkDisk = (dir, rel) => {
    if (!fs.existsSync(dir)) return
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith(".")) continue
      const r = rel ? path.join(rel, e.name) : e.name
      if (e.isDirectory()) walkDisk(path.join(dir, e.name), r)
      else if (e.name.endsWith(".md")) onDisk.add(r)
    }
  }
  walkDisk(contentDir, "")

  for (const [rel, body] of generated) {
    const p = path.join(contentDir, rel)
    if (!fs.existsSync(p)) diffs.push(`新增（知识库有、网站没有）：${rel}`)
    else if (fs.readFileSync(p, "utf-8") !== body) diffs.push(`内容不一致：${rel}`)
  }
  for (const rel of onDisk) if (!generated.has(rel)) diffs.push(`网站独有（可能是读者投稿）：${rel}`)

  if (diffs.length === 0) console.log("✓ content/ 与知识库一致")
  else {
    console.log(`共 ${diffs.length} 处差异：`)
    for (const d of diffs) console.log("  " + d)
    console.log("\n用 `git diff` 或 GitHub 上的 PR 差异查看具体改动，再手动回填到 Obsidian 知识库。")
  }
  process.exit(0)
}

fs.rmSync(contentDir, { recursive: true, force: true })
fs.mkdirSync(contentDir, { recursive: true })
for (const [rel, body] of generated) {
  const p = path.join(contentDir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, body, "utf-8")
}
let assetCount = 0
for (const [vaultPath, siteName] of Object.entries(PUBLISHED_ASSETS)) {
  const src = path.join(VAULT, vaultPath)
  if (!fs.existsSync(src)) {
    console.warn(`⚠ 找不到要发布的资源：${vaultPath}`)
    continue
  }
  fs.copyFileSync(src, path.join(contentDir, siteName))
  assetCount++
}
console.log(`✓ 已同步 ${generated.size} 个页面、${assetCount} 个资源文件到 content/`)
