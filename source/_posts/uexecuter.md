---
date: 2023-05-29 01:32:00
updated: 2023-05-29 01:32:00
category: 技术
title: UEXECUTER —— 串口通讯下的函数调用器
tag: [Embedded]
excerpt: 新坑，一个可爱的函数调用器，通过串口通讯调用单片机上的函数，支持 ARM 硬件浮点数模型。
---
## 前言
本届科协电子部的留任题之一是做一个轻量级的串口通讯函数调用器，考虑到这一方向的确有一定的实用性，便尝试写了一个较为完整的方案（{% blur 不过其实还是有很多功能残缺的 %}）

## 介绍
UEXECUTER 是一个可爱的函数调用器，采用人类可读的字符串作为指令，通过串口通讯，对单片机上的函数进行调用。目前做了对 STM32F4 系列单片机的支持，支持 ARM 硬件浮点数模型（`-mfloat-abi=hard`）。

### Why `UEXECUTER` other than `UEXECUTOR` ?
Because it's CUTE.

## 展示
<iframe src="//player.bilibili.com/player.html?aid=401735237&bvid=BV1Lo4y1M7mK&cid=1145341007&page=1" allowfullscreen="allowfullscreen" width="100%" height="500" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true"> </iframe>

## 代码
见 Github Repo： [ArcticLampyrid/uexecuter](https://github.com/ArcticLampyrid/uexecuter)