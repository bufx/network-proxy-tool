/**
 * new Env("九号出行签到");
 * cron: 05 9 * * *
 */
const axios = require('axios')
const notify = require('./sendNotify')

class Ninebot {
    constructor(checkItem) {
        this.signUrl = "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v1/sign";
        this.validUrl = "https://cn-cbu-gateway.ninebot.com/portal/api/user-sign/v1/status";
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Authorization": checkItem.authorization,
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "zh-CN,zh-Hans;q=0.9",
            "Connection": "keep-alive",
            "Content-Type": "application/json",
            "Host": "cn-cbu-gateway.ninebot.com",
            "Origin": "https://api5-h5-app-bj.ninebot.com",
            "from_platform_1": "1",
            "language": "zh",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Segway v6 C 606093338",
            "Referer": "https://api5-h5-app-bj.ninebot.com/"
        };
        this.checkItem = checkItem;
    }

    async sign(session, msg) {
        try {
            const response = await session.post(this.signUrl, { deviceId: this.checkItem.deviceId }, { headers: this.headers });
            if (response.status === 200) {
                const responseData = response.data;
                if (responseData.code === 0) {
                    const checkinNum = responseData.data.consecutiveDays;
                    msg.push({ name: "签到成功", value: `已连续签到${checkinNum}天` });
                } else {
                    msg.push({ name: "签到失败", value: responseData.msg });
                }
            }
        } catch (e) {
            msg.push(
                { name: "签到信息", value: "签到失败" },
                { name: "错误信息", value: e.toString() }
            );
        }
    }

    async valid(session) {
        try {
            const content = await session.get(this.validUrl, { headers: this.headers });
            const jsonData = content.data;
            if (content.status === 200) {
                if (jsonData.code === 0) {
                    return { data: jsonData.data, error: "" };
                } else {
                    return { data: false, error: jsonData.msg };
                }
            }
            return { data: false, error: "登录信息异常" };
        } catch (e) {
            return { data: false, error: `登录验证异常,错误信息: ${e}` };
        }
    }

    async main() {
        const session = axios.create();
        const { data: validData, error: errInfo } = await this.valid(session);
        let msg = [];
        if (validData) {
            const completed = validData.currentSignStatus === 1;
            msg.push(
                { name: "连续签到天数", value: `${validData.consecutiveDays || ''}天` },
                { name: "今日签到状态", value: completed ? "已签到" : "未签到" }
            );
            if (!completed) {
                await this.sign(session, msg);
            }
        } else {
            msg.push({ name: "cookie信息", value: errInfo });
        }
        return msg.map(one => `${one.name}: ${one.value}`).join('\n');
    }
}

function parseAccounts(envStr) {
    return envStr.split('&').map(account => {
        const [deviceId, authorization] = account.split('#');
        return { deviceId, authorization };
    });
}

async function main() {
    const accountsEnv = process.env.NINEBOT_ENV; // 假设环境变量名为NINEBOT_ACCOUNTS
    let accounts = [];
    if (accountsEnv) {
        accounts = parseAccounts(accountsEnv);
    }
    let res = "";
    for (let index = 0; index < accounts.length; index++) {
        const account = accounts[index];
        const ninebot = new Ninebot(account);
        res += `账号${index + 1}：\n${await ninebot.main()}\n`;
    }
    console.log(res);
    await notify.sendNotify('九号出行', res);
}

main().catch(console.error);
