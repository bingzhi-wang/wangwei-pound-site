import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

interface Options {
  /** "waline"：自建后端，匿名可评论；"cusdis"：托管服务，匿名可评论；"off"：关闭 */
  provider: "waline" | "cusdis" | "off"
  /** Waline 后端地址，例：https://xxx.vercel.app */
  serverURL?: string
  /** Cusdis 的 App ID */
  appId?: string
  /** Cusdis 服务地址，自建时改这里 */
  host?: string
  /** 客户端脚本 CDN 前缀 */
  cdn?: string
}

const defaultOptions = {
  provider: "off" as const,
  serverURL: "",
  appId: "",
  host: "https://cusdis.com",
  cdn: "https://unpkg.com",
}

const Comments: QuartzComponentConstructor<Options> = (userOpts: Options) => {
  const opts = { ...defaultOptions, ...userOpts }
  const configured =
    (opts.provider === "waline" && !!opts.serverURL) ||
    (opts.provider === "cusdis" && !!opts.appId)

  const Component: QuartzComponent = ({ fileData }: QuartzComponentProps) => {
    if (!configured) return null
    if (fileData.frontmatter?.comments === false) return null
    const title = (fileData.frontmatter?.title ?? "") as string
    return (
      <div class="comment-section">
        <h2 class="comment-heading">评论</h2>
        <div
          id="comment-root"
          data-provider={opts.provider}
          data-server={opts.serverURL}
          data-app-id={opts.appId}
          data-host={opts.host}
          data-cdn={opts.cdn}
          data-title={title}
        ></div>
      </div>
    )
  }

  if (configured) {
    Component.afterDOMLoaded = `
const CDN = "${opts.cdn}"
let lastPath = null

function isDark() {
  return document.documentElement.getAttribute("saved-theme") === "dark"
}

function loadCss(id, href) {
  if (document.getElementById(id)) return
  const link = document.createElement("link")
  link.id = id
  link.rel = "stylesheet"
  link.href = href
  document.head.appendChild(link)
}

function mountWaline(el) {
  loadCss("waline-style", CDN + "/@waline/client@v3/dist/waline.css")
  window.__walineModule =
    window.__walineModule || import(CDN + "/@waline/client@v3/dist/waline.js")
  window.__walineModule
    .then(({ init }) => {
      if (window.__waline && window.__waline.destroy) window.__waline.destroy()
      window.__waline = init({
        el,
        serverURL: el.dataset.server,
        lang: "zh-CN",
        path: window.location.pathname,
        dark: 'html[saved-theme="dark"]',
        comment: true,
        pageview: false,
        locale: {
          placeholder: "欢迎留言讨论。填昵称即可，邮箱选填（用于接收回复通知）。支持 Markdown。",
        },
      })
    })
    .catch((err) => console.error("[comments] Waline 加载失败", err))
}

function mountCusdis(el) {
  el.innerHTML = ""
  el.setAttribute("data-host", el.dataset.host)
  el.setAttribute("data-app-id", el.dataset.appId)
  el.setAttribute("data-page-id", window.location.pathname)
  el.setAttribute("data-page-url", window.location.href)
  el.setAttribute("data-page-title", el.dataset.title || document.title)
  el.setAttribute("data-theme", isDark() ? "dark" : "light")

  const render = () => {
    if (window.CUSDIS) window.CUSDIS.renderTo(el)
  }
  if (window.CUSDIS) {
    render()
  } else if (!window.__cusdisLoading) {
    window.__cusdisLoading = true
    const s = document.createElement("script")
    s.src = el.dataset.host + "/js/cusdis.es.js"
    s.async = true
    s.onload = render
    s.onerror = () => console.error("[comments] Cusdis 加载失败")
    document.head.appendChild(s)
  } else {
    setTimeout(render, 500)
  }
}

function mountComments() {
  const el = document.getElementById("comment-root")
  if (!el) return
  if (lastPath === window.location.pathname && el.childElementCount > 0) return
  lastPath = window.location.pathname
  if (el.dataset.provider === "waline") mountWaline(el)
  else if (el.dataset.provider === "cusdis") mountCusdis(el)
}

document.addEventListener("nav", mountComments)
mountComments()
`
    Component.css = `
.comment-section {
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--lightgray);
}
.comment-section .comment-heading {
  font-size: 1.1rem;
  margin: 0 0 1rem 0;
  color: var(--darkgray);
}
.comment-section .wl-panel {
  border-color: var(--lightgray);
}
#comment-root {
  --waline-theme-color: var(--secondary);
  --waline-active-color: var(--tertiary);
  --waline-bgcolor: transparent;
  --waline-border-color: var(--lightgray);
  --waline-color: var(--darkgray);
}
`
  }

  return Component
}

export default Comments
