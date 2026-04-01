# 学习通作业/考试/待办列表 (Modified)
![Version](https://img.shields.io/badge/版本-2.2.0-blue?style=flat-square)     ![License](https://img.shields.io/badge/协议-AGPL%203.0-green?style=flat-square)    [![Author](https://img.shields.io/badge/修改者-Coren-orange?style=flat-square)](https://github.com/Cooanyh)    ![Original](https://img.shields.io/badge/原作者-甜檸Cirtron-ff69b4?style=flat-square)

这是一个用于优化超星学习通（chaoxing.com）作业与考试列表显示的 Userscript 脚本。

本脚本基于 [lcandy2/user.js](https://github.com/lcandy2/user.js/tree/main/websites/chaoxing.com/chaoxing-assignment) 开发，在原版基础上修复了部分显示问题，并增加了待办事项汇总和课程任务汇总功能。

## 📥 安装

1.  安装脚本管理器：
    * **Chrome/Edge**: [Tampermonkey](https://www.tampermonkey.net/)
    * **Firefox**: [Greasemonkey](https://addons.mozilla.org/zh-CN/firefox/addon/greasemonkey/)
2.  点击安装本脚本（或手动复制脚本代码到管理器中新建脚本）。

## ✨ 功能特性

与原版相比，本修改版主要包含以下更新：

* **UI 全新升级**：
    * 带来更现代化的设计风格。
    * 提供 **学习仪表盘**，一站式概览作业、考试及课程进度。
* **新增"待办任务"聚合页**：
    * 自动汇总所有状态为"未提交"的作业和"未完成/未过期"的考试和"进行中"的课程任务。
    * 按截止时间排序，提供直观的"立即去办"跳转按钮。
    * 24小时内截至的任务会有"紧急任务"提醒
* **新增课程任务聚合页**：
    * 自动遍历所有课程然后读取课程任务并汇总（**有遗漏风险！**）
* **考试列表修复与优化**：
    * **状态标签优化**：将原本的纯文本状态优化为彩色 Chip 标签（进行中/未开始/已结束），视觉识别更清晰。
    * **列表布局调整**：在考试列表中增加了"课程"列，与作业列表布局保持一致。
* **扩展支持页面**：
    * 新增对学习通个人空间首页 (`i.chaoxing.com`) 的支持，在侧边栏或顶部菜单中注入入口。

## 使用示例
<img src="https://scriptcat.org/api/v2/resource/image/CJar7GQA4h0iuPQh" width="600" />
<img src="https://scriptcat.org/api/v2/resource/image/ljjGzJdbJzVuZCjk" width="600" />
<img src="https://scriptcat.org/api/v2/resource/image/Hfz6p09FAGd23m8F" width="600" />

> 说明
 作业/考试列表参考学习于原作者

## 🛠️ 使用方法

脚本安装后会自动运行，无需额外配置。

1.  登录 [学习通网页版](https://i.chaoxing.com)或者[https://i.mooc.chaoxing.com/](https://i.mooc.chaoxing.com/)
2.  脚本会自动在页面顶部菜单栏或左侧功能栏中插入以下三个入口：
    * **待办任务**：查看当前急需处理的事项。
    * **全部作业**：查看所有课程的作业历史与状态。
    * **全部考试**：查看所有考试安排。
3.  点击对应入口即可打开悬浮层查看详情。

## 📋 更新日志

### v2.2.0
* 🚀 **增强版课程进度悬浮窗**：鼠标悬停课程卡片时显示详细的学习活动
  * 展示课程作业、在线考试、章节测验、互动测验等信息
  * 智能数据加载与缓存，避免重复请求
  * 活动状态彩色标签（进行中/已完成/未开始）
  * 移动端自适应设计，悬浮窗不会被遮挡
  * z-index 提升至 10000，确保显示在顶层
* 📊 **课程进度全屏查看**：新增"查看全部"功能，支持全屏查看所有课程进度
  * 响应式网格布局，适配不同屏幕尺寸
  * 保留原有悬浮窗功能，等比放大方便查看
  * 悬浮窗z-index提升至100000，避免被遮挡
* 🔗 **新增AI实践和分组任务API集成**
  * 集成专用API获取AI实践数据（ai-evaluate-stat）
  * 集成专用API获取分组任务数据（groupTask）
  * 智能数据源回退机制，确保数据完整显示
* 🎯 **智能排序优化**
  * 有数据的课程优先显示，查询不到数据的课程自动后排
  * 在有数据的课程中，按任务完成进度排序（完成度少的在前）
* 🔧 **界面优化与Bug修复**
  * 修复查看全部页面悬浮窗显示异常问题
  * 修复悬浮窗被其他卡片遮挡的问题
  * 清理调试代码，优化性能

### v2.1.0
* 🔧 修复课程进度卡片在宽屏下的布局问题
* 🛡️ 新增课程信息忽略功能（二次确认、多选、批量操作）
* 💾 忽略状态通过 localStorage 持久化存储
* 🔄 支持批量恢复已忽略的课程

### v2.0.0 
* 🎨 UI 重构：使用 Vuetify 进行全面重构，界面更加美观现代化。
* 📊 仪表盘：新增学习仪表盘功能，集成作业、考试、课程进度。
* ⚡ 性能优化：优化数据获取逻辑，支持并发请求。

### v1.7.0
* 新增：课程任务汇总显示
* 新增：待办即将过期的任务提醒
* 优化：进入网页后自动进入"待办"页面

## ⚖️ 协议与致谢

本脚本遵循 **AGPL-3.0** 开源协议。

* **原作者**：[甜檸Cirtron (lcandy2)](https://github.com/lcandy2)
* **原项目地址**：[chaoxing-assignment](https://github.com/lcandy2/user.js/tree/main/websites/chaoxing.com/chaoxing-assignment)
* **原作者脚本地址**：[脚本猫地址](https://scriptcat.org/zh-CN/script-show-page/1845)
* **修改者**：Coren

如果你觉得本脚本有用，请优先支持原作者的项目。
