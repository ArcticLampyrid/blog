---
date: 2022-10-15T18:05:08+08:00
updated: 2022-10-28T15:11:51+08:00
category: 技术
title: 又一个南邮 WiFi 自动登录工具（PC）
tag: [NJUPT, Rust]
---
为了节约登录校园网 WiFi 的时间（{% blur 满足生理上对懒惰的追求 %}），写了个自动登录的小玩意  
Repo: https://github.com/ArcticLampyrid/njupt_wifi_login  

## 特点
- 自动侦听网络变更通知，在休眠结束、手动重连 WiFi 等场景下依旧可以自动登录，无需手动运行登录脚本
- 指定了 no proxy，以避免在启用全局 Http/Socks5 代理的情况下，因为分流规则不合理或代理暂不可用（如登录脚本比 proxy server 先运行或 remote proxy 需要先联网再使用）而导致错误
- 得益于 Rust 的 native 和 zero-cost abstraction，启动速度极快，长驻后台（侦听网络变更通知）的占用极小

## 使用
### 使用配置器
*在 v0.1.1 及更高版本中，可用配置器完成配置*
1. [下载二进制文件](https://github.com/ArcticLampyrid/njupt_wifi_login/releases)或从[源代码](https://github.com/ArcticLampyrid/njupt_wifi_login)构建
2. 打开 `njupt_wifi_login_configurator`，填写你的账号信息，勾选 Enable，点击 Save 按钮
3. 重启操作系统后生效

### 手动配置
1. [下载二进制文件](https://github.com/ArcticLampyrid/njupt_wifi_login/releases)或从[源代码](https://github.com/ArcticLampyrid/njupt_wifi_login)构建
2. 将用户名和密码写入配置文件（如 `njupt_wifi.yml`）
   ```yaml
   isp: CT # 移动用 CMCC，电信用 CT，南邮自身的用 EDU
   userid: "B22999999"
   password: "password123456"
   ```
3. 配置 `njupt_wifi_login` 开机自动启动（可以通过计划任务）

## 系统要求
目前是 Windows-only 的，因为我不怎么用 Linux 当主力，而侦听网络变更通知是 platform-specific 的。  
对于 Linux 支持，可以尝试使用 `NETLINK_ROUTE` 实现侦听，可以考虑用 [`rtnetlink`](https://github.com/little-dude/netlink/tree/master/rtnetlink) 库。PR is welcome. 🤣  