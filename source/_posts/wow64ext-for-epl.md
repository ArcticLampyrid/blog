---
title: 给易语言用的 WOW64Ext 模块
date: 2016-12-26T13:29:23+08:00
updated: 2024-02-18T02:10:24+08:00
category: 技术
---
## 说明
基于 [WOW64Ext VC 版](http://blog.rewolf.pl/blog/?p=1484) 移植，为易语言提供在 WOW64 下调用 64 位系统 ntdll 函数的能力。

使用举例：
- 在 WOW64 进程中调用 `RtlCreateUserThread` 向 Native x64 进程注入代码，加载 x64 DLL。
- 读写 Native x64 进程的内存。

## 依赖
- 仅使用核心库

## 下载
附件：{% asset_link "WOW64Ext For EPL V1.0.zip" %}
