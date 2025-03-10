/**
 * @name 示例脚本
 * @cron 0 0 * * *
 * @description 这是一个示例脚本，每天 0 点执行。
 * @require axios
 * @env MY_CONFIG
 */

const axios = require('axios');

// 从环境变量中获取配置
const MY_CONFIG = process.env.MY_CONFIG || 'default_value';

// 主函数
async function main() {
    console.log('脚本开始运行');
    console.log(`配置值: ${MY_CONFIG}`);

    try {
        // 示例：发送一个 HTTP 请求
        const response = await axios.get('https://api.example.com/data');
        console.log('请求结果:', response.data);
    } catch (error) {
        console.error('请求失败:', error.message);
    }

    console.log('脚本运行结束');
}

// 执行主函数
main();