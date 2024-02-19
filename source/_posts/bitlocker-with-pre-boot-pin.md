---
title: 使用带启动 PIN 的 BitLocker
date: 2024-02-19T14:43:45+08:00
updated: 2024-02-19T16:05:42+08:00
category: 技术
---
## 基本概念
- **BitLocker**：Windows 自带的磁盘加密工具，对全分区数据进行加密，可以防止任何人在没有密钥的情况下访问数据。
- **TPM**：Trusted Platform Module，受信任的平台模块。与 BitLocker 配合使用，可以在启动时验证系统的完整性，随后自动下发密钥实现自动解密。当系统（软件或硬件）被篡改，TPM 会拒绝下发密钥，从而保护数据安全。

## 为什么要使用 PIN
TPM 理论上仅在系统完整性被验证时才会下发密钥，而具有系统完整性的系统在启动后仍然会通过登陆机制验证用户身份。然而，在工程上，主要存在以下的攻击面：
- **操作系统漏洞攻击**：正常启动具有完整性的系统，此时数据已解密。随后，通过使用操作系统漏洞等方式获取数据。
- **DMA 攻击**：硬件完整性可被伪造。许多外设（如网卡、显卡）具有 DMA 功能，可以在系统启动后直接访问内存。通过伪造、替换硬件（并欺骗系统完整性验证），可以读取 TPM 下发的密钥。已有利用案例：[参考这篇文章](https://mp.weixin.qq.com/s/lLTR0XI6br46lEyaDCzfXA)（[备用链接](http://web.archive.org/web/20230713193954/https://mp.weixin.qq.com/s/lLTR0XI6br46lEyaDCzfXA)）
- **嗅探 LPC 数据总线**：在系统启动时，通过逻辑分析仪嗅探 LPC 数据总线，获取 TPM 下发的密钥。参见 [Breaking Bitlocker - Bypassing the Windows Disk Encryption](https://www.youtube.com/watch?v=wTl4vEednkQ)，该攻击仅对分立式 TPM 有效，对内嵌于 CPU 内的 fTPM 无效。

**⌈启动 PIN⌋** 不同于 Windows 登陆 PIN，它是参与解锁数据的密钥（key）的一部分，而不是用户身份验证的口令（password）的一部分。开启 ⌈启动 PIN⌋ 后，即使获取到 TPM 下发的密钥，仍无法解锁数据。需要输入 PIN 码后，使用启动 PID 和 TPM 下发的密钥一起参与计算，才能得到解锁数据的密钥。

## 如何使用启动 PIN
打开组策略（`gpedit.msc`），找到计算机配置 -> 管理模板 -> Windows 组件 -> BitLocker 驱动器加密 -> 操作系统驱动器 -> 预启动身份验证。选择“已启用”，在 ⌈配置 TPM 启动 PIN⌋ 中选择 ⌈有 TPM 时需要启动 PIN⌋。

{% asset_img group-policy.webp "组策略" %}

使用管理员权限打开命令提示符，输入以下命令：

```shell
manage-bde -protectors -add c: -TPMAndPIN
```

随后根据提示设置 PIN 码。重启电脑后，你会看到 BitLocker 要求输入 PIN 码才能启动系统。

## 注意事项
- 输入 PIN 的过程，**无法使用蓝牙键盘**。如果你的电脑没有内置键盘，请准备好有线键盘或带有 USB 接收器的无线键盘。
- 无法实现无人值守重启。
