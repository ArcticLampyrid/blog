---
date: 2024-02-25 17:20:11
updated: 2024-02-25 17:20:11
category: 好物
title: 在 Windows 上使用 LDAC 蓝牙音频编解码器
---
## 引
LDAC 是一种由索尼开发的蓝牙音频编解码器，它支持高达 990 kbps 的比特率，可通过蓝牙传输 24bit/96kHz 的高质量音频。然而，Windows 操作系统并不原生支持 LDAC 编码器，因此需要通过第三方驱动来实现。

## 步骤
1. 安装 [Alternative A2DP Driver](https://www.bluetoothgoodies.com/a2dp/)
2. 打开并为蓝牙设备安装 Alternative A2DP Driver 驱动  
   {% asset_img install-a2dp-driver.png %}
3. 调整编解码器参数，设置编解码器类型为 LDAC，并根据实际情况调整编码质量。

{% alertbar info "注意：Alternative A2DP Driver 为付费软件，授权费用为 5.99 USD，可以通过 PayPal 购买。" %}
