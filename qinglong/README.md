## 使用说明

### 九号出行APP自动签到

脚本文件：`ql_sign_nine_bot.js`

环境变量：`NINEBOT_ENV`

格式：`deviceId#authorization`，多个账号`&` 分隔。
例：`deviceId#authorization&deviceId#authorization`

获取方法：

-   先手动签到一次，抓包url为：`https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v2/sign`

-   `deviceId`: 请求头里面的`device_id`
-   `authorization`: 请求头里面的`authorization`

示例：`A6XXXXXX-438F-4382-9EDA-CA4DXXXX8208B#eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMTI3MjAyMTcyOTc1NTgzMjMyIiwiYXVkaWVuY2UiOiJtb2JpbGUiLCJ1c2VyX25hbWUiOiJudl83MjExMTYyODU5IiwiY2xpZW50X2lkIjoiYXBwX2NsaWVudF9pZF92ZWhpY2xlIiwicmVnX2RhdGUiOjE2ODg3ODc1NDAsImF1ZCI6WyJpb3Qtd2ViYXBwIl0sImFyZWFDb2RlIjoiODYiLCJwaG9uZSI6IjE5OTA1MTI1NjgxIiwic2NvcGUiOlsicmVhZCJdLCJleHAiOjE3NDE4NzQ5MDMsInJlZ2lvbiI6ImJqIiwianRpIjoidWtmYkZ4QThiaXBHaEpYRUwwXzFOU0xtSGVZIiwiZW1haWwiOiJidTY1NEBxcS5jb20ifQ.UhQQQFMd2q8ecumGluABznsWKY7cKjr3Atfkw17WODPszpg7WysqUWPE99BvYd_S-vLPgNMFP1emDrjEZxt2nf1jop0L_tjxPUPnJVhTVcXbFkM8cBCpZap9Lm9CSZLL4LeAP3ey0JCdspSWkRlx45aFIo8CdIqdtDjoIvGwmdk`

