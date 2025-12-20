/**
 * new Env("吉利银河-L7签到");
 * cron: 08 10,15 * * *
 */
/**
 * 吉利银河青龙脚本
 * 可实现查询信息、打开哨兵、签到、查询积分等功能
 * 支持MQTT服务，可接入HomeAssistant
 * 需要依赖：mqtt

 * 使用方法：
 * 1. 在青龙面板中添加环境变量：
 *    - 变量名：jlyh
 *    - 变量值:featureName&refreshToken&deviceId
 *     - featureName: 将执行对应功能
 *        如：
 *      - all 将执行所有功能
 *      - mqtt 将开启MQTT监听（这个要单独开）
 *      - info 将只执行信息获取功能
 *      - sign 将只执行签到功能
 *      - opensentry 将执行打开哨兵功能
 *      - sign opensentry 将执行签到和哨兵功能
 *     - refreshTokenhe和deviceId变量值："抓域名https://galaxy-user-api.geely.com/api/v1/login/refresh?refreshToken=后面的值"&请求头headers中deviceSN的值
 *    - 抓不到这个域名抓短信登录包 https://galaxy-user-api.geely.com/api/v1/login/mobileCodeLogin 返回体中的refreshToken的值，同样后面带着&请求头headers中deviceSN的值
 *    - 注意我说的是值 并不是全部 填错的自己看着点
 *    - 并且变量是两个值 两个值 两个值 一个refreshToke的值一个header请求头中的deviceSN的值。变量值格式是：refreshToke的值&deviceSN的值
 * 请注意：吉利银河app异地登录会顶下去，每次重新登录都要重新抓包。抓包教程自己找，安卓实测不需要根证书，用户证书也能抓，可能要配合PC端Reqable。

 * 2. 在青龙面板中添加定时任务：
 *    - 名称：jlyh
 *    - 命令：jlyh.js
 *    - 按需设置定时(不会设置问GPT)
 *    - 如果不带任何参数运行脚本，将按默认执行方式执行（通过下方变量配置）
 *    - 如果带参数运行脚本，将执行对应功能
 *    - 例如：
 *    - jlyh.js all 将执行所有功能
 *    - jlyh.js mqtt 将开启MQTT监听（这个要单独开）
 *    - jlyh.js info 将只执行信息获取功能
 *    - jlyh.js sign 将只执行签到功能
 *    - jlyh.js opensentry 将执行打开哨兵功能
 *    - jlyh.js sign opensentry 将执行签到和哨兵功能
 
 * 3. 通知控制
 *    以下两种方式均可控制通知：
 *    - 修改此处默认值：
 *    - Notify = 0  默认通知设置（仅在重要场景如哨兵开启、签到成功时通知）
 *    - Notify = 1  强制开启通知（所有场景都会通知）
 *    - Notify = 2  强制关闭通知（所有场景都不通知）
 *    - 使用命令行参数：
 *    - jlyh.js notify=1  强制开启通知
 *    - jlyh.js notify=2  强制关闭通知
 * 
 * 4. MQTT配置
 *    - 在下方配置位置输入MQTT地址端口以及状态更新间隔（建议60秒左右）
 *    - 在HomeAssistant中添加MQTT代理，并配置MQTT客户端
 *    - 如果设置了自动监听，开启脚本后将自动生成实体
 **/

// *********************************************************
// 各类变量的构造

let Notify = 1; 
let defaultRunAll = false;  // 默认执行模式：false 表示默认只执行信息获取，true 表示默认执行所有功能
let defaultEnableMqtt = false; // 默认MQTT模式：false 表示默认不启动MQTT监听，true 表示默认启动
let showInfoLogs = true; // 控制是否在执行功能时显示信息获取相关的日志，默认如果执行功能则不显示
let getVehicleInfo = false; //是否获取各种车辆信息-L7车有可能会报错，所以这边关掉
const ckName = "jlyh";
const $ = new Env("吉利银河");
let msg = "";

// MQTT配置
const mqttConfig = {
    host: 'mqtt://192.168.0.2', // MQTT服务器地址
    port: 1883,                 // MQTT服务器端口
    username: '',               // MQTT用户名
    password: '',               // MQTT密码
    clientId: `jlyh_${Math.random().toString(16).slice(3)}`, // 随机客户端ID
    updateInterval: 60         // MQTT状态更新间隔，单位：秒
};

class UserInfo {
        
    // 车主信息相关变量构造
    constructor(str) {
        this.ckStatus = true;
        this.token = '';
        this.featureName = [str.split('&')[0]];
        this.refreshToken = str.split('&')[1]; // 分隔符
        this.articleId = '';
        this.deviceSN = str.split('&')[2];
        this.switchStatus = {};  // 用于存储所有功能开关状态
        this.vehicleInfo = {};   // 用于存储车辆信息
        this.vehicleStatus = {}; // 用于存储车辆状态信息
        // 功能名称映射
        this.featureNames = {
            'sign': '签到',
            'opensentry': '打开哨兵',
            'closesentry': '关闭哨兵',
            'opendoor': '打开车锁',
            'closedoor': '关闭车锁',
            'search': '闪灯鸣笛',
            'windowslightopen': '微开车窗',
            'windowfullopen': '全开车窗',
            'windowclose': '关闭车窗',
            'sunroofopen': '打开天窗',
            'sunroofclose': '关闭天窗',
            'sunshadeopen': '打开遮阳帘',
            'sunshadeclose': '关闭遮阳帘',
            'purifieropen': '打开净化',
            'purifierclose': '关闭净化',
            'defrostopen': '打开除霜',
            'defrostclose': '关闭除霜',
            'aconopen': '打开空调',
            'aconclose': '关闭空调',
            'rapidheat': '极速升温',
            'rapidcool': '极速降温'
            // 如果要新增功能，在这里添加新功能的映射即可,不添加则会直接显示函数名
        };
        // 功能开关状态映射
        this.switchStatusNames = {
            'vstdModeStatus': { name: '哨兵模式' },
            // 'strangerModeActive': { name: '陌生人预警' },
            // 'campingModeActive': { name: '露营模式' },
            // 'jouIntVal': { name: '智能巡航' },
            // 'copActive': { name: '舒适泊车' },
            // 'parkingComfortStatus': { name: '泊车舒适性' },
            // 'ldacStatus': { name: '高清音频' },
            // 'driftModeActive': { name: '漂移模式' },
            // 'carLocatorStatUploadEn': { name: '车辆定位' },
            // 'prkgCameraActive': { name: '泊车影像' }
            // 注释无用功能，取消注释将显示在通知和日志里
        };
        // 车辆信息映射
        this.vehicleInfoNames = {
            'vin': { name: '车架号' },
            'seriesNameVs': { name: '车型' },
            'colorCode': { name: '车身颜色' },
            'engineNo': { name: '电机编号' }
        };
        // 车辆状态映射
        this.vehicleStatusNames = {
            basicVehicleStatus: {
                name: '基本状态',
                fields: {
                    distanceToEmptyOnBatteryOnly: { name: '续航里程', format: v => `${v}公里` },
                    odometer: { name: '总里程', format: v => `${Math.round(v)}公里` }
                }
            },
            vehicleLocationStatus: {
                name: '位置信息',
                fields: {
                    longitude: { name: '经度', format: v => (v / 10000000).toFixed(6) },
                    latitude: { name: '纬度', format: v => (v / 10000000).toFixed(6) },
                    altitude: { name: '海拔', format: v => `${v}米` }
                }
            },
            vehicleMaintainStatus: {
                name: '保养信息',
                fields: {
                    distanceToService: { name: '剩余保养里程', format: v => `${v}公里` },
                    daysToService: { name: '剩余保养天数', format: v => `${v}天` }
                }
            },
            vehicleRunningStatus: {
                name: '行驶状态',
                fields: {
                    speed: { name: '当前速度', format: v => `${v}km/h` },
                    avgSpeed: { name: '近期平均速度', format: v => `${v}km/h` },
                    averPowerConsumption: { name: '近期平均能耗', format: v => `${v}kWh/100km` },
                    tripMeter1: { name: '行程1', format: v => `${v}km` },
                    tripMeter2: { name: '行程2', format: v => `${v}km` }
                }
            },
            
            vehicleEnvironmentStatus: {
                name: '环境状态',
                fields: {
                    interiorTemp: { name: '车内温度', format: v => `${v}°C` },
                    exteriorTemp: { name: '车外温度', format: v => `${v}°C` },
                    interiorPM25Level: { name: '车内PM2.5', format: v => `${v}μg/m³` }
                }
            },
            vehicleBatteryStatus: {
                name: '电池状态',
                fields: {
                    chargeLevel: { name: '当前电量', format: v => `${v}%` },
                    timeToFullyCharged: { name: '充满时间', format: v => v === '2047' ? '未充电' : `${(v/60).toFixed(1)}小时` },
                    dcChargeIAct: { name: '充电电流', format: v => `${v}A` }
                }
            },
            vehicleDoorCoverStatus: {
                name: '车门状态',
                fields: {
                    doorLockStatusDriver: { name: '门锁', format: v => v === '2' ? '已锁定' : '已解锁' },
                    sunroofStatus: { name: '天窗状态', format: v => v === '1' ? '打开' : '关闭' },
                    sunshadeStatus: { name: '遮阳帘状态', format: v => v === '1' ? '打开' : '关闭' }
                }
            },
            vehicleClimateStatus: {
                name: '空调状态',
                fields: {
                    preClimateActive: { name: '空调', format: v => v ? '开启' : '关闭' },
                    defrostActive: { name: '除霜', format: v => v ? '开启' : '关闭' },
                    airBlowerActive: { name: '净化', format: v => v ? '开启' : '关闭' }
                }
            }
        };
        this.mqttClient = null; // 添加MQTT客户端实例变量
        
        // 添加状态检测映射
        this.statusChecks = {
            sentry: () => this.switchStatus.vstdModeStatus === '1',
            door: () => this.vehicleStatus.vehicleDoorCoverStatus?.doorLockStatusDriver === '1',  // 1表示解锁(ON)，2表示锁定(OFF)
            ac: () => this.vehicleStatus.vehicleClimateStatus?.preClimateActive === true,
            defrost: () => this.vehicleStatus.vehicleClimateStatus?.defrostActive === true,
            purifier: () => this.vehicleStatus.vehicleClimateStatus?.airBlowerActive === true,
            sunroof: () => this.vehicleStatus.vehicleDoorCoverStatus?.sunroofStatus === '1',  // 1表示打开(ON)，2表示关闭(OFF)
            sunshade: () => this.vehicleStatus.vehicleDoorCoverStatus?.sunshadeStatus === '1'  // 1表示打开(ON)，2表示关闭(OFF)
        };
    }

    // *********************************************************
    // 加密解密等后端功能相关

    // 获取UTC时间
    formatDate(date, hourOffset = 0, minuteOffset = 0) {
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const adjustedDate = new Date(date);
        adjustedDate.setUTCHours(adjustedDate.getUTCHours() + hourOffset);
        adjustedDate.setUTCMinutes(adjustedDate.getUTCMinutes() + minuteOffset);
        const dayOfWeek = daysOfWeek[adjustedDate.getUTCDay()];
        const day = ('0' + adjustedDate.getUTCDate()).slice(-2);
        const month = months[adjustedDate.getUTCMonth()];
        const year = adjustedDate.getUTCFullYear();
        const hours = ('0' + adjustedDate.getUTCHours()).slice(-2);
        const minutes = ('0' + adjustedDate.getUTCMinutes()).slice(-2);
        const seconds = ('0' + adjustedDate.getUTCSeconds()).slice(-2);
        return `${dayOfWeek} ${month} ${day} ${year} ${hours}:${minutes}:${seconds} GMT`;
    }

    // 请求头加密参数处理
    calculateHmacSha256(method, accept, content_md5, content_type, date, key, nonce, timestamp, path) {
        const crypto = require('crypto');
        // 构建待加密的字符串
        let e = `POST\n` +// method
            `application/json; charset=utf-8\n` +// accept
            `9qH9eCwn+tkcAKIMmnzdnQ==\n` +// content_md5
            `application/json; charset=utf-8\n` +// content_type
            `Thu, 13 Jul 2023 01:27:46 GMT\n` +// date
            `x-ca-key:204453306\n` +
            `x-ca-nonce:a2b33525-ca82-4e3a-b7ff-643f1775a999\n` +// nonce
            `x-ca-timestamp:1689211666058\n` +// timestamp
            `/app/v1/version/checkVersion`// path
        let ee = `${method}\n` +// method
            `${accept}\n` +// accept
            `${content_md5}\n` +// content_md5
            `${content_type}\n` +// content_type
            `${date}\n` +// date
            `x-ca-key:${key}\n` +
            `x-ca-nonce:${nonce}\n` +// nonce
            `x-ca-timestamp:${timestamp}\n` +// timestamp
            `${path}`// path  
        // console.log(ee);

        // app的Key对应的不同加密编码
        let sercetKey
        if (key == 204453306) {
            sercetKey = `uUwSi6m9m8Nx3Grx7dQghyxMpOXJKDGu`
        } else if (key == 204373120) {
            sercetKey = `XfH7OiOe07vorWwvGQdCqh6quYda9yGW`
        } else if (key == 204167276) {
            sercetKey = `5XfsfFBrUEF0fFiAUmAFFQ6lmhje3iMZ`
        } else if (key == 204168364) {
            sercetKey = `NqYVmMgH5HXol8RB8RkOpl8iLCBakdRo`
        } else if (key == 204179735) {
            sercetKey = `UhmsX3xStU4vrGHGYtqEXahtkYuQncMf`
        }
        // 生成 HMAC-SHA256 加密结果  
        const hmacSha256 = crypto.createHmac('sha256', sercetKey);
        hmacSha256.update(ee);
        const encryptedData = hmacSha256.digest();
        // 返回 Base64 编码的结果
        // console.log(`加密结果` + encryptedData.toString('base64'));
        return encryptedData.toString('base64');
    }

    // UUID生成
    generateUUID() {
        const alphanumeric = "0123456789abcdef";
        const sections = [8, 4, 4, 4, 12];
        let uuid = "";
        for (let i = 0; i < sections.length; i++) {
            for (let j = 0; j < sections[i]; j++) {
                uuid += alphanumeric[Math.floor(Math.random() * alphanumeric.length)];
            }
            if (i !== sections.length - 1) {
                uuid += "-";
            }
        }
        return uuid;
    }

    // Post请求构建
    getPostHeader(key, path, body) {
        const crypto = require('crypto');
        function calculateContentMD5(requestBody) {
            // 将请求体内容转换为字节数组
            const byteArray = Buffer.from(requestBody, 'utf8');
            // 计算字节数组的MD5摘要
            const md5Digest = crypto.createHash('md5').update(byteArray).digest();
            // 将MD5摘要转换为Base64编码的字符串
            const md5Base64 = md5Digest.toString('base64');
            // 返回Content-MD5值
            return md5Base64;
        }
        let currentDate = new Date();
        let formattedDate = this.formatDate(currentDate, 0); // 格林尼治时间  如果是8则是北京时间
        // console.log(formattedDate);
        let parts = formattedDate.split(" ");
        formattedDate = `${parts[0]}, ${parts[2]} ${parts[1]} ${parts[3]} ${parts[4]} GMT`;
        let date = new Date(formattedDate)
        let timestamp = date.getTime(); // 获取时间戳
        // console.log(timestamp);
        let content_md5 = calculateContentMD5(body);
        let uuid = this.generateUUID();
        let signature = this.calculateHmacSha256("POST", "application/json; charset=utf-8", content_md5, "application/json; charset=utf-8", formattedDate, key, uuid, timestamp, path)
        let headers = {
            'date': formattedDate,
            'x-ca-signature': signature,
            'x-ca-appcode': 'SWGeelyCode',
            'x-ca-nonce': uuid,
            'x-ca-key': key,
            'ca_version': 1,
            'accept': 'application/json; charset=utf-8',
            'usetoken': 1,
            'content-md5': content_md5,
            'x-ca-timestamp': timestamp,
            'x-ca-signature-headers': 'x-ca-nonce,x-ca-timestamp,x-ca-key',
            'x-refresh-token': true,
            'user-agent': 'ALIYUN-ANDROID-UA',
            'token': this.token,
            'deviceSN': this.deviceSN,
            'txCookie': '',
            'appId': 'galaxy-app',
            'appVersion': '1.27.0',
            'platform': 'Android',
            'Cache-Control': 'no-cache',
            'sweet_security_info': '{"appVersion":"1.27.0","platform":"android"}' ,
            'methodtype': '6',
            'contenttype': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
           'Content-Length': '87',
            'Connection': 'Keep-Alive',
            'Accept-Encoding': 'gzip',
 
            
        }
        if (key == 204179735) {
            // 安卓端
            headers["usetoken"] = true
            headers["host"] = `galaxy-user-api.geely.com`
            delete headers["x-refresh-token"]
            headers["taenantid"] = 569001701001
            headers["svcsid"] = ""
        } else {
            // h5端
            headers["usetoken"] = 1
            headers["host"] = `galaxy-app.geely.com`
            headers["x-refresh-token"] = true
        }
        return headers;

    }

    // Get请求构建
    getGetHeader(key, path) {
        let currentDate = new Date();
        let formattedDate = this.formatDate(currentDate, 0); // 格林尼治时间  如果是8则是北京时间
        // console.log(formattedDate);
        let parts = formattedDate.split(" ");
        formattedDate = `${parts[0]}, ${parts[2]} ${parts[1]} ${parts[3]} ${parts[4]} GMT`;
        let date = new Date(formattedDate)
        let timestamp = date.getTime(); // 获取时间戳
        // console.log(timestamp);
        let uuid = this.generateUUID();
        let signature = this.calculateHmacSha256("GET", "application/json; charset=utf-8", "", "application/x-www-form-urlencoded; charset=utf-8", formattedDate, key, uuid, timestamp, path)
        let headers = {
            'date': formattedDate,
            'x-ca-signature': signature,
            'x-ca-nonce': uuid,
            'x-ca-key': key,
            'ca_version': 1,
            'accept': 'application/json; charset=utf-8',
            'usetoken': 1,
            'x-ca-timestamp': timestamp,
            'x-ca-signature-headers': 'x-ca-nonce,x-ca-timestamp,x-ca-key',
            'x-refresh-token': true,
            'content-type': 'application/x-www-form-urlencoded; charset=utf-8',
            'user-agent': 'ALIYUN-ANDROID-UA',
            'token': this.token,// '',
            'deviceSN': this.deviceSN,
            'txCookie': '',
            'appId': 'galaxy-app',
            'appVersion': '1.27.0',
            'platform': 'Android',
            'Cache-Control': 'no-cache',
            'Connection': 'Keep-Alive',
            'Accept-Encoding': 'gzip',
            
        }
        if (key == 204179735) {
            // 安卓端
            headers["usetoken"] = true
            headers["host"] = `galaxy-user-api.geely.com`
            delete headers["x-refresh-token"]
            headers["taenantid"] = 569001701001
            headers["svcsid"] = ""
        } else {
            headers["usetoken"] = 1
            headers["host"] = `galaxy-app.geely.com`
            headers["x-refresh-token"] = true

        }
        return headers

    }

    /**
     * -------主函数-------
     */
    async main(features = []) {
        //从环境变量获取要执行的功能
        if(this.featureNames.hasOwnProperty(this.featureName)) {
          features = this.featureName;
        } else {
          $.DoubleLog(`❌请在环境变量指定需要执行的功能`);
            Notify = 1;
            return;
        }
        // $.DoubleLog(`⌛️ ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Shanghai', hour12: false }).replace(',', '').replace(/-/g, '/').replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$3-$2-$1')}`);
        // 设置是否显示信息获取日志
        showInfoLogs = this.shouldShowInfoLogs(features);
        // 检查是否需要启动MQTT
        const isMqttMode = features.length === 0 ? defaultEnableMqtt : features.length === 1 && features.includes('mqtt');
        // 如果参数包含info，则只执行信息获取
        if (features.includes('info')) {
            features = [];  // 清空功能列表，只执行信息获取
        }
        // 否则，按照defaultRunAll的设置处理
        else if (features.length === 0 && defaultRunAll) {
            features = ['all'];
        }
        // 显示运行功能说明
        this.logRunningFeatures(features);
        // 刷新token并获取基本信息
        await this.refresh_token();
        if (!this.ckStatus) {
            $.DoubleLog(`❌账号CK失效`);
            Notify = 1;
            return;
        }
        // 获取各种车辆信息
       if (getVehicleInfo) {
            await this.getVehicleInfo();
       }
        // 根据配置决定是否初始化MQTT连接
        if (isMqttMode) {
            await this.initMqtt();
            // 保持脚本运行
            return new Promise(() => {
                $.DoubleLog(`✅MQTT监听已启动，等待命令中...`);
            });
        }
        // 执行功能
        await this.executeFeatures(features);
    }

    // 记录运行的功能
    logRunningFeatures(features) {
        if (features.length === 0) {
            $.DoubleLog(`🔄 正在获取车辆信息`);
        } else if (features.includes('all')) {
            $.DoubleLog(`🔄 正在运行全部功能`);
        } else {
            const runningFeatures = features
                .map(f => this.featureNames[f.toLowerCase()] || f)
                .filter(name => name);
            if (runningFeatures.length > 0) {
                // $.DoubleLog(`🔄 正在运行${runningFeatures.join('、')}功能`);
            }
        }
    }

    // 获取车辆信息
    async getVehicleInfo() {
        // 只在显示信息日志时显示分割线
        if (showInfoLogs) {
            $.DoubleLog(`🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗`);
        }
        await this.mylist();        // 获取车辆信息
        await this.controlstatus(); // 获取车辆状态信息
        await this.switchstatus();  // 获取车辆功能开关信息
    }

    // 执行功能
    async executeFeatures(features) {
        if (features.length === 0) {
            return; // 如果是仅查询信息，直接返回
        }
        // $.DoubleLog(`🚗🚗🚗🚗🚗🚗🚗🚗🚗🚗`);
        if (features.includes('all')) {
            $.DoubleLog(`🔄 正在执行所有功能...`);
            await this.sign();
            await this.opensentry();
            // 只在MQTT启用时发送状态
            if (defaultEnableMqtt || features.includes('mqtt')) {
                await this.sendVehicleStatusMqtt();
            }
        } else {
            // $.DoubleLog(`🔄 正在执行功能...`);
            for (const feature of features) {
                const methodName = feature.toLowerCase();
                if (methodName && typeof this[methodName] === 'function') {
                    await this[methodName]();
                    // 只在MQTT启用且执行特定功能时发送状态
                    if ((defaultEnableMqtt || features.includes('mqtt')) && ['controlstatus', 'info'].includes(methodName)) {
                        await this.sendVehicleStatusMqtt();
                    }
                } else {
                    $.DoubleLog(`❌未知的功能参数: ${feature}`);
                    Notify = 1;
                }
            }
        }
    }

    // *********************************************************
    // 信息获取类函数

    // 刷新Key函数
    async refresh_token() {
        try {
            let options = {
                url: `https://galaxy-user-api.geely.com/api/v1/login/refresh?refreshToken=${this.refreshToken}`,
                headers: this.getGetHeader(204179735, `/api/v1/login/refresh?refreshToken=${this.refreshToken}`),
            },
                result = await httpRequest(options);
            // console.log(options);
            // console.log(result);
            if (result.code == 'success') {
                // console.log(`✅${result.message}: ${result.data.centerTokenDto.token} \n🆗刷新KEY:${result.data.centerTokenDto.refreshToken}`);
                this.ckStatus = true;
                this.token = result.data.centerTokenDto.token
            } else {
                $.DoubleLog(`❌ ${result.message}`);
                this.ckStatus = false;
                console.log(result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e)
        }
    }

    //获取车辆信息函数
    async mylist() {
        try {
            // 准备请求体
            const body = {};

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/myList`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/myList`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            let result = await httpRequest(options);

            if (result.code == 0) {
                if (showInfoLogs) $.DoubleLog(`✅获取车辆基本信息成功！`);
                if (result.data && result.data.length > 0) {
                    this.vehicleInfo = result.data[0];  // 保存车辆信息
                    
                    // 格式化显示车辆信息
                    if (showInfoLogs) {
                        $.DoubleLog(`🚗车辆基本信息：`);
                        for (const [key, value] of Object.entries(this.vehicleInfoNames)) {
                            if (this.vehicleInfo[key]) {
                                $.DoubleLog(`  ${value.name}: ${this.vehicleInfo[key]}`);
                            }
                        }
                    }
                } else {
                    $.DoubleLog(`❌获取车辆信息失败，未找到车辆数据！`);
                    Notify = 1;
                }
            } else {
                $.DoubleLog(`❌获取车辆基本信息失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 查询车辆状态函数
    async controlstatus() {
        try {
            // 准备请求体
            const body = {
                "clientType": 2,
                "statusType": "local",
                "dataTypeList": [
                    "all"
                ],
                "vin": this.vehicleInfo.vin
            };
            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/status`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/status`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            let result = await httpRequest(options);

            if (result.code == 0) {
                if (showInfoLogs) $.DoubleLog(`✅查询车辆状态成功！`);
                
                // 保存车辆状态信息
                this.vehicleStatus = result.data;
                
                // 格式化显示车辆状态信息
                if (showInfoLogs) {
                    for (const [category, config] of Object.entries(this.vehicleStatusNames)) {
                        if (this.vehicleStatus[category]) {
                            $.DoubleLog(`📱${config.name}：`);
                            for (const [field, fieldConfig] of Object.entries(config.fields)) {
                                const value = this.vehicleStatus[category][field];
                                if (value !== undefined && value !== '') {
                                    $.DoubleLog(`  ${fieldConfig.name}: ${fieldConfig.format(value)}`);
                                }
                            }
                        }
                    }
                }
            } else {
                $.DoubleLog(`❌查询车辆状态失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 查询车辆功能开关函数
    async switchstatus() {
        try {
            // 通用的状态配置
            const commonStatus = {
                status: {'0': '关闭', '1': '开启'},
                isEnabled: (value) => value === '1'
            };

            // 准备请求体
            const body = {
                "clientType": 2,
                "udid": null,
                "vin": this.vehicleInfo.vin
            };
            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/switch/status`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/switch/status`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 查询车辆功能开关
            let result = await httpRequest(options);

            if (result.code == 0) {
                if (showInfoLogs) $.DoubleLog(`✅查询车辆功能开关成功！`);
                
                // 保存所有功能开关状态
                this.switchStatus = result.data;
                
                // 格式化显示功能开关状态
                if (showInfoLogs) {
                    $.DoubleLog(`📱功能开关状态：`);
                    for (const [key, value] of Object.entries(result.data)) {
                        if (this.switchStatusNames[key]) {
                            const statusInfo = { ...this.switchStatusNames[key], ...commonStatus };
                            $.DoubleLog(`  ${statusInfo.name}: ${statusInfo.status[value] || value}`);
                        }
                    }
                }
            } else {
                $.DoubleLog(`❌查询车辆功能开关失败！`);
                console.log("⚠️失败原因:",result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    //查询积分函数
    async points() {
        try {
            let options = {
                url: `https://galaxy-app.geely.com/h5/v1/points/get`,
                headers: this.getGetHeader(204453306, `/h5/v1/points/get`),
            },
                result = await httpRequest(options);
            // console.log(options);
            // console.log(result);
            if (result.code == 0) {
                // $.DoubleLog(`✅剩余积分: ${result.data.availablePoints}`);
            } else {
                $.DoubleLog(`❌剩余积分查询: 失败`);
                console.log(result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }


    // 签到状态查询函数
    async signstate() {
        try {
            let options = {
                url: `https://galaxy-app.geely.com/app/v1/sign/state`,
                headers: this.getGetHeader(204453306, `/app/v1/sign/state`),
            };

            // 执行签到状态查询请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                if (result.data === true) {
                    // $.DoubleLog(`✅今日已经签到啦！`);
                    return true;
                } else {
                    return false;
                }
            } else {
                $.DoubleLog(`❌查询签到状态失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
                return false;
            }
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    // 连续签到天数查询
    async continueDays() {
        try {
            let options = {
                url: `https://galaxy-app.geely.com/app/v1/sign/getBaseData?isLoading=false`,
                headers: this.getGetHeader(204453306, `/app/v1/sign/getBaseData?isLoading=false`),
            };

            // 执行连续签到天数查询请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                // $.DoubleLog(`📅连续签到天数: ${result.data.continueDays}`);
            } else {
                $.DoubleLog(`❌查询连续签到天数失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
                return false;
            }
        } catch (e) {
            console.log(e);
            return false;
        }
    }

    // *********************************************************
    // 功能完成类函数

    //签到函数
    async sign() {
        try {
            // 先检查签到状态
            const hasSignedToday = await this.signstate();
            if (hasSignedToday) {
                // 即使已经签到，也查询一下积分
                await this.points();
                // 查询连续签到天数
                await this.continueDays();
                return;
            }

            // 准备请求体
            const body = {
                "signType": 0
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-app.geely.com/app/v1/sign/add`,
                headers: this.getPostHeader(204453306, `/app/v1/sign/add`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行签到请求
            let result = await httpRequest(options);
            
            // 检查返回结果
            if (result.code == 0) {
                // $.DoubleLog(`✅签到成功！`);
                // 签到成功后查询积分
                await this.points();
                // 查询连续签到天数
                await this.continueDays();
                Notify = 1;
            } else {
                $.DoubleLog(`❌签到失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }
    

    //打开哨兵模式函数
    async opensentry() {
        try {
            // 检查哨兵模式是否已开启
            if (this.switchStatus.vstdModeStatus === '1') {
                $.DoubleLog(`ℹ️哨兵模式开着呢！`);
                return;
            }
            
            // 从车辆状态中获取电量
            const batteryLevel = parseFloat(this.vehicleStatus.vehicleBatteryStatus?.chargeLevel || 0);
            if (batteryLevel <= 20) {
                $.DoubleLog(`ℹ️电量低，别开哨兵了！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "command": "1",
                "password": null,
                "tspUid": null,
                "type": 6,
                "udId": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/switch`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/switch`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行哨兵请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅打开哨兵模式成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌打开哨兵模式失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    //关闭哨兵模式函数
    async closesentry() {
        try {
            // 准备请求体
            const body = {
                "clientType": 2,
                "command": "2",
                "password": null,
                "tspUid": null,
                "type": 6,
                "udId": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/switch`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/switch`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行关闭哨兵请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅关闭哨兵模式成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌关闭哨兵模式失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    //车锁控制通用函数
    async controlDoor(action) {
        try {
            // 根据动作设置参数
            const params = {
                'opendoor': { type: 1, name: '打开' },
                'closedoor': { type: 2, name: '关闭' }
            }[action];

            if (!params) {
                $.DoubleLog(`❌无效的车锁控制命令！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "lockPassword": null,
                "password": null,
                "platform": "2.0",
                "position": 0,
                "target": null,
                "type": params.type,
                "udId": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/door`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/door`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行车锁控制请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅${params.name}车锁成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌${params.name}车锁失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    //打开车锁函数
    async opendoor() {await this.controlDoor('opendoor');}
    //关闭车锁函数
    async closedoor() {await this.controlDoor('closedoor');}

    //闪灯鸣笛函数
    async search() {
        try {
            // 准备请求体
            const body = {
                "clientType": 2,
                "password": null,
                "platform": "2.0",
                "udId": null,
                "value": "3",
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/search`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/search`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行闪灯鸣笛请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅闪灯鸣笛执行成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌闪灯鸣笛执行失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    //车窗控制通用函数
    async controlWindow(action) {
        try {
            // 根据动作设置参数
            const params = {
                'windowslightopen': { position: [4], type: 1, name: '微开车窗' },
                'windowfullopen': { position: [1], type: 1, name: '全开车窗' },
                'windowclose': { position: [1], type: 2, name: '关闭车窗' },
                'sunroofopen': { position: [2], type: 1, name: '打开天窗' },
                'sunroofclose': { position: [2], type: 2, name: '关闭天窗' },
                'sunshadeopen': { position: [3], type: 1, name: '打开遮阳帘' },
                'sunshadeclose': { position: [3], type: 2, name: '关闭遮阳帘' }
            }[action];

            if (!params) {
                $.DoubleLog(`❌无效的车窗控制命令！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "password": null,
                "percent": null,
                "platform": "2.0",
                "position": params.position,
                "type": params.type,
                "udId": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/window`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/window`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行车窗控制请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅${params.name}执行成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌${params.name}执行失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 微开车窗函数
    async windowslightopen() {await this.controlWindow('windowslightopen');}
    // 全开车窗函数
    async windowfullopen() {await this.controlWindow('windowfullopen');}
    // 关闭车窗函数
    async windowclose() {await this.controlWindow('windowclose');}
    // 打开天窗函数
    async sunroofopen() {await this.controlWindow('sunroofopen');}
    // 关闭天窗函数
    async sunroofclose() {await this.controlWindow('sunroofclose');}
    // 打开遮阳帘函数
    async sunshadeopen() {await this.controlWindow('sunshadeopen');}
    // 关闭遮阳帘函数
    async sunshadeclose() {await this.controlWindow('sunshadeclose');}

    //空气净化控制通用函数
    async controlPurifier(action) {
        try {
            // 根据动作设置参数
            const params = {
                'purifieropen': { type: 1, name: '打开' },
                'purifierclose': { type: 2, name: '关闭' }
            }[action];

            if (!params) {
                $.DoubleLog(`❌无效的净化控制命令！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "conditioner": null,
                "dayOfWeek": null,
                "duration": null,
                "endTimeOfDay": null,
                "heat": null,
                "level": null,
                "password": null,
                "platform": "2.0",
                "scheduledTime": null,
                "startTimeOfDay": null,
                "target": null,
                "temp": null,
                "timerId": null,
                "type": params.type,
                "udId": null,
                "ventilation": 99,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/noEngine`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/noEngine`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行净化控制请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅${params.name}净化成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌${params.name}净化失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 打开净化函数
    async purifieropen() {await this.controlPurifier('purifieropen');}
    // 关闭净化函数
    async purifierclose() {await this.controlPurifier('purifierclose');}

    //空调控制通用函数（包括除霜和空调）
    async controlClimate(action, temperature = 25) {
        try {
            // 根据动作设置参数
            const params = {
                'defrostopen': { type: 1, conditioner: 2, name: '打开除霜' },
                'defrostclose': { type: 2, conditioner: 2, name: '关闭除霜' },
                'aconopen': { type: 1, conditioner: 1, name: '打开空调' },
                'aconclose': { type: 2, conditioner: 1, name: '关闭空调' }
            }[action];

            if (!params) {
                $.DoubleLog(`❌无效的空调控制命令！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "conditioner": params.conditioner,
                "dayOfWeek": null,
                "duration": 90,
                "endTimeOfDay": null,
                "heat": null,
                "heatLevel": null,
                "password": null,
                "platform": "2.0",
                "scheduledTime": null,
                "startTimeOfDay": null,
                "temp": temperature.toString(),
                "timerId": null,
                "type": params.type,
                "udId": null,
                "ventilation": null,
                "ventilationLevel": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/climate`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/climate`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行空调控制请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅${params.name}成功！${action === 'aconopen' ? `温度设置为${temperature}°C` : ''}`);
                if (action === 'aconopen') {
                    this.acTemp = temperature;  // 保存设置的温度
                }
                Notify = 1;
            } else {
                $.DoubleLog(`❌${params.name}失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 打开空调函数
    async aconopen(temperature = null) {
        await this.controlClimate('aconopen', temperature || this.acTemp || 25);
    }

    // 关闭空调函数
    async aconclose() {
        await this.controlClimate('aconclose');
    }

    // 打开除霜函数
    async defrostopen() {
        await this.controlClimate('defrostopen');
    }

    // 关闭除霜函数
    async defrostclose() {
        await this.controlClimate('defrostclose');
    }

    //温度控制通用函数
    async controlTemperature(action) {
        try {
            // 根据动作设置参数
            const params = {
                'rapidheat': { 
                    type: 3,
                    temp: 28.5,
                    heat: [1, 2],
                    heatValue: 3,
                    ventilation: null,
                    ventilationValue: null,
                    name: '极速升温'
                },
                'rapidcool': { 
                    type: 3,
                    temp: 15.5,
                    heat: null,
                    heatValue: null,
                    ventilation: [1, 2],
                    ventilationValue: 3,
                    name: '极速降温'
                }
            }[action];

            if (!params) {
                $.DoubleLog(`❌无效的温度控制命令！`);
                return;
            }

            // 准备请求体
            const body = {
                "clientType": 2,
                "dayOfWeek": null,
                "duration": 90,
                "paa": 0,
                "paaAc": true,
                "paaAcTemp": params.temp,
                "paaHeat": params.heat,
                "paaHeatValue": params.heatValue,
                "paaSw": null,
                "paaVentilation": params.ventilation,
                "paaVentilationValue": params.ventilationValue,
                "paaVlt": params.ventilation !== null,
                "paaVltDuration": 60,
                "paaVltPos": null,
                "password": null,
                "platform": "2.0",
                "scheduledTime": Date.now(),
                "startTimeOfDay": null,
                "timerActivation": null,
                "timerId": null,
                "type": params.type,
                "udId": null,
                "vin": this.vehicleInfo.vin
            };

            // 使用getPostHeader生成请求头
            let options = {
                url: `https://galaxy-vc.geely.com/vc/app/v1/vehicle/control/temperature`,
                headers: this.getPostHeader(204373120, `/vc/app/v1/vehicle/control/temperature`, JSON.stringify(body)),
                body: JSON.stringify(body)
            };

            // 执行温度控制请求
            let result = await httpRequest(options);

            if (result.code == 0) {
                $.DoubleLog(`✅${params.name}成功！`);
                Notify = 1;
            } else {
                $.DoubleLog(`❌${params.name}失败！`);
                console.log("⚠️失败原因:", result);
                Notify = 1;
            }
        } catch (e) {
            console.log(e);
        }
    }

    // 极速升温函数
    async rapidheat() {
        await this.controlTemperature('rapidheat');
    }

    // 极速降温函数
    async rapidcool() {
        await this.controlTemperature('rapidcool');
    }

    // 判断是否显示信息获取日志的函数
    shouldShowInfoLogs(features) {
        return (features.length === 0 || features.includes('info')) && !features.includes('mqtt');
    }

    // MQTT消息发送函数
    async sendMqttMessage(topic, message) {
        try {
            if (!this.mqttClient) {
                await this.initMqtt();
            }

            return new Promise((resolve, reject) => {
                this.mqttClient.publish(topic, JSON.stringify(message), (err) => {
                    if (err) {
                        $.DoubleLog(`❌MQTT消息发送失败: ${err.message}`);
                        reject(err);
                    } else {
                        //$.DoubleLog(`✅MQTT消息发送成功: ${topic}`);
                        resolve();
                    }
                });
            });
        } catch (e) {
            $.DoubleLog(`❌MQTT错误: ${e.message}`);
            console.log(e);
        }
    }

    // 发送车辆状态到MQTT
    async sendVehicleStatusMqtt() {
        // 如果MQTT未启用，直接返回
        if (!defaultEnableMqtt && !process.argv.slice(2).includes('mqtt')) {
            return;
        }
        try {
            if (!this.vehicleStatus) {
                $.DoubleLog(`❌没有车辆状态数据可发送`);
                return;
            }

            // 准备传感器数据
            const sensorData = {
                temperature: this.vehicleStatus.vehicleEnvironmentStatus?.interiorTemp,
                exterior_temperature: this.vehicleStatus.vehicleEnvironmentStatus?.exteriorTemp,
                battery: this.vehicleStatus.vehicleBatteryStatus?.chargeLevel,
                pm25: this.vehicleStatus.vehicleEnvironmentStatus?.interiorPM25Level,
                mileage: Math.round(this.vehicleStatus.basicVehicleStatus?.odometer),
                range: this.vehicleStatus.basicVehicleStatus?.distanceToEmptyOnBatteryOnly,
                longitude: parseFloat((this.vehicleStatus.vehicleLocationStatus?.longitude / 10000000).toFixed(6)),
                latitude: parseFloat((this.vehicleStatus.vehicleLocationStatus?.latitude / 10000000).toFixed(6)),
                charging_time: this.vehicleStatus.vehicleBatteryStatus?.timeToFullyCharged === '2047' ? 0 : parseFloat((this.vehicleStatus.vehicleBatteryStatus?.timeToFullyCharged / 60).toFixed(1)),
                // 使用统一的状态检测方法
                sentry_mode: this.checkStatus('sentry'),
                door_state: this.checkStatus('door'),
                ac_state: this.checkStatus('ac'),
                defrost_state: this.checkStatus('defrost'),
                purifier_state: this.checkStatus('purifier'),
                sunroof_state: this.checkStatus('sunroof'),
                sunshade_state: this.checkStatus('sunshade'),
                ac_temp: this.acTemp || 25  // 添加空调温度状态
            };

            // 保存最后的传感器数据用于后续更新
            this.lastSensorData = sensorData;

            // 发送状态数据
            const stateTopic = `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`;
            await this.sendMqttMessage(stateTopic, sensorData);

            // 发送位置数据
            const locationData = {
                latitude: sensorData.latitude,
                longitude: sensorData.longitude,
                gps_accuracy: 0
            };
            const locationTopic = `homeassistant/device_tracker/geely_${this.vehicleInfo.vin}/state`;
            await this.sendMqttMessage(locationTopic, JSON.stringify(locationData));

            // 添加设备追踪器配置
            const deviceTrackerConfig = {
                name: "车辆位置",
                unique_id: `geely_${this.vehicleInfo.vin}_tracker`,
                state_topic: `homeassistant/device_tracker/geely_${this.vehicleInfo.vin}/state`,
                json_attributes_topic: `homeassistant/device_tracker/geely_${this.vehicleInfo.vin}/state`,
                payload_home: "home",
                payload_not_home: "not_home",
                source_type: "gps",
                icon: "mdi:car",
                device: {
                    identifiers: [`geely_${this.vehicleInfo.vin}`],
                    name: "吉利汽车",
                    model: this.vehicleInfo.seriesNameVs,
                    manufacturer: "Geely"
                }
            };

            // 发送设备追踪器配置
            const trackerConfigTopic = `homeassistant/device_tracker/geely_${this.vehicleInfo.vin}/config`;
            await this.sendMqttMessage(trackerConfigTopic, deviceTrackerConfig);

            // 添加传感器配置
            const sensorConfigs = {
                temperature: {
                    name: "车内温度",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.temperature }}",
                    unit_of_measurement: "°C",
                    unique_id: `geely_${this.vehicleInfo.vin}_temperature`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`],
                        name: "吉利汽车",
                        model: this.vehicleInfo.seriesNameVs,
                        manufacturer: "Geely"
                    }
                },
                exterior_temperature: {
                    name: "车外温度",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.exterior_temperature }}",
                    unit_of_measurement: "°C",
                    unique_id: `geely_${this.vehicleInfo.vin}_exterior_temperature`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                battery: {
                    name: "电池电量",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.battery }}",
                    unit_of_measurement: "%",
                    unique_id: `geely_${this.vehicleInfo.vin}_battery`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                pm25: {
                    name: "车内PM2.5",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.pm25 }}",
                    unit_of_measurement: "μg/m³",
                    unique_id: `geely_${this.vehicleInfo.vin}_pm25`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                mileage: {
                    name: "总里程",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.mileage }}",
                    unit_of_measurement: "km",
                    unique_id: `geely_${this.vehicleInfo.vin}_mileage`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                range: {
                    name: "续航里程",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.range }}",
                    unit_of_measurement: "km",
                    unique_id: `geely_${this.vehicleInfo.vin}_range`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                charging_time: {
                    name: "充满时间",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.charging_time }}",
                    unit_of_measurement: "h",
                    unique_id: `geely_${this.vehicleInfo.vin}_charging_time`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                location: {
                    name: "车辆位置",
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.latitude }},{{ value_json.longitude }}",
                    unique_id: `geely_${this.vehicleInfo.vin}_location`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                }
            };

            // 发送传感器配置
            for (const [sensorName, config] of Object.entries(sensorConfigs)) {
                const configTopic = `homeassistant/sensor/geely_${this.vehicleInfo.vin}/${sensorName}/config`;
                await this.sendMqttMessage(configTopic, config);
            }

            // 添加空调温度滑动条配置
            const climateConfigs = {
                ac_temp: {
                    name: "空调温度",
                    command_topic: `homeassistant/number/geely_${this.vehicleInfo.vin}/ac_temp/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.ac_temp }}",
                    min: 16,
                    max: 32,
                    step: 0.5,
                    unit_of_measurement: "°C",
                    unique_id: `geely_${this.vehicleInfo.vin}_ac_temp`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`],
                        name: "吉利汽车",
                        model: this.vehicleInfo.seriesNameVs,
                        manufacturer: "Geely"
                    }
                }
            };

            // 发送空调温度滑动条配置
            for (const [name, config] of Object.entries(climateConfigs)) {
                const configTopic = `homeassistant/number/geely_${this.vehicleInfo.vin}/${name}/config`;
                await this.sendMqttMessage(configTopic, config);
            }

            // 添加开关配置
            const switchConfigs = {
                sentry: {
                    name: "哨兵模式",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/sentry/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.sentry_mode }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_sentry`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`],
                        name: "吉利汽车",
                        model: this.vehicleInfo.seriesNameVs,
                        manufacturer: "Geely"
                    }
                },
                door: {
                    name: "车门锁",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/door/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.door_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_door`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                ac: {
                    name: "空调",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/ac/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.ac_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_ac`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                defrost: {
                    name: "除霜",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/defrost/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.defrost_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_defrost`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                purifier: {
                    name: "空气净化",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/purifier/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.purifier_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_purifier`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                sunroof: {
                    name: "天窗",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/sunroof/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.sunroof_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_sunroof`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                sunshade: {
                    name: "遮阳帘",
                    command_topic: `homeassistant/switch/geely_${this.vehicleInfo.vin}/sunshade/set`,
                    state_topic: `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`,
                    value_template: "{{ value_json.sunshade_state }}",
                    payload_on: "ON",
                    payload_off: "OFF",
                    state_on: "ON",
                    state_off: "OFF",
                    unique_id: `geely_${this.vehicleInfo.vin}_sunshade`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                }
            };

            // 发送开关配置
            for (const [switchName, config] of Object.entries(switchConfigs)) {
                const configTopic = `homeassistant/switch/geely_${this.vehicleInfo.vin}/${switchName}/config`;
                await this.sendMqttMessage(configTopic, config);
                
            }

            // 添加按钮配置
            const buttonConfigs = {
                rapidheat: {
                    name: "极速升温",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/rapidheat/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_rapidheat`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`],
                        name: "吉利汽车",
                        model: this.vehicleInfo.seriesNameVs,
                        manufacturer: "Geely"
                    }
                },
                rapidcool: {
                    name: "极速降温",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/rapidcool/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_rapidcool`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                search: {
                    name: "闪灯鸣笛",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/search/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_search`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                windowslightopen: {
                    name: "微开车窗",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/windowslightopen/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_windowslightopen`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                windowfullopen: {
                    name: "全开车窗",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/windowfullopen/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_windowfullopen`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                },
                windowclose: {
                    name: "关闭车窗",
                    command_topic: `homeassistant/button/geely_${this.vehicleInfo.vin}/windowclose/press`,
                    unique_id: `geely_${this.vehicleInfo.vin}_windowclose`,
                    device: {
                        identifiers: [`geely_${this.vehicleInfo.vin}`]
                    }
                }
            };

            // 发送按钮配置
            for (const [buttonName, config] of Object.entries(buttonConfigs)) {
                const configTopic = `homeassistant/button/geely_${this.vehicleInfo.vin}/${buttonName}/config`;
                await this.sendMqttMessage(configTopic, config);
            }

            $.DoubleLog(`✅车辆状态已发送到MQTT`);
        } catch (e) {
            $.DoubleLog(`❌发送车辆状态到MQTT失败: ${e.message}`);
            console.log(e);
        }
    }

    // 初始化MQTT连接
    async initMqtt() {
        try {
            if (this.mqttClient) {
                return; // 如果已经有连接，直接返回
            }

            const mqtt = require('mqtt');
            
            // 添加基础的重连配置
            const connectConfig = {
                port: mqttConfig.port,
                username: mqttConfig.username,
                password: mqttConfig.password,
                clientId: mqttConfig.clientId,
                reconnectPeriod: 5000    // 重连间隔5秒
            };

            this.mqttClient = mqtt.connect(mqttConfig.host, connectConfig);

            // 连接成功事件
            this.mqttClient.on('connect', async () => {
                $.DoubleLog(`✅MQTT连接成功`);
                
                // 订阅主题
                const topics = [
                    `homeassistant/switch/geely_${this.vehicleInfo.vin}/+/set`,
                    `homeassistant/button/geely_${this.vehicleInfo.vin}/+/press`,
                    `homeassistant/number/geely_${this.vehicleInfo.vin}/ac_temp/set`
                ];
                
                topics.forEach(topic => {
                    this.mqttClient.subscribe(topic, (err) => {
                        if (err) {
                            $.DoubleLog(`❌MQTT订阅失败: ${err.message}`);
                        } else {
                            $.DoubleLog(`✅MQTT订阅成功: ${topic}`);
                        }
                    });
                });

                // 立即执行一次状态更新
                await this.updateAndSendStatus();
                // 启动定时更新
                this.startStatusUpdateInterval();
            });

            // 重连事件
            this.mqttClient.on('reconnect', () => {
                $.DoubleLog(`🔄MQTT正在重连...`);
            });

            // 错误处理
            this.mqttClient.on('error', (err) => {
                $.DoubleLog(`❌MQTT连接错误: ${err.message}`);
            });

            // 断开连接处理
            this.mqttClient.on('close', () => {
                $.DoubleLog(`MQTT连接关闭`);
                
                // 清理定时器
                if (this.statusUpdateInterval) {
                    clearInterval(this.statusUpdateInterval);
                    this.statusUpdateInterval = null;
                }
            });

            // 消息处理（保持原有逻辑）
            this.mqttClient.on('message', async (topic, message) => {
                try {
                    const topicParts = topic.split('/');
                    const deviceType = topicParts[1];  // 'switch' 或 'button' 或 'number'
                    const command = topicParts[3];     // 命令类型
                    const action = topicParts[4];      // 'set' 或 'press'
                    const state = message.toString();

                    // 处理温度设置
                    if (deviceType === 'number' && command === 'ac_temp' && action === 'set') {
                        const temp = parseFloat(state);
                        if (!isNaN(temp) && temp >= 16 && temp <= 32) {
                            this.acTemp = temp;  // 保存设置的温度
                            $.DoubleLog(`✅空调温度设置为: ${temp}°C`);
                            
                            // 如果空调已开启，则使用新温度重新设置
                            if (this.vehicleStatus.vehicleClimateStatus?.preClimateActive) {
                                await this.aconopen(temp);
                            }
                            
                            // 更新状态
                            const sensorTopic = `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`;
                            await this.sendMqttMessage(sensorTopic, {
                                ...this.lastSensorData,
                                ac_temp: temp
                            });
                        }
                        return;
                    }

                    // 处理按钮按下事件
                    if (deviceType === 'button' && action === 'press') {
                        let success = false;
                        switch(command) {
                            case 'rapidheat':
                                await this.rapidheat();
                                success = true;
                                break;
                            case 'rapidcool':
                                await this.rapidcool();
                                success = true;
                                break;
                            case 'search':
                                await this.search();
                                success = true;
                                break;
                            case 'windowslightopen':
                                await this.windowslightopen();
                                success = true;
                                break;
                            case 'windowfullopen':
                                await this.windowfullopen();
                                success = true;
                                break;
                            case 'windowclose':
                                await this.windowclose();
                                success = true;
                                break;
                        }
                        
                        if (success) {
                            $.DoubleLog(`✅按钮命令执行成功: ${command}`);
                            // 重新启动状态更新定时器
                            await this.startStatusUpdateInterval();
                            
                            // 等待车辆状态更新
                            await new Promise(resolve => setTimeout(resolve, 2000));
                            // 更新并发送状态
                            await this.updateAndSendStatus();
                        }
                        return;
                    }

                    // 原有的开关处理逻辑保持不变
                    if (deviceType === 'switch' && action === 'set') {
                        // ... 现有的开关处理代码 ...
                    }

                    // 刷新token
                    await this.refresh_token();
                    if (!this.ckStatus) {
                        $.DoubleLog(`❌账号CK失效，无法执行命令`);
                        return;
                    }

                    // 执行命令
                    let success = false;
                    if (state === 'ON') {
                        switch(command) {
                            case 'sentry':
                                await this.opensentry();
                                success = true;
                                break;
                            case 'door':
                                await this.opendoor();
                                success = true;
                                break;
                            case 'ac':
                                await this.aconopen();
                                success = true;
                                break;
                            case 'defrost':
                                await this.defrostopen();
                                success = true;
                                break;
                            case 'purifier':
                                await this.purifieropen();
                                success = true;
                                break;
                            case 'sunroof':
                                await this.sunroofopen();
                                success = true;
                                break;
                            case 'sunshade':
                                await this.sunshadeopen();
                                success = true;
                                break;
                        }
                    } else if (state === 'OFF') {
                        switch(command) {
                            case 'sentry':
                                await this.closesentry();
                                success = true;
                                break;
                            case 'door':
                                await this.closedoor();
                                success = true;
                                break;
                            case 'ac':
                                await this.aconclose();
                                success = true;
                                break;
                            case 'defrost':
                                await this.defrostclose();
                                success = true;
                                break;
                            case 'purifier':
                                await this.purifierclose();
                                success = true;
                                break;
                            case 'sunroof':
                                await this.sunroofclose();
                                success = true;
                                break;
                            case 'sunshade':
                                await this.sunshadeclose();
                                success = true;
                                break;
                        }
                    }
                    
                    if (success) {
                        $.DoubleLog(`✅命令执行成功: ${command} ${state}`);
                        // 重新启动状态更新定时器
                        await this.startStatusUpdateInterval();

                        // 更新传感器状态
                        const sensorTopic = `homeassistant/sensor/geely_${this.vehicleInfo.vin}/state`;
                        const currentStatus = {
                            // 使用统一的状态检测方法，但当前命令使用临时状态
                            sentry_mode: command === 'sentry' ? state : this.checkStatus('sentry'),
                            door_state: command === 'door' ? state : this.checkStatus('door'),
                            ac_state: command === 'ac' ? state : this.checkStatus('ac'),
                            defrost_state: command === 'defrost' ? state : this.checkStatus('defrost'),
                            purifier_state: command === 'purifier' ? state : this.checkStatus('purifier'),
                            sunroof_state: command === 'sunroof' ? state : this.checkStatus('sunroof'),
                            sunshade_state: command === 'sunshade' ? state : this.checkStatus('sunshade')
                        };
                        await this.sendMqttMessage(sensorTopic, currentStatus);
                        
                        // 等待车辆状态更新
                        await new Promise(resolve => setTimeout(resolve, 5000));
                        // 更新并发送状态
                        await this.updateAndSendStatus();
                    } else {
                        $.DoubleLog(`❌未知命令或状态: ${command} ${state}`);
                    }
                } catch (e) {
                    $.DoubleLog(`❌处理命令失败: ${e.message}`);
                    console.log(e);
                }
            });

        } catch (e) {
            $.DoubleLog(`❌MQTT初始化失败: ${e.message}`);
            console.log(e);
        }
    }

    // 启动状态更新定时器
    async startStatusUpdateInterval() {
        // 如果已经有定时器在运行，先清除
        if (this.statusUpdateInterval) {
            clearInterval(this.statusUpdateInterval);
        }

        // 立即执行一次状态更新
        await this.updateAndSendStatus();

        // 设置定时器，按照配置的间隔时间更新状态
        this.statusUpdateInterval = setInterval(async () => {
            await this.updateAndSendStatus();
        }, mqttConfig.updateInterval * 1000); // 将秒转换为毫秒
        
        $.DoubleLog(`✅信息更新定时器已启动，每${mqttConfig.updateInterval}秒更新一次`);
    }

    // 更新并发送状态的函数
    async updateAndSendStatus() {
        try {
            // 刷新token
            await this.refresh_token();
            if (!this.ckStatus) {
                $.DoubleLog(`❌账号CK失效，无法更新状态`);
                return;
            }

            // 获取车辆各种信息
            await this.getVehicleInfo();
            // 发送状态到MQTT
            await this.sendVehicleStatusMqtt();
            $.DoubleLog(`✅获取车辆信息成功`);
        } catch (e) {
            $.DoubleLog(`❌获取车辆信息失败: ${e.message}`);
            console.log(e);
        }
    }

    // 添加统一的状态检测方法
    checkStatus(type) {
        const check = this.statusChecks[type];
        if (!check) {
            $.DoubleLog(`❌未知的状态检测类型: ${type}`);
            return false;
        }
        return check() ? 'ON' : 'OFF';
    }

}



// *********************************************************
// 变量检查与处理
!(async () => {
    const userCookie = ($.isNode() ? process.env[ckName] : $.getdata(ckName)) || "";
    if (!userCookie) {
        console.log("未找到CK");
        return;
    }
    // 获取命令行参数
    const args = process.argv.slice(2);
    const user = new UserInfo(userCookie);
    await user.main(args);  // 直接传入参数数组，可能为空
    await $.SendMsg(msg);
})().catch((e) => console.log(e)).finally(() => $.done());

// ********************************************************
function httpRequest(options, method = null) {
    method = options.method ? options.method.toLowerCase() : options.body ? "post" : "get";
    return new Promise((resolve) => {
        $[method](options, (err, resp, data) => {
            if (err) {
                console.log(`${method}请求失败`);
                $.logErr(err);
            } else {
                if (data) {
                    try { data = JSON.parse(data); } catch (error) { }
                    resolve(data);
                } else {
                    console.log(`请求api返回数据为空，请检查自身原因`);
                }
            }
            resolve();
        });
    });
}
// ==================== API ==================== // 
function Env(t, e) { class s { constructor(t) { this.env = t } send(t, e = "GET") { t = "string" == typeof t ? { url: t } : t; let s = this.get; return ("POST" === e && (s = this.post), new Promise((e, a) => { s.call(this, t, (t, s, r) => { t ? a(t) : e(s) }) })) } get(t) { return this.send.call(this.env, t) } post(t) { return this.send.call(this.env, t, "POST") } } return new (class { constructor(t, e) { this.userList = []; this.userIdx = 0; (this.name = t), (this.http = new s(this)), (this.data = null), (this.dataFile = "box.dat"), (this.logs = []), (this.isMute = !1), (this.isNeedRewrite = !1), (this.logSeparator = "\n"), (this.encoding = "utf-8"), (this.startTime = new Date().getTime()), Object.assign(this, e), this.log("", `🔔${this.name},开始!`) } getEnv() { return "undefined" != typeof $environment && $environment["surge-version"] ? "Surge" : "undefined" != typeof $environment && $environment["stash-version"] ? "Stash" : "undefined" != typeof module && module.exports ? "Node.js" : "undefined" != typeof $task ? "Quantumult X" : "undefined" != typeof $loon ? "Loon" : "undefined" != typeof $rocket ? "Shadowrocket" : void 0 } isNode() { return "Node.js" === this.getEnv() } isQuanX() { return "Quantumult X" === this.getEnv() } isSurge() { return "Surge" === this.getEnv() } isLoon() { return "Loon" === this.getEnv() } isShadowrocket() { return "Shadowrocket" === this.getEnv() } isStash() { return "Stash" === this.getEnv() } toObj(t, e = null) { try { return JSON.parse(t) } catch { return e } } toStr(t, e = null) { try { return JSON.stringify(t) } catch { return e } } getjson(t, e) { let s = e; const a = this.getdata(t); if (a) try { s = JSON.parse(this.getdata(t)) } catch { } return s } setjson(t, e) { try { return this.setdata(JSON.stringify(t), e) } catch { return !1 } } getScript(t) { return new Promise((e) => { this.get({ url: t }, (t, s, a) => e(a)) }) } runScript(t, e) { return new Promise((s) => { let a = this.getdata("@chavy_boxjs_userCfgs.httpapi"); a = a ? a.replace(/\n/g, "").trim() : a; let r = this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout"); (r = r ? 1 * r : 20), (r = e && e.timeout ? e.timeout : r); const [i, o] = a.split("@"), n = { url: `http:// ${o}/v1/scripting/evaluate`, body: { script_text: t, mock_type: "cron", timeout: r }, headers: { "X-Key": i, Accept: "*/*" }, timeout: r, }; this.post(n, (t, e, a) => s(a)) }).catch((t) => this.logErr(t)) } loaddata() { if (!this.isNode()) return {}; { (this.fs = this.fs ? this.fs : require("fs")), (this.path = this.path ? this.path : require("path")); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e); if (!s && !a) return {}; { const a = s ? t : e; try { return JSON.parse(this.fs.readFileSync(a)) } catch (t) { return {} } } } } writedata() { if (this.isNode()) { (this.fs = this.fs ? this.fs : require("fs")), (this.path = this.path ? this.path : require("path")); const t = this.path.resolve(this.dataFile), e = this.path.resolve(process.cwd(), this.dataFile), s = this.fs.existsSync(t), a = !s && this.fs.existsSync(e), r = JSON.stringify(this.data); s ? this.fs.writeFileSync(t, r) : a ? this.fs.writeFileSync(e, r) : this.fs.writeFileSync(t, r) } } lodash_get(t, e, s) { const a = e.replace(/\[(\d+)\]/g, ".$1").split("."); let r = t; for (const t of a) if (((r = Object(r)[t]), void 0 === r)) return s; return r } lodash_set(t, e, s) { return Object(t) !== t ? t : (Array.isArray(e) || (e = e.toString().match(/[^.[\]]+/g) || []), (e.slice(0, -1).reduce((t, s, a) => Object(t[s]) === t[s] ? t[s] : (t[s] = Math.abs(e[a + 1]) >> 0 == +e[a + 1] ? [] : {}), t)[e[e.length - 1]] = s), t) } getdata(t) { let e = this.getval(t); if (/^@/.test(t)) { const [, s, a] = /^@(.*?)\.(.*?)$/.exec(t), r = s ? this.getval(s) : ""; if (r) try { const t = JSON.parse(r); e = t ? this.lodash_get(t, a, "") : e } catch (t) { e = "" } } return e } setdata(t, e) { let s = !1; if (/^@/.test(e)) { const [, a, r] = /^@(.*?)\.(.*?)$/.exec(e), i = this.getval(a), o = a ? ("null" === i ? null : i || "{}") : "{}"; try { const e = JSON.parse(o); this.lodash_set(e, r, t), (s = this.setval(JSON.stringify(e), a)) } catch (e) { const i = {}; this.lodash_set(i, r, t), (s = this.setval(JSON.stringify(i), a)) } } else s = this.setval(t, e); return s } getval(t) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.read(t); case "Quantumult X": return $prefs.valueForKey(t); case "Node.js": return (this.data = this.loaddata()), this.data[t]; default: return (this.data && this.data[t]) || null } } setval(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": return $persistentStore.write(t, e); case "Quantumult X": return $prefs.setValueForKey(t, e); case "Node.js": return ((this.data = this.loaddata()), (this.data[e] = t), this.writedata(), !0); default: return (this.data && this.data[e]) || null } } initGotEnv(t) { (this.got = this.got ? this.got : require("got")), (this.cktough = this.cktough ? this.cktough : require("tough-cookie")), (this.ckjar = this.ckjar ? this.ckjar : new this.cktough.CookieJar()), t && ((t.headers = t.headers ? t.headers : {}), void 0 === t.headers.Cookie && void 0 === t.cookieJar && (t.cookieJar = this.ckjar)) } get(t, e = () => { }) { switch ((t.headers && (delete t.headers[""]), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && ((t.headers = t.headers || {}), Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient.get(t, (t, s, a) => { !t && s && ((s.body = a), (s.statusCode = s.status ? s.status : s.statusCode), (s.status = s.statusCode)), e(t, s, a) }); break; case "Quantumult X": this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t) => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o, } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o, }, i, o) }, (t) => e((t && t.error) || "UndefinedError")); break; case "Node.js": let s = require("iconv-lite"); this.initGotEnv(t), this.got(t).on("redirect", (t, e) => { try { if (t.headers["set-cookie"]) { const s = t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString(); s && this.ckjar.setCookieSync(s, null), (e.cookieJar = this.ckjar) } } catch (t) { this.logErr(t) } }).then((t) => { const { statusCode: a, statusCode: r, headers: i, rawBody: o, } = t, n = s.decode(o, this.encoding); e(null, { status: a, statusCode: r, headers: i, rawBody: o, body: n, }, n) }, (t) => { const { message: a, response: r } = t; e(a, r, r && s.decode(r.rawBody, this.encoding)) }) } } post(t, e = () => { }) { const s = t.method ? t.method.toLocaleLowerCase() : "post"; switch ((t.body && t.headers && !t.headers["Content-Type"] && !t.headers["content-type"] && (t.headers["content-type"] = "application/x-www-form-urlencoded"), t.headers && (delete t.headers["Content-Length"], delete t.headers["content-length"]), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: this.isSurge() && this.isNeedRewrite && ((t.headers = t.headers || {}), Object.assign(t.headers, { "X-Surge-Skip-Scripting": !1 })), $httpClient[s](t, (t, s, a) => { !t && s && ((s.body = a), (s.statusCode = s.status ? s.status : s.statusCode), (s.status = s.statusCode)), e(t, s, a) }); break; case "Quantumult X": (t.method = s), this.isNeedRewrite && ((t.opts = t.opts || {}), Object.assign(t.opts, { hints: !1 })), $task.fetch(t).then((t) => { const { statusCode: s, statusCode: a, headers: r, body: i, bodyBytes: o, } = t; e(null, { status: s, statusCode: a, headers: r, body: i, bodyBytes: o, }, i, o) }, (t) => e((t && t.error) || "UndefinedError")); break; case "Node.js": let a = require("iconv-lite"); this.initGotEnv(t); const { url: r, ...i } = t; this.got[s](r, i).then((t) => { const { statusCode: s, statusCode: r, headers: i, rawBody: o, } = t, n = a.decode(o, this.encoding); e(null, { status: s, statusCode: r, headers: i, rawBody: o, body: n }, n) }, (t) => { const { message: s, response: r } = t; e(s, r, r && a.decode(r.rawBody, this.encoding)) }) } } time(t, e = null) { const s = e ? new Date(e) : new Date(); let a = { "M+": s.getMonth() + 1, "d+": s.getDate(), "H+": s.getHours(), "m+": s.getMinutes(), "s+": s.getSeconds(), "q+": Math.floor((s.getMonth() + 3) / 3), S: s.getMilliseconds(), }; /(y+)/.test(t) && (t = t.replace(RegExp.$1, (s.getFullYear() + "").substr(4 - RegExp.$1.length))); for (let e in a) new RegExp("(" + e + ")").test(t) && (t = t.replace(RegExp.$1, 1 == RegExp.$1.length ? a[e] : ("00" + a[e]).substr(("" + a[e]).length))); return t } queryStr(t) { let e = ""; for (const s in t) { let a = t[s]; null != a && "" !== a && ("object" == typeof a && (a = JSON.stringify(a)), (e += `${s}=${a}&`)) } return (e = e.substring(0, e.length - 1)), e } msg(e = t, s = "", a = "", r) { const i = (t) => { switch (typeof t) { case void 0: return t; case "string": switch (this.getEnv()) { case "Surge": case "Stash": default: return { url: t }; case "Loon": case "Shadowrocket": return t; case "Quantumult X": return { "open-url": t }; case "Node.js": return }case "object": switch (this.getEnv()) { case "Surge": case "Stash": case "Shadowrocket": default: { let e = t.url || t.openUrl || t["open-url"]; return { url: e } } case "Loon": { let e = t.openUrl || t.url || t["open-url"], s = t.mediaUrl || t["media-url"]; return { openUrl: e, mediaUrl: s } } case "Quantumult X": { let e = t["open-url"] || t.url || t.openUrl, s = t["media-url"] || t.mediaUrl, a = t["update-pasteboard"] || t.updatePasteboard; return { "open-url": e, "media-url": s, "update-pasteboard": a, } } case "Node.js": return }default: return } }; if (!this.isMute) switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": default: $notification.post(e, s, a, i(r)); break; case "Quantumult X": $notify(e, s, a, i(r)); break; case "Node.js": }if (!this.isMuteLog) { let t = ["", "==============📣系统通知📣==============",]; t.push(e), s && t.push(s), a && t.push(a), console.log(t.join("\n")), (this.logs = this.logs.concat(t)) } } log(...t) { t.length > 0 && (this.logs = [...this.logs, ...t]), console.log(t.join(this.logSeparator)) } logErr(t, e) { switch (this.getEnv()) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: this.log("", `❗️${this.name},错误!`, t); break; case "Node.js": this.log("", `❗️${this.name},错误!`, t.stack) } } wait(t) { return new Promise((e) => setTimeout(e, t)) } DoubleLog(d) { if (this.isNode()) { if (d) { console.log(`${d}`); msg += `\n ${d}` } } else { console.log(`${d}`); msg += `\n ${d}` } } async SendMsg(m) { if (!m) return; if (Notify > 0) { if (this.isNode()) { var notify = require("./sendNotify"); await notify.sendNotify(this.name, m) } else { this.msg(this.name, "", m) } } else { console.log(m) } } done(t = {}) { const e = new Date().getTime(), s = (e - this.startTime) / 1e3; switch ((this.log("", `🔔${this.name},结束!🕛${s}秒`), this.log(), this.getEnv())) { case "Surge": case "Loon": case "Stash": case "Shadowrocket": case "Quantumult X": default: $done(t); break; case "Node.js": process.exit(1) } } })(t, e) }
// Env rewrite:smallfawn Update-time:23-6-30 newAdd:DoubleLog & SendMsg