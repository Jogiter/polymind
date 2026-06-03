// ============================================================================
// 微信扫码登录插件（WeChat QR / 网站应用登录）
//
// 【为什么用 unionid 作为账号主键？】
// 微信开放平台下，同一个微信用户在「不同应用」（公众号 / 小程序 / 网站应用）里
// 拿到的 openid 是「各自独立、互不相同」的；但只要这些应用都绑定在同一个
// 微信开放平台账号下，该用户就会有一个「全局唯一且稳定」的 unionid。
// 因此：只要拿得到 unionid，就必须优先用 unionid 作为账号唯一标识（accountId），
// 这样用户无论从哪个应用登录，都会被识别为「同一个人」，避免重复建号。
// 仅当 unionid 缺失（极少数未绑定开放平台的场景）时，才退化为使用 openid。
//
// 【为什么不能直接复用 Better Auth 的 genericOAuth？】
// 微信不遵循标准 OAuth2：
//   - 授权地址用 `appid` 而非 `client_id`；
//   - scope 固定为 `snsapi_login`；
//   - 授权 URL 末尾必须拼接 `#wechat_redirect` 锚点，否则微信不展示二维码；
//   - token / userinfo 接口走的是 `sns/oauth2` 系列，返回字段也非标准。
// 所以这里用 createAuthEndpoint 手写两个端点，直接通过 Better Auth 上下文
// （ctx.context.adapter / internalAdapter）做 find-or-create，并写入会话 Cookie。
// ============================================================================

import { createAuthEndpoint } from "better-auth/api";
import type { BetterAuthPlugin } from "better-auth";

// 微信 token 接口返回结构
interface WechatTokenResponse {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  openid?: string;
  scope?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

// 微信 userinfo 接口返回结构
interface WechatUserInfo {
  openid?: string;
  nickname?: string;
  sex?: number;
  province?: string;
  city?: string;
  country?: string;
  headimgurl?: string;
  unionid?: string;
  errcode?: number;
  errmsg?: string;
}

const WECHAT_PROVIDER_ID = "wechat";

export const wechatPlugin = (config: {
  appId: string;
  appSecret: string;
}): BetterAuthPlugin => {
  return {
    id: "wechat",
    endpoints: {
      // ── 端点 1：发起微信扫码登录 ──────────────────────────────────────
      // GET /sign-in/wechat
      // 生成 state（防 CSRF），拼接微信二维码授权地址并 302 跳转。
      signInWechat: createAuthEndpoint(
        "/sign-in/wechat",
        {
          method: "GET",
        },
        async (ctx) => {
          const baseURL = ctx.context.baseURL;

          // 生成随机 state 并写入 verification 表，用于回调时做 CSRF 校验
          const state = generateRandomState();
          // NOTE: 不同 Better Auth 版本的 verification 写入 API 略有差异，
          // 这里直接用 adapter 落库；10 分钟有效。
          await ctx.context.adapter.create({
            model: "verification",
            data: {
              id: generateRandomState(),
              identifier: `wechat_state_${state}`,
              value: state,
              expiresAt: new Date(Date.now() + 10 * 60 * 1000),
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          });

          // 构造微信授权 URL
          const url = new URL(
            "https://open.weixin.qq.com/connect/qrconnect",
          );
          url.searchParams.set("appid", config.appId);
          url.searchParams.set(
            "redirect_uri",
            `${baseURL}/callback/wechat`,
          );
          url.searchParams.set("response_type", "code");
          url.searchParams.set("scope", "snsapi_login");
          url.searchParams.set("state", state);

          // 微信要求 URL 末尾必须带 #wechat_redirect 才会渲染二维码
          const redirectTo = `${url.toString()}#wechat_redirect`;

          throw ctx.redirect(redirectTo);
        },
      ),

      // ── 端点 2：微信授权回调 ──────────────────────────────────────────
      // GET /callback/wechat?code=...&state=...
      // 校验 state → 用 code 换 access_token → 拉取用户信息 → upsert 用户/账号 → 写会话。
      callbackWechat: createAuthEndpoint(
        "/callback/wechat",
        {
          method: "GET",
        },
        async (ctx) => {
          const query = (ctx.query ?? {}) as Record<string, string>;
          const code = query.code;
          const state = query.state;

          if (!code || !state) {
            throw ctx.error("BAD_REQUEST", {
              message: "缺少 code 或 state 参数",
            });
          }

          // 1) 校验 state（CSRF 防护）
          const stored = await ctx.context.adapter.findOne<{
            id: string;
            value: string;
          }>({
            model: "verification",
            where: [
              {
                field: "identifier",
                value: `wechat_state_${state}`,
              },
            ],
          });
          if (!stored || stored.value !== state) {
            throw ctx.error("UNAUTHORIZED", {
              message: "state 校验失败，可能是 CSRF 或已过期",
            });
          }
          // 用完即删，防止重放
          await ctx.context.adapter.delete({
            model: "verification",
            where: [{ field: "id", value: stored.id }],
          });

          // 2) 用 code 换取 access_token + openid (+ unionid)
          const tokenURL = new URL(
            "https://api.weixin.qq.com/sns/oauth2/access_token",
          );
          tokenURL.searchParams.set("appid", config.appId);
          tokenURL.searchParams.set("secret", config.appSecret);
          tokenURL.searchParams.set("code", code);
          tokenURL.searchParams.set(
            "grant_type",
            "authorization_code",
          );

          const tokenRes = await fetch(tokenURL.toString());
          const token = (await tokenRes.json()) as WechatTokenResponse;
          if (token.errcode || !token.access_token || !token.openid) {
            throw ctx.error("UNAUTHORIZED", {
              message: `微信换取 token 失败: ${token.errmsg ?? "unknown"}`,
            });
          }

          // 3) 拉取用户信息
          const infoURL = new URL(
            "https://api.weixin.qq.com/sns/userinfo",
          );
          infoURL.searchParams.set("access_token", token.access_token);
          infoURL.searchParams.set("openid", token.openid);
          const infoRes = await fetch(infoURL.toString());
          const info = (await infoRes.json()) as WechatUserInfo;
          if (info.errcode) {
            throw ctx.error("UNAUTHORIZED", {
              message: `微信拉取用户信息失败: ${info.errmsg ?? "unknown"}`,
            });
          }

          // 4) 计算稳定账号标识：优先 unionid，缺失才退化用 openid
          const unionid = token.unionid ?? info.unionid;
          const openid = token.openid;
          const accountId = unionid ?? openid;
          const nickname = info.nickname ?? "微信用户";
          const headimgurl = info.headimgurl ?? null;
          // 微信不提供邮箱，这里构造一个稳定的占位邮箱（user 表 email 为 notNull+unique）
          const email = `${accountId}@wechat.local`;

          // 5) find-or-create：先按 (providerId, accountId) 找 account
          const existingAccount = await ctx.context.adapter.findOne<{
            id: string;
            userId: string;
          }>({
            model: "account",
            where: [
              { field: "providerId", value: WECHAT_PROVIDER_ID },
              { field: "accountId", value: accountId },
            ],
          });

          let userId: string;

          if (existingAccount) {
            // 已存在：更新 token，并刷新用户资料
            userId = existingAccount.userId;
            await ctx.context.adapter.update({
              model: "account",
              where: [{ field: "id", value: existingAccount.id }],
              update: {
                accessToken: token.access_token,
                refreshToken: token.refresh_token ?? null,
                scope: token.scope ?? "snsapi_login",
                updatedAt: new Date(),
              },
            });
            await ctx.context.adapter.update({
              model: "user",
              where: [{ field: "id", value: userId }],
              update: {
                name: nickname,
                image: headimgurl,
                updatedAt: new Date(),
              },
            });
          } else {
            // 不存在：尝试按占位 email 复用已有 user（理论上一一对应），否则新建
            const existingUser = await ctx.context.adapter.findOne<{
              id: string;
            }>({
              model: "user",
              where: [{ field: "email", value: email }],
            });

            if (existingUser) {
              userId = existingUser.id;
            } else {
              const created = await ctx.context.adapter.create<
                Record<string, unknown>,
                { id: string }
              >({
                model: "user",
                data: {
                  id: generateRandomState(),
                  name: nickname,
                  email,
                  // 微信扫码视为已验证身份
                  emailVerified: true,
                  image: headimgurl,
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              });
              userId = created.id;
            }

            // 建立 account 关联记录
            await ctx.context.adapter.create({
              model: "account",
              data: {
                id: generateRandomState(),
                accountId,
                providerId: WECHAT_PROVIDER_ID,
                userId,
                accessToken: token.access_token,
                refreshToken: token.refresh_token ?? null,
                scope: token.scope ?? "snsapi_login",
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          // 6) 创建会话并写入 Cookie
          // NOTE: internalAdapter.createSession 的签名在不同版本间略有差异，
          // 这里采用 (userId, ctx) 形式；随后用 setSessionCookie 下发 Cookie。
          const internalAdapter = ctx.context.internalAdapter;
          // NOTE: createSession 的第二参在不同版本间或为 request/headers、
          // 或为 dontRememberMe 布尔值；用 any 调用以保持跨版本兼容。
          const sessionData = await (
            internalAdapter.createSession as unknown as (
              userId: string,
              ctx: unknown,
            ) => Promise<unknown>
          )(userId, ctx);

          // 写入会话 Cookie（如版本提供 setSessionCookie 工具则优先使用）
          if (
            typeof (ctx.context as unknown as {
              setSessionCookie?: unknown;
            }).setSessionCookie === "function"
          ) {
            await (
              ctx.context as unknown as {
                setSessionCookie: (
                  c: typeof ctx,
                  s: unknown,
                ) => Promise<void>;
              }
            ).setSessionCookie(ctx, {
              session: sessionData,
              user: { id: userId },
            });
          } else if (ctx.setSignedCookie && sessionData) {
            // 退化路径：直接以 token 写一个签名 Cookie
            const token =
              (sessionData as { token?: string }).token ?? "";
            await ctx.setSignedCookie(
              ctx.context.authCookies.sessionToken.name,
              token,
              ctx.context.secret,
              (ctx.context.authCookies.sessionToken as { options?: unknown })
                .options ?? {},
            );
          }

          // 7) 登录成功后跳回首页
          throw ctx.redirect(ctx.context.baseURL.replace(/\/api\/auth$/, "/"));
        },
      ),
    },
  } satisfies BetterAuthPlugin;
};

// 生成随机字符串（用于 state / 主键 id）。使用 Web Crypto，兼容 Edge / Node 18+。
function generateRandomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
