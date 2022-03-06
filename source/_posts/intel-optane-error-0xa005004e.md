---
title: Intel Optane Error 0xA005004E
date: 2019-05-26 10:24:20
category: 技术
---
当我多次试图启用Optane加速时（包括使用RST程序和Optane专用程序），反复得到错误0xA005004E的提示。
查询Intel官网，无此错误代码的解释。
更新RST操作系统层驱动无果。
重新刷写UEFI固件更新RST底层驱动无果。
最后发现是BitLocker的锅，把所有已经加密的驱动器解锁（不需要禁用BitLocker）即可。