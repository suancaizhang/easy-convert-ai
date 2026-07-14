# Issue: OCR 引擎从 DeepSeek 迁移至小米 MiMo v2.5

- **状态**: ✅ 已实现
- **优先级**: P1
- **标签**: `enhancement`, `backend`, `ocr`
- **创建日期**: 2026-07-14

---

## 问题描述

原 OCR 双引擎方案使用 PaddleOCR + DeepSeek（fallback），但存在以下问题：

1. **PaddleOCR 环境依赖重**：需要安装 `paddlepaddle`（~400MB）和 `paddleocr`，在轻量部署环境下安装耗时过长
2. **DeepSeek 多模态能力有限**：DeepSeek chat 模型非专为 OCR 设计，识别排版混乱的中文文档准确率不高
3. **API Key 未配置**：DEEPSEEK_API_KEY 未在环境中设置，导致 fallback 时直接报错

## 变更内容

### 替换引擎

将 OCR 高精度备选引擎从 **DeepSeek** 替换为 **小米 MiMo v2.5 多模态模型**。

**变更文件**: `worker/worker/converters/ocr_to_word.py`

```python
# 变更前
DEEPSEEK_API_KEY → https://api.deepseek.com/v1/chat/completions
Authorization: Bearer <key>
model: deepseek-chat

# 变更后
MIMO_API_KEY → https://token-plan-cn.xiaomimimo.com/v1/chat/completions
api-key: <key>
model: mimo-v2.5
max_completion_tokens: 4096
```

### 双引擎策略（保持不变）

| ocr_mode | 首选引擎 | fallback |
|----------|---------|----------|
| `normal`（默认） | PaddleOCR | 小米 MiMo v2.5 |
| `high_accuracy` | 小米 MiMo v2.5 | PaddleOCR |

### 环境变量

| 旧变量 | 新变量 |
|--------|--------|
| `DEEPSEEK_API_KEY` | `MIMO_API_KEY` |

## API 信息

- **Base URL**: `https://token-plan-cn.xiaomimimo.com/v1`
- **认证方式**: `api-key` 请求头（非 Bearer Token）
- **模型**: `mimo-v2.5`
- **兼容性**: OpenAI 兼容接口格式

## 环境影响

- README 技术栈表格：更新 OCR 引擎描述
- README 环境变量表：`DEEPSEEK_API_KEY` → `MIMO_API_KEY`
- README 已知限制：更新 OCR 备选引擎说明
- Worker 启动命令需要额外 export `MIMO_API_KEY`

## 注意事项

- `MIMO_API_KEY` 通过环境变量注入，不要硬编码在代码中
- Worker 启动前需确保 `MIMO_API_KEY` 已设置，否则 high_accuracy 模式会报错
- API URL `token-plan-cn.xiaomimimo.com` 是用户订阅计划专属域名，可能与通用域名不同
- MiMo API 超时设置为 60 秒，大图片可能需要更长时间
