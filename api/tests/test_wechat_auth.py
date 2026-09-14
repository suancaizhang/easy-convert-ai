"""Run only against a migrated, disposable PostgreSQL database.

TEST_DATABASE_URL must name a database ending in _test or _audit.
The suite truncates application tables; never point it at user data.
"""
import os
import unittest
from unittest.mock import Mock, patch

os.environ.setdefault("JWT_SECRET", "isolated-regression-test-only")

TEST_URL = os.environ.get("TEST_DATABASE_URL")
if TEST_URL:
    from sqlalchemy.engine import make_url
    if not (make_url(TEST_URL).database or "").endswith(("_test", "_audit")):
        raise RuntimeError("Use a disposable database ending in _test or _audit")
    os.environ["DATABASE_URL"] = TEST_URL


class WechatGatewayTests(unittest.TestCase):
    def call_with(self, payload):
        from app.wechat import code2openid, settings

        response = Mock()
        response.raise_for_status.return_value = None
        response.json.return_value = payload
        with (
            patch.object(settings, "wechat_appid", "test-appid"),
            patch.object(settings, "wechat_secret", "test-secret"),
            patch("app.wechat.httpx.get", return_value=response),
        ):
            return code2openid("wx-code")

    def test_invalid_code_is_unauthorized(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as caught:
            self.call_with({"errcode": 40029, "errmsg": "invalid code"})
        self.assertEqual(caught.exception.status_code, 401)

    def test_rate_limit_is_too_many_requests(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as caught:
            self.call_with({"errcode": 45011, "errmsg": "rate limit"})
        self.assertEqual(caught.exception.status_code, 429)

    def test_wechat_system_error_is_service_unavailable(self):
        from fastapi import HTTPException

        with self.assertRaises(HTTPException) as caught:
            self.call_with({"errcode": -1, "errmsg": "system error"})
        self.assertEqual(caught.exception.status_code, 503)


@unittest.skipUnless(TEST_URL, "TEST_DATABASE_URL is required (disposable PostgreSQL)")
class WechatAuthTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        from fastapi.testclient import TestClient
        from app.main import app
        from app.database import SessionLocal
        cls.client = TestClient(app)
        cls.session_factory = staticmethod(SessionLocal)

    def setUp(self):
        from sqlalchemy import text
        with self.session_factory() as db:
            db.execute(text("TRUNCATE tasks, documents, users CASCADE"))

    def login(self, code="wx-code", avatar=None):
        body = {"code": code}
        if avatar is not None:
            body["avatar"] = avatar
        return self.client.post("/api/auth/wechat/login", json=body)

    def test_new_openid_creates_wechat_user_and_token_works(self):
        from app.models import User
        avatar = "https://example.test/a.png"
        with patch("app.routers.auth.code2openid", return_value="openid-alice"):
            resp = self.login(code="valid-code", avatar=avatar)
        self.assertEqual(resp.status_code, 200)
        token = resp.json()["access_token"]
        self.assertTrue(token)
        with self.session_factory() as db:
            user = db.query(User).filter(User.wechat_openid == "openid-alice").first()
            self.assertIsNotNone(user)
            self.assertIsNone(user.email)  # 微信用户无邮箱
            self.assertEqual(user.avatar, avatar)
        me = self.client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["id"], str(user.id))

    def test_existing_openid_reuses_same_account(self):
        from app.models import User
        from app.auth import decode_access_token
        with patch("app.routers.auth.code2openid", return_value="openid-repeat"):
            first = self.login(code="code-1")
            second = self.login(code="code-2")
        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        with self.session_factory() as db:
            count = db.query(User).filter(User.wechat_openid == "openid-repeat").count()
            self.assertEqual(count, 1)
        first_sub = decode_access_token(first.json()["access_token"])["sub"]
        second_sub = decode_access_token(second.json()["access_token"])["sub"]
        self.assertEqual(first_sub, second_sub)

    def test_invalid_code_is_rejected(self):
        from fastapi import HTTPException
        with patch(
            "app.routers.auth.code2openid",
            side_effect=HTTPException(status_code=401, detail="登录凭证已失效，请重试"),
        ):
            resp = self.login(code="expired-code")
        self.assertEqual(resp.status_code, 401)

    def test_unconfigured_wechat_returns_503(self):
        from fastapi import HTTPException
        with patch(
            "app.routers.auth.code2openid",
            side_effect=HTTPException(status_code=503, detail="微信登录未配置，请联系管理员"),
        ):
            resp = self.login()
        self.assertEqual(resp.status_code, 503)


if __name__ == "__main__":
    unittest.main()