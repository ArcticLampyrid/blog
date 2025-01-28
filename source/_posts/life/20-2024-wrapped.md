---
title: 2024 年度总结（附解谜红包）
date: 2025-01-29 00:00:00
updated: 2025-01-29 00:52:00
category: 生活
toc: true
excerpt: 2024 年度总结，回顾了一年的开源生活、数码消费、旅行经历、赛博娱乐等方面的经历，详细总结了 2024 年度完成的各类事务，并流露了对未来的一些期望。<br>希望 2025 年能够更加充实多彩，也希望大家都能够在新的一年里有所收获！（附 2025 年解谜红包）
---

## 开源
先上 GitHub 钻石图：
{% asset_img GitHubContributions.webp "GitHub Contributions 2024" %}

虽然总体上依旧比不上各位佬们，但 2024 年的编码量总体还是比较充足的。当然这一年电子类就玩得少了，更像所谓的~~『EE 最好的出路是转 CS，少走十年弯路』~~的样子了。

然后再看看每月统计：
{% asset_img GitHubContributionsPerMonth.webp "GitHub Contributions Per Month 2024" %}
整体上都不错呢。不过大概是今年下半年课程太过阴间的原因~~（总之就是不建议任何人来读南邮的通工！）~~，11 月和 12 月的编码量就明显下降许多了。{% blur "好吧好吧，也有不知道开什么新坑的原因吧……确实越来越不知道该做什么了……" %}

猜猜今年写什么语言最多呢？
{% asset_img GitHubMostUsedLanguage.webp "GitHub Most Used Language 2024" %}
是 Rust 哦！R 门！

### 数数新开的坑吧
首先是打印相关的坑：
- [winprint.rs](https://github.com/ArcticLampyrid/winprint.rs)：调用 Windows 打印机的 Rust 库（其实不完全是新坑，有一部分 Demo 级别的代码大概在 2021 年就写了，只是一直在咕咕咕）
- [print_raster.rs](https://github.com/ArcticLampyrid/print_raster.rs)：解析打印栅格数据（CUPS Raster & Apple Raster）的 Rust 库（这个就真的是新坑啦）
- [ipp-sharing](https://github.com/ArcticLampyrid/ipp-sharing)：用于将 Windows 打印机共享为 IPP 打印机的小工具

打印相关的坑基本都是为了共享打印机而开的，因为 Windows 默认不支持以 IPP 2.0 协议（driveless 形态）共享打印机，所以一直（大概 2021 年起）就想写一个这样的工具。不过因为有把打印机连接到这个的电脑上（家）、用 Linux SBC 和 CUPS 作为打印服务器（社团活动室）的替代方案，就一直咕咕咕了～后面大概是因为受不了某些专有 Linux 打印机驱动的故障率，才又把这个坑捡起来的。

用自己写的 IPP Sharing 工具，配合从海鲜市场收到的廉价 Win 平板（具体来说呢，就是 127 元的 PiPO X8），比某些闭源 Linux 打印机驱动要稳定得多啦～顺带还可以得到一个触控交互界面，用于处理缺纸、手动双面打印之类的事情呢。

然后还去玩了一些奇怪的东西，写了个极其混乱的小爬虫，通过 开往 友链接力平台，简单分析了一下友链数据与【六度分隔理论】的符合情况：
- 数据分析 [travellings-graph](https://github.com/ArcticLampyrid/travellings-graph) 
- 展示前端 [travellings-graph-frontend](https://github.com/ArcticLampyrid/travellings-graph-frontend)
- 相关文章 {% post_link test-six-degrees-of-separation-on-travellings %}

再就是，Hexo 用户当然要折腾一下 Hexo 生态啦～
- [hexo-shiki-highlighter](https://github.com/ArcticLampyrid/hexo-shiki-highlighter)：使用 Shiki 作为代码高亮器的 Hexo 插件，可以做到和 VSCode 同款的准确性哦
- [hexo-auto-excerpt-rebirth](https://github.com/ArcticLampyrid/hexo-auto-excerpt-rebirth)：一个更加灵活的 Hexo 自动摘要插件，这样就不用看 `strip_html` 生成的奇怪摘要了

最后，课程相关的坑：
- [njupt_score_pusher](https://github.com/ArcticLampyrid/njupt_score_pusher)：南邮成绩推送服务，再也不用在期末周天天刷教务系统啦！

### 然后是维护工作啊
只开坑不填坑，那不是好孩子。{% blur "嗯……有些坑确实还没填就是啦，别催啦。" %}

首先是，年初整理了一下 [DictationAssistant](https://github.com/ArcticLampyrid/DictationAssistant) (2013-2024) 的代码并开源了出来。{% blur "看上去似乎完全没有什么工作量呢。" %}这个项目大概算是写的最早的可以算得上是 Application 而不是 Demo 的东西啦，虽然咱已经大学了那基本上就没啥用了（这个项目用于辅助 K12 阶段时候做听写训练）。

然后的话，继续更新 [njupt-wifi-login](https://github.com/ArcticLampyrid/njupt_wifi_login)，把日志轮替（Log rotation）、接口绑定（Interface binding）等功能加了进去，以适应更多的使用场景。现在已经在我的路由器上无人值守运行了半年啦，赛高！

对于 [action-wait-for-workflow](https://github.com/ArcticLampyrid/action-wait-for-workflow) 这样的小玩意也得到了一次更新，还发现了 GitHub Actions 的一些有趣的特性：{% post_link gha-workflow-for-pull-request %}

[stm32tesseract](https://github.com/ArcticLampyrid/stm32tesseract) 也在继续维护，着重优化了在纯大陆普通网络环境下的使用体验（虽然还是比不上环大陆地区的使用体验）。作为一个简单的环境配置工具，STM32Tesseract 今年被 CAST（南邮通院科协）推广使用，也收获了许多反馈与建议，在此表示感谢！

同时也维护了一下 [MMKV.NET](https://github.com/ArcticLampyrid/MMKV.NET)，把自动过期、枚举数据等功能加上啦。提交记录在 2025 年但是在春节前，就算在 2024 年度总结里面啦。{% blur "要不然大概没东西可写了呢（逃" %}

### 至于团队协作嘛
继续在校科协打杂，做了些关于 [sast-evento](https://github.com/NJUPT-SAST/sast-evento) 的边缘工作，修了一些杂七杂八的 bug，然后搓各种奇怪的 CI/CD 配置。~~要变成流水线仙人的模样啦，不要啊！~~

当然这中间还有些好玩的东西，比如：
- {% post_link a-brief-of-runtime-library-path %}
- {% post_link ui-element-application-with-qt-on-mac %}

### 以及参与的社区项目
又名：到处乱提的 PRs/Patches（逃

首先是给 CMake 提了个 [MR #9348](https://gitlab.kitware.com/cmake/cmake/-/merge_requests/9348)，允许通过 file-based API 获取配置了 `CONFIGURE_DEPENDS` 的 glob 表达式，以允许 IDE 等工具在新建文件后自动刷新配置。不过事实上写一半就开摆了，拖到现在还没给 vscode-cmake-tools 等 IDE 侧工具链提 PR 呢（逃

接着呢，给 LLL (Lenovo Legion Linux) 项目提了个 UI 优化的 [PR #189](https://github.com/johnfanv2/LenovoLegionLinux/pull/189)，使得其 GUI 界面可以在我这样的高缩放用户下完整显示出来。

然后就是水了个 Linux Kernel 的 commit [linux@31855545](https://github.com/torvalds/linux/commit/318555454100fe64ae8b82866c904f2880829e19)，修复了 {% post_link fix-legion-y9000x-2022-iah7-speaker-on-linux "Legion Y9000X 2022 IAH7 内置扬声器在 Linux 下无声音的问题" %}。当然对于中断的处理方法最终采用了 [linux@762eba70](https://github.com/torvalds/linux/commit/762eba7096e3d4d81faefffcc57074a82b53613d) 的方法：忽略注册失败的中断（根据与维护者的讨论，如果像我之前的方案一样按 DSDT 表的中断类型注册中断，似乎也无法正确生效）。

同时给 zeroconf-rs 提了 [PR #56](https://github.com/windy1/zeroconf-rs/pull/56)，给 bonjour-sys 提了 [PR #4](https://github.com/windy1/bonjour-sys/pull/4) 和 [PR #7](https://github.com/windy1/bonjour-sys/pull/7)：这些 PR 使得 zeroconf-rs 可以支持在 Win x86 平台（而非 x86-64 only）上正确使用 Bonjour 服务，也是配合打印机服务的需求而来的。

继续水 slint 的 [PR #6429](https://github.com/slint-ui/slint/pull/6429)，允许某些 Slint-specific target property 使用生成器表达式（Generator Expression）。

此外，因为设备增加和活动场地扩大等原因，本人对虚拟组网（或者说 P2P Mesh VPN）的需求也在增加，因此还给 Headscale 提了个 [PR #2046](https://github.com/juanfont/headscale/pull/2046)，添加了便于自定义 DERP 服务器使用的 `/verify` Endpoint 以及相关的集成测试（其实后者才是工作重点，前者已经有前辈实现过了，只是不符合 review 流程而没有被合并）。

同时 Patch 了一份 derper 给自己用，参见 {% post_link deploy-tailscale-derp-on-nat-rcs %}。

## 数码
总体上来说，2024 年的数码实物消费较少，更多是在折腾云，并顺带优化了一下本地网络环境。同时也把主系统迁移到了 Arch Linux，以适应更多的开发需求。

### 关于网络设施
新换了一些路由器和交换机，把家里的网络环境整理了一下，内网 2.5Gbps 有线全覆盖、无线基本覆盖。虽然实际上将来可能不太会回家了（大学结束就该一个人出去工作了嘛）
 
收了台 TL-XDR6086（参见 {% post_link recover-openwrt-via-uboot %}）放在宿舍，这下终于有高速的宿舍 WiFi 可用了！比起学校自己的那一堆残血 802.11ac 的 AP 发射点，体验上升明显。

### 关于云服务
把之前购买的廉价 RackNerd VPS 废弃了，新购买了 AWS Lightsail，并从一些小厂那里购买了香港九龙和浙江宁波的 VPS，总体上各项服务都要快速稳定许多。申请到了 AWS SES (Simple Email Service) 的发信权限，应该可以避免部分邮件被当成垃圾邮件拦截了。

- 把资料共享云盘迁移到了 AList 并放置在香港，不过大陆直连的可用性依旧不是很高，正在考虑进一步优化方案。
- 虚拟组网服务继续使用自托管 Headscale + 自建 DERP 服务器的方案，添加了国内 DERP 服务器以提高连接速度。
- 使用 [Authelia](https://www.authelia.com/) 部署了轻量化的 OIDC 协议的单点登陆（SSO）服务，现在 AList 后台、Headscale 后台、自用的卡片笔记系统等均可以通过 Authelia 进行统一认证了。

部分服务仍然在迁移中。{% blur "咕咕咕～" %}

### 迁移至 Arch Linux
在 2024 年初，把开发电脑的主系统迁移到了 Arch Linux（Set up 过程参见{% post_link arch-luks2-installation-notes %}）。迁移 Linux 主要有以下的考量：
- 由于本人折腾的 Native 开发较多，仅使用 Windows 并依靠跨平台工具链并不足以满足需求。
- 由于 Linux 设备（云服务器、SBC、工控机、路由器等）的使用率越来越高，迫切地需要一个环境更加接近相似的开发环境，以便于在这些设备上部署一些个人项目。
- 由于玩得越来越杂，迫切需要一个可以自由隔离环境的系统，Container 技术是一个不错的选择，但在 Windows 下必须依靠 Hyper-V/WSL2 才可使用，换用 Linux 系统可以更加方便。
- 部分 AI 框架（如 TensorFlow）对 Windows 的支持不够完善，换用 Linux 则可以更好地使用。

至于选择 Arch Linux 嘛，主要是眼馋 AUR 和 Arch Wiki 的丰富资源，以及高度可定制化的 set up 和滚动发行真的很对我胃口啊，再也不用为了用个新版本而去拉源码自编译了（虽然有时候还是逃不掉，很多使用 SBC 的场景还得接着用 Ubuntu）。

当然迁移期间也碰到了一些问题，比如：
- Linux Kernel 不能正确驱动我的笔记本的内置扬声器，参见 {% post_link fix-legion-y9000x-2022-iah7-speaker-on-linux %}。
- 由于 KDE 的 bug，有时蓝牙无法在开机时被自动启用的问题，参见 [plasma/bluedevil MR #165](https://invent.kde.org/plasma/bluedevil/-/merge_requests/165)。
- Linux QQ 因虚拟网卡的 MAC 地址不固定而不断将电脑识别为新设备，导致需要重新登录，参见 {% post_link fix-mac-for-linux-qq %}。
- “可爱的” Linux 微信（新版已无此问题）在和我的其他插件抢占快捷键，参见 {% post_link block-hotkeys-for-wechat-uos %}。
- 腾讯会议在 Wayland 下无法使用屏幕共享功能，可以用 xuwd1 佬的 [wemeet-wayland-screenshare](https://github.com/xuwd1/wemeet-wayland-screenshare) 解决。

在将各种问题逐步解决或绕过后，Arch Linux 成为了我的主力开发系统，目前已经稳定运行了 10 个月左右。考虑到 Dockek 的广泛应用以及 Linux 环境下进行 Native 开发的优势，这次迁移还是非常值得的。

## 生活
### 旅行
虽然基本还是呆在学校没怎么出去，但 2024 下半年确实仍有一些小旅行就是啦。

#### 南京夫子庙
今年国庆假期去了趟夫子庙，大抵有几分《泊秦淮》的原因。繁华确是无需解释的，然而现代化气息或许也浓厚了些，很难说是值得还是失望了。{% blur "所以说，你怎么连南京本地的景点都没逛完啊 &lt;(｀^´)&gt;" %}

Anyway，放照片。

科举博物馆：{% asset_img NanjingFuzimiao01.webp "科举博物馆" %}
秦淮河道：{% asset_img NanjingFuzimiao02.webp "秦淮河道" %}
夫子庙主殿：{% asset_img NanjingFuzimiao03.webp "夫子庙主殿" %}
无孔不入的奶茶：{% asset_img NanjingFuzimiao04.webp "无孔不入的奶茶" %}

#### 杭州西湖
因为参加某些活动，11月中旬到了杭州，顺便也再次游览了一遍西湖。但因为时间太紧 & 组团活动的原因，实际上最大的感受是：走得好累emmm

放几张雷峰塔的照片吧。

外景：{% asset_img HangzhouWestLake01.webp "外景" %}
遗址保护区：{% asset_img HangzhouWestLake02.webp "遗址保护区" %}
塔顶游客：{% asset_img HangzhouWestLake03.webp "塔顶游客" %}
高处风景：{% asset_img HangzhouWestLake04.webp "高处风景" %}

### 云村
来看看赛博心灵旅店的年度报告：
{% asset_img CloudMusic2024.jpg "云村 2024 年度报告" %}

活跃时段 22:00 ~ 29:00，~~夜猫子实锤~~。

#### [年度歌单](https://music.163.com/playlist?id=13050324579&userid=1504287396)
> 每一首歌都是新的旅途  
> 我们走向远方 却听见自己  
> 人生是旷野 音乐也是  

- [风尘寄月](https://music.163.com/song?id=1933201638&userid=1504287396)
- [2024·面朝大海，举起约定的花束](https://music.163.com/song?id=2113358616&userid=1504287396)
- [心许百年](https://music.163.com/song?id=2005213526&userid=1504287396)
- [风烟之末](https://music.163.com/song?id=2116713419&userid=1504287396)
- [皮囊](https://music.163.com/song?id=2069604135&userid=1504287396)
- [灯海照月](https://music.163.com/song?id=2129322210&userid=1504287396)
- [不负韶光](https://music.163.com/song?id=1846512883&userid=1504287396)
- [不问天](https://music.163.com/song?id=1905945600&userid=1504287396)
- [观测时间的人](https://music.163.com/song?id=2051796319&userid=1504287396)
- [雪落空山（故事念白）](https://music.163.com/song?id=1929036185&userid=1504287396)

#### 双人报告
要来[匹配一下试试看](https://y.music.163.com/st/year2024/radsjl451825288/double/invite?encUserId=C63D83836038B70AA456D79895B3EB27&fromRN=1&full_screen=true&market=sousuo&nm_style=sbt)吗～

### B 站
{% asset_img Bilibili2024.jpg "B 站 2024 年度报告" %}

年度 UP 是城阳电工，这倒是令人意外。

## 心愿卡
- 愿明天阳光明媚，愿生活更丰富多彩～
- 愿明天能更好地看清自我，找到新的可持续的动力源泉～
- 虽然不愿受到功利的束缚，但是……该考虑赚钱的事情了呢～
- {% blur "如果可能的话……顺带把去年的愿望也实现了吧👉👈" %}

## 2025 解谜红包
来自通信工程学生的新年祝福，check the image below：
{% asset_img RedPacket2025.webp "2025 解谜红包" %}  

支付宝拼手气口令红包，有效时间：2025 年 1 月 29 日 00:00 至 2025 年 1 月 29 日 23:30，66 CNY / 8 个。  
注：地址扫描、暴力爬虫等不是解谜的正确方式，请不要对本站服务器进行压力测试。

<iframe src="//music.163.com/outchain/player?type=2&id=2668140498&auto=0&height=66" title="【2025哔哩哔哩拜年纪单品
】春日游" style="width: 100%; height: 86px; margin: 0; border: none; " data-hint="caesar"></iframe>

Have a good time!
