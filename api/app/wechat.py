"""微信小程序登录：jscode2session 换取 openid。

服务端用 wx.login 拿到的 code 换取 openid，作为小程序用户的唯一身份标识。
"""
import httpx
from fastapi import HTTPException

from app.config import settings

JSCODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session"


def code2openid(code: str) -> str:
    """把前端传来的 code 换成 openid；失败时抛出明确的 HTTP 错误。"""
    if not settings.wechat_appid or not settings.wechat_secret:
        raise HTTPException(status_code=503, detail="微信登录未配置，请联系管理员")
    try:
        resp = httpx.get(
            JSCODE2SESSION_URL,
            params={
                "appid": settings.wechat_appid,
                "secret": settings.wechat_secret,
                "js_code": code,
                "grant_type": "authorization_code",
            },
            timeout=10,
        )
        resp.raise_for_status()
        data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise HTTPException(status_code=502, detail="微信登录服务暂不可用，请稍后再试") from exc

    errcode = data.get("errcode")
    if errcode == 40029:
        raise HTTPException(status_code=401, detail="登录凭证已失效，请重试")
    if errcode == 40226:
        raise HTTPException(status_code=403, detail="当前微信账号暂不可登录")
    if errcode == 45011:
        raise HTTPException(status_code=429, detail="微信登录请求过于频繁，请稍后再试")
    if errcode == -1:
        raise HTTPException(status_code=503, detail="微信登录服务繁忙，请稍后再试")
    if errcode:
        raise HTTPException(status_code=502, detail="微信登录服务返回异常")
    openid = data.get("openid")
    if not openid:
        raise HTTPException(status_code=502, detail="微信登录响应缺少 openid")
    return openid