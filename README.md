# 学习通作业 / 考试 / 待办列表

![版本](https://img.shields.io/badge/版本-2.5.1-blue?style=flat-square) ![许可证](https://img.shields.io/badge/协议-AGPL--3.0-green?style=flat-square) [![修改者](https://img.shields.io/badge/修改者-Coren-orange?style=flat-square)](https://github.com/Cooanyh) ![原作者](https://img.shields.io/badge/原作者-甜檸Cirtron-ff69b4?style=flat-square)

> 面向超星学习通网页版的用户脚本，用于汇总待办、作业、考试、课程任务和课程进度。

本项目基于 [lcandy2/chaoxing-assignment](https://github.com/lcandy2/user.js/tree/main/websites/chaoxing.com/chaoxing-assignment) 修改。

## 功能

- **学习仪表盘**：集中查看待办、全部作业、全部考试、课程任务和课程进度。
- **课程任务识别**：汇总课堂活动与任务引擎计划，并提供分类筛选、按课程忽略和手动重试。
- **读取状态提示**：检测到课程列表、任务接口或响应格式异常时显示提醒，避免将不完整结果当作空列表。
- **任务管理**：待办可跨类别按截止时间排序；临近截止时会在页面内提醒，可选浏览器系统通知；支持短时缓存。

## 安装

1. 安装用户脚本管理器，例如 [ScriptCat](https://scriptcat.org/) 或 [Tampermonkey](https://www.tampermonkey.net/)。
2. 在浏览器中打开[当前版本脚本](https://raw.githubusercontent.com/Cooanyh/chaoxing-list/main/chaoxing-list.user.js)，按管理器提示完成安装。
3. 登录[学习通网页版](https://i.chaoxing.com/)并刷新页面。

## 使用

脚本会在学习通页面菜单中添加“学习仪表盘”入口。打开后可查看待办、作业、考试、课程任务和课程进度。

### 读取异常与重试

课程任务卡片出现“读取不完整”时，点击“重试读取”。重试期间旧提醒会暂时隐藏；读取结束后，如果仍检测到接口失败、响应格式异常或任务计划数不匹配，提醒会再次显示。课程列表整体读取失败时会显示错误提示，已有仪表盘缓存会保留。

> 提示：脚本根据接口错误、响应格式和任务计划数等信号判断读取异常。若平台返回格式正常、但内容本身已经缺项，脚本不一定能自动发现；遇到疑似遗漏时请核对课程页面。

## 界面预览

![学习通界面示例 1](https://scriptcat.org/api/v2/resource/image/CJar7GQA4h0iuPQh)
![学习通界面示例 2](https://scriptcat.org/api/v2/resource/image/ljjGzJdbJzVuZCjk)
![学习通界面示例 3](https://scriptcat.org/api/v2/resource/image/Hfz6p09FAGd23m8F)

## 更新记录

当前版本为 v2.5.1，新增分阶段临近任务提醒，并优化课程进度和待办排序。完整版本历史见 [CHANGELOG.md](CHANGELOG.md)。

## 问题反馈

请通过 [GitHub Issues](https://github.com/Cooanyh/chaoxing-list/issues) 提交问题，并注明脚本版本、页面类型和提示内容。提交截图或响应数据前，请移除账号、Cookie、密码以及课程链接中的 `enc` 等敏感信息。

## 许可证与致谢

本脚本采用 [AGPL-3.0](LICENSE) 开源协议。

* **原作者**：[甜檸Cirtron (lcandy2)](https://github.com/lcandy2)
* **原项目地址**：[chaoxing-assignment](https://github.com/lcandy2/user.js/tree/main/websites/chaoxing.com/chaoxing-assignment)
* **原作者脚本地址**：[脚本猫地址](https://scriptcat.org/zh-CN/script-show-page/1845)
* **修改者**：Coren

如果你觉得本脚本有用，请优先支持原作者的项目。
