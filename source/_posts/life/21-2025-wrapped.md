---
title: 2025 年度总结（附解谜红包）
date: 2026-02-16 23:00:00
updated: 2026-02-16 23:00:00
category: 生活
toc: true
---
## 开源
依旧先上 GitHub 钻石图：
{% asset_img GitHubContributions.webp "GitHub Contributions 2025" %}

可以看到 2025 年的编码量相比 2024 年有所下降。主要是跑去实习了，在开源方面的时间和精力少了不少。不过总体来说还是有一定的贡献的～

### 先看新坑
实际上今年的新坑并不多，主要有以下几个：
- [aur-mirror-meta](https://github.com/ArcticLampyrid/aur-mirror-meta)：用于根据 GitHub AUR Mirror 的数据索引元数据，提供 AUR RPC 兼容接口的项目。今年 AUR 频繁出现不可用的情况，这个项目可以提供一个实验性的备用方案。同时也借此机会深入学习了 Git 对象模型和 Git Protocol 的一些细节。
- [AnankeCheckin](https://github.com/ArcticLampyrid/AnankeCheckin)：适用于教学场景的一个简单考勤系统，事实上这个项目完全是因为课程设计的需要而诞生的。
- [njupt_smartclass_downloader](https://github.com/ArcticLampyrid/njupt_smartclass_downloader)：南京邮电大学智慧课堂视频下载器。大三下期末复习期间写的，方便下载智慧课堂的视频资源，进行离线观看与摘要分析。

### 日常维护
基本上也没有什么特别值得一提的维护工作，主要是对一些现有项目进行了一些小的改进和 bug 修复：
- [stm32tesseract](https://github.com/ArcticLampyrid/stm32tesseract)：新建了服务端 [stm32tesseract-cloud](https://github.com/ArcticLampyrid/stm32tesseract-cloud)，引入风铃草系统以实现快速的包分发（此前依赖不稳定的第三方 GitHub Mirror 方案），同时提供 Web 下载页和在线文档。
- [ipp-sharing](https://github.com/ArcticLampyrid/ipp-sharing)：修复了 XPS 格式无法打印的问题。同时添加一个简易的 GUI 以方便使用。
- [njupt_wifi_login](https://github.com/ArcticLampyrid/njupt_wifi_login)：添加了 UPX 压缩，以便在资源受限的硬路由中更好地工作。
- [action-wait-for-workflow](https://github.com/ArcticLampyrid/action-wait-for-workflow)：对各种边缘情况进行了处理，并编写一份 Cookbook 详细说明各种使用场景（虽然是个很简单的东西，但还是碰到 GitHub Actions 的很多 corner case 呢）。

### 到处乱提的 Issue/PR
首先是年初和朋友一起折腾转发的时候，发现 Caddy 不支持在两个正向代理之间做负载均衡，于是提了 [Issue #6994](https://github.com/caddyserver/caddy/issues/6944)，看起来还没有什么进展（后续我自己的类似需求基本都是通过专门的代理工具来解决了）。

其次还有在阅读 VSCode Copilot 的源码时，发现其 prompt 存在一些问题，提了 [Issue #258888](https://github.com/microsoft/vscode/issues/258888)

至于对外的 PR，似乎今年只完成了几个 tiny & trivial 的 PR：
- 修复 nanomq 作为库使用时存在编译问题的 [PR #2073](https://github.com/nanomq/nanomq/pull/2073)
- 修复 archlinux-downgrade 在 fish 下无法自动补全的 [PR #256](https://github.com/archlinux-downgrade/downgrade/pull/256)
- 修复 openwrt-tailscale 项目启动脚本未正确读取 fw_mode 的 [PR #52](https://github.com/GuNanOvO/openwrt-tailscale/pull/52)。

## 技术
既然开源产出很少，那么今年的技术日常又去哪里了呢？今年的上半年主要用于参加大学生服务外包创新创业大赛，下半年则是去业界实习去了。

### 服务外包大赛
关于这个比赛，我们团队主要参与的是【基于 OpenHarmony 的智能家居场景控制系统】这个企业命题项目。这是个软硬件结合的项目，主要工作可以分为网关设备和边缘设备（各种传感器）两部分，我主要负责网关设备的软件开发工作。项目中使用了 OpenHarmony 作为操作系统，使用 MQTT 作为通信协议（这就是为啥会跑去给 nanomq 提 issue）。

成绩并不好，团体省三等奖。不过也算是一次不错的经历，玩了很多新东西，比如：
- OpenHarmony 相关的技术栈（ArkTS + ArkUI）
- MQTT 协议及其在物联网中的应用
- 语音识别全流程（本地 KWS 关键词检测 --> 远程 ASR 语音识别 --> NLP 模型 --> TTS 语音输出）
- 大模型 + Tool Call 的简单实现

最后两个点其实在首轮提交的比赛作品中没有完全实现出来（时间不够了）。本来是打算在下一轮比赛中体现的，最后虽然做完了，但比赛被刷了……

智能互联演示：
<video controls style="max-width: 100%; height: auto; width: 400px; display: block; margin: 0 auto;">
  <source src="{% asset_path IoTHubDemo.mp4 %}" type="video/mp4">
</video>

语音识别演示（翻了相册才发现只留存了恶搞片段，emmm，凑活着看吧）：
<video controls style="max-width: 100%; height: auto; width: 400px; display: block; margin: 0 auto;">
  <source src="{% asset_path IoTHubAsrDemo.mp4 %}" type="video/mp4">
</video>

{% alertbar info "请在支持 H265 解码的环境中观看视频。" %}


### 业界实习
下半年起我在一家全球独角兽企业实习，主要负责 Android 客户端相关工作，同时也参与了许多 AI Agent 在业务场景中的落地实践。

实习期间新学习了很多技术，首先是把很久没碰的 Android 客户端技术栈又重新拾起来了，比如：
- 把很久不用的 Kotlin 又重新捡起来了
- 学习了 Android 系统架构、Activity/Fragment 生命周期等
- 接触到了一些比较新的客户端架构，比如 Data+Domain+UI 三层架构，数据驱动、单向数据流（UDF）、单一事实来源（SSOT）原则等

其次是 AI 应用侧相关的技术，主要包括：
- 大模型 + Tool Call 的落地实践
- Prompt 调优技巧（Role Play、Few-Shot Learning 等）
- 程序代码相关操作的 Tool 设计技巧
- Multi-Agent 协同工作流设计
- Agent 系统轨迹分析技巧

AI 应用侧方面的工作，总的来说并不算得上十分精巧（相比基建侧），但确实是一个充满潜力的方向。尤其是搭配内部已有的 SOP 和数据资源，可以很好地观测到 AI 技术的发展与落地过程中的各种问题与挑战，算是非常宝贵的经验积累了。

## 生活
### 独居
因为实习的缘故，下半年整体是在上海独自居住的状态。虽然说是合租房的小房间，不过也算是拿到了完整的起居自由权啦～

独居生活整体来说还是很爽的，可以完全按照自己的节奏娱乐和探索（虽然作为半个职场人，会不可避免地受到工作节奏的约束），再也没有莫名其妙的时间表限制了！

{% asset_img BedroomDemo.webp "卧室示意图" %}

### 云村
> 总有一首歌，是为了此刻  
> —— 网易云音乐 2025 年度报告  
> [（试试双人匹配）](https://y.music.163.com/st/year2025/radsjl302449672/double/invite?encUserId=08D8B12B580BAED23DA85DD943629DE3)

{% asset_img CloudMusic2025.jpg 400 "云村 2025 年度报告" %}

看看[年度歌单](https://music.163.com/playlist?id=17607432435&uct2=U2FsdGVkX1/JVAaIH1zjblvE6CpPdO4CY2Tf9t/LJ6M=)吧：
- [世人啊](https://music.163.com/song?id=1914397053)
- [救](https://music.163.com/song?id=2714807726)
- [知己人设](https://music.163.com/song?id=2112221975)
- [烟火焚-新](https://music.163.com/song?id=1428112692)
- [地下河](https://music.163.com/song?id=2694197949)
- [忘记](https://music.163.com/song?id=430793303)
- [心许百年](https://music.163.com/song?id=2005213526)
- [轮回之境](https://music.163.com/song?id=32957014)
- [2024·面朝大海，举起约定的花束](https://music.163.com/song?id=2113358616)
- [种星见月歌](https://music.163.com/song?id=1404094038)


> 牵起手吧，我们轻如浪花  
> 篝火从岸上凝望，燃尽了世上的谎话  
> 此刻谁在乎命运么  
> 躲进琥珀里再消融，明天不惧怕  

<iframe src="//music.163.com/outchain/player?type=2&id=3334797385&auto=0&height=66" title="2026·这一刻明亮而永恒" style="width: 100%; height: 86px; margin: 0; border: none; "></iframe>

## 心愿卡
- 多实现几个 idea 吧，工作之后时间似乎更加不够用了呢～
- 也许该花更多的时间关注一下 AI Agent 相关技术的发展了呢，渴望效率++啊
- 然后就是，扩展一下人文方向的知识面吧（虽然但是，好像 2024 就这么计划了，结果{% blur "完全没实现" %}呢，emmm）

## 2026 解谜红包
既然前几年都是把红包藏在图片里了，那今年就发个视频吧～

支付宝拼手气口令红包，有效时间：2025 年 1 月 28 日 23:00 至 2025 年 1 月 29 日 23:00，188 CNY / 8 个。  

<video controls style="max-width: 100%; height: auto; width: 400px; display: block; margin: 0 auto;" data-hint="jigsaw puzzle">
  <source src="{% asset_path RedPacket2026.mp4 %}" type="video/mp4">
</video>

注：地址扫描、暴力爬虫等不是解谜的正确方式，请不要对本站服务器进行压力测试。

Have a good time!
