---
title: 2026 解谜红包题解：Lucky Geek Game 2026
date: 2026-02-24 02:05:00
updated: 2026-02-24 02:05:00
category: 技术
toc: true
---

## 谜面
详见 {% post_link life/21-2025-wrapped %}。

本题相关代码已开源：<https://github.com/ArcticLampyrid/LuckyGeekGame2026>

今年的红包我把题面放在了一个 MP4 视频里：
- **音频轨**：一段听起来“嘟嘟嘟”的声音（是 SSTV 信号）
- **视频轨**：看似随机闪烁的小方块（是被打散成拼图的 QR Code）

## 解谜方法

### 总体思路
今年题目出的比较简单：**两个 Key 分别在音频和视频里，最后异或（XOR）合成答案**。

- 从 **SSTV** 解出 `KeyA`
- 从 **QR Code** 解出 `KeyB`
- 计算 `KeyA XOR KeyB = XXXXXXXX`
- 得到最终口令 `alampyXXXXXXXX`

### Step 1：从视频轨解出 KeyB（QR 拼图）

这一段的“障眼法”是：二维码被切成很多小块，每一帧只显示其中一块，而且顺序还打乱。

不过这类题一眼就能想到一个朴素打法（并且非常适合白嫖 AI 帮你写脚本）：

- 先估计视频的**静态背景**（比如对所有帧做逐像素众数）
- 每帧与背景做 diff，把出现过的“拼图块”叠加回去
- 拼出完整 QR，二值化一下，再扫码

如果你懒得手搓：把你的思路用自然语言描述清楚（“逐帧取背景→差分叠加→还原二维码→解码”），丢给一个会写 Python/OpenCV 的大模型，让它给你写一份脚本，通常也能很快跑通。

恢复出的二维码如下：

{% asset_img qr_extracted.png "从视频拼回的 QR Code" %}

扫码得到内容：

```
Great! KeyB: 70427701
Hint: Another key is in Robot36. Xor KeyA and KeyB to get XXXXXXXX,
then use Flag {alampyXXXXXXXX}
```

所以：

```
KeyB: 70427701
```


### Step 2：从音频轨解出 KeyA（SSTV）
视频轨的解答结果里面其实提示了音频模式是 **Robot36**（一种 SSTV 编码模式）。不过就算没提示，也有很多人直接听出来是 SSTV 信号了（

这里的解法就很多样了，比如直接找一个支持解码 **Robot36** 的 App，把视频/音频外放给手机“收听”。当然你也可以自己写解码器。

解出来是一张图，里面直接写着 KeyA：

{% asset_img sstv_extracted.png "SSTV 解码结果" %}

从图里读到：

```
KeyA: 13063108
```

### Step 3：异或得到最终口令

把两个 Key 按 **十进制整数** 做 XOR：

```text
KeyA XOR KeyB
= 13063108 XOR 70427701
= 83228657
```

因此最终口令是：

```
alampy83228657
```

## 尾声
- 今年红包 39 分钟内抢光 emmm，下次出简单题目看来要多发点了
- 其实有玩家反馈，某些 SOTA 大模型 + Agent 甚至可以**直接把视频丢进去然后给你吐出答案**……
