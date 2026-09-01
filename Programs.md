# chaoxing-list 项目说明

## 用途

本项目是一个用于优化超星学习通网页端作业、考试与待办列表展示的 Userscript。脚本在登录后的学习通页面中提供待办任务、全部作业、全部考试和课程任务等聚合视图。

## 来源与许可

- 仓库来源：<https://github.com/Cooanyh/chaoxing-list>
- 当前远程：`origin` 指向上述仓库。
- 上游参考：`lcandy2/user.js` 中的 chaoxing-assignment 脚本（详见 `README.md`）。
- 许可证：AGPL-3.0（以仓库内 `LICENSE` 为准）。

## 管理边界

- 本目录是“脚本猫”大项目下的独立子项目；代码、文档、Git 状态、提交和远程同步均在本目录内单独管理。
- 大项目根目录的 `Programs.md` 仅承担子项目汇总，不替代本文件。
- 默认不修改学习通服务端、不处理账号凭据，也不自动完成、提交或代办学习任务。
- 修改前应先检查 `git status`；未经明确授权，不执行提交、推送、强制操作或任何可能覆盖/删除数据的操作。

## 运行与验证提示

1. 在支持 Userscript 的浏览器中安装 Tampermonkey 或 Greasemonkey。
2. 导入或安装根目录的 `chaoxing-list.user.js`。
3. 使用测试账号登录 `i.chaoxing.com` 或 `i.mooc.chaoxing.com`，确认菜单入口、待办聚合、作业和考试列表能够加载。
4. 涉及请求策略、课程进度或页面交互的改动，应在真实浏览器会话中验证；静态检查不能替代页面验证。

## 文档约定

- 阶段性工作进展维护在 `doc/progress.md`。
- 本文件记录项目定位、来源、边界和基础运行/验证方式；业务功能细节以 `README.md` 与脚本源码为准。
