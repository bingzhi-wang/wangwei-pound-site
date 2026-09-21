import { loadQuartzConfig, loadQuartzLayout } from "./quartz/plugins/loader/config-loader"
import { PageTypes } from "./quartz/plugins"
import ContributePanel from "./quartz/components/ContributePanel"
import Comments from "./quartz/components/Comments"

// ─────────────────────────────────────────────────────────────
//  站点自定义设置：一般只需要改这一段
// ─────────────────────────────────────────────────────────────

/** GitHub 仓库，形如 "用户名/仓库名"；scripts/setup.sh 会自动填写 */
const REPO = "bingzhi-wang/wangwei-pound-site"
const BRANCH = "main"

/**
 * 评论后端：
 *   "off"    关闭评论
 *   "waline" 自建 Waline（部署到 Vercel，数据在自己手里，读者填昵称即可留言）
 *   "cusdis" 用 cusdis.com 托管服务（免部署，读者可匿名留言）
 * 部署步骤见 部署说明.md 第 2 节
 */
const COMMENT_PROVIDER: "off" | "waline" | "cusdis" = "off"

/** Waline 后端地址，例："https://my-waline.vercel.app" */
const WALINE_SERVER_URL = ""

/** Cusdis 的 App ID */
const CUSDIS_APP_ID = ""

// ─────────────────────────────────────────────────────────────

const config = await loadQuartzConfig()

/** 每页正文下方追加的组件：评论框 + 读者投稿入口 */
const afterBody = [
  Comments({
    provider: COMMENT_PROVIDER,
    serverURL: WALINE_SERVER_URL,
    appId: CUSDIS_APP_ID,
  }),
  ContributePanel({ repo: REPO, branch: BRANCH }),
]

export const layout = await loadQuartzLayout({
  defaults: { afterBody },
  byPageType: { content: { afterBody } },
})

// loadQuartzConfig() 内部已经用「没有自定义组件」的 layout 注册好了页面分发器，
// 而 Quartz 并不读取上面导出的 layout，所以这里必须把分发器替换掉，afterBody 才会生效。
const dispatcher = PageTypes.PageTypeDispatcher({
  defaults: layout.defaults,
  byPageType: layout.byPageType,
})
const dispatcherIdx = config.plugins.emitters.findIndex((e) => e.name === "PageTypeDispatcher")
if (dispatcherIdx >= 0) config.plugins.emitters[dispatcherIdx] = dispatcher
else config.plugins.emitters.push(dispatcher)

export default config
