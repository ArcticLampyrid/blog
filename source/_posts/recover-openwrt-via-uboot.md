---
title: 通过 U-Boot 恢复无法引导的 OpenWRT 路由器
date: 2025-01-26 06:40:20
category: 技术
toc: true
cover: cover.webp
---
## 引
偶然间在海鲜市场看到了一款 TL-XDR6086，卖家自述是刷了官方 OpenWRT 后再刷入第三方 OpenWRT 导致无法引导，故而廉价出售。我便买了下来，准备尝试修复。  
{% asset_img goods-description.webp "卖家的描述" %}

经过简单查询，这个型号的路由器，其官方引导程序不支持第三方固件，而第三方 U-Boot 则有好几个版本，不同版本的 U-Boot 不能引导不配套的 OpenWRT 固件，那么我们只需要通过已有的 U-Boot 刷写一个配套的 U-Boot 和/或 OpenWRT 固件即可修复。

## 下载固件
既然要考虑刷机修复，那么当然要首先准备好新固件啦。这里博主选择了 ImmortalWrt 作为新固件，它是 OpenWrt 的一个分支，相对于 OpenWrt 有更多的优化和功能，但又并不臃肿，保持了基本 OS 的简洁，不像 iStoreOS 之流 bundle 了一堆不必要的软件包。  

前往 [ImmortalWrt 固件选择页](https://firmware-selector.immortalwrt.org/) 搜索 `TP-Link TL-XDR6086`，下载固件。

## 拆卸
### 拆卸外壳
到货之后当然就是拆、拆、拆啦～这里不得不吐槽一下，这种全卡扣式的外壳是真的难拆啊，感觉修复这设备的最难步骤是纯粹体力的拆壳了……总之呢，就是拿几把螺丝刀、镊子什么的翘开外壳，{% blur "然后就收获了坏掉的镊子和弯掉的螺丝刀 	(｀へ´)，" %} 在或多或少的锁扣被破坏的情况下呢，就可以看到 PCB 板和外壳分离啦。  
{% asset_img disassemble-cover.webp "拆卸外壳" %}

### 查找 UART 串口位置
拆开外壳后，我们从正面可以看到 4 个未焊接的直插件焊点，这就是 UART 串口的位置。  
{% asset_img uart-location-front.webp "UART 串口位置（正面）" %} 

从反面看会更清晰一些，可以看到标注了引脚定义的丝印。
{% asset_img uart-location-back.webp "UART 串口位置（反面）" %} 

如果有调试针的话，可以尝试直接连接。考虑到我没有调试针，所以我选择焊接排座。

### 断开天线
为了方便焊接，我们需要把天线从主板上断开，注意这个设备实际上有三种天线，分别是 2.4G、5G 和双频天线，我们需要记录好各自的位置，以免焊接完后连接错了天线。  
{% asset_img antenna.webp "天线" %}

### 焊接 UART 排座
找一个 4 pin 的排座，从主板背面焊接，这样以后就可以直接用杜邦线连接串口转 USB 工具上了。  
{% asset_img solder-uart-before.webp "焊接 UART 排座前" %}

焊接结果如下：
{% asset_img solder-uart-after.webp "焊接 UART 排座后" %}

### 连接天线
焊接完 UART 排座后，把所有的天线按照之前的位置连接回去，就可以准备上电啦！

## 准备 TFTP 服务器
U-Boot 需要通过 TFTP 服务器下载固件，为此我们需要先搭建一个 TFTP 服务器。

在电脑上安装 TFTP 服务器，这里以 Arch Linux 为例：
```bash
pacman -S tftp-hpa
systemctl start tftpd
```

然后复制我们下载好的固件到 `/srv/tftp/` 目录下，并命名为：
- `immortalwrt-mediatek-filogic-tplink_tl-xdr6086-preloader.bin`
- `immortalwrt-mediatek-filogic-tplink_tl-xdr6086-bl31-uboot.fip`
- `immortalwrt-mediatek-filogic-tplink_tl-xdr6086-initramfs-recovery.itb`

## U-Boot 恢复
### 进入 U-Boot 控制台
在 UART 排座上插上杜邦线，连接到串口转 USB 转接器上，然后连接到电脑上，然后先打开串口调试工具。

对于 Linux 用户，我们可以这样查看所有串口：
```bash
ls /dev/tty*
```

确定好我们的 TTY 设备路径后，使用 `screen` 连接串口：
```bash
screen /dev/ttyACM0 115200
```

{% alertpanel info "提示" %}
使用 `Ctrl+A` + `\` 可以在必要时候强制退出 `screen`。
{% endalertpanel %}

然后上电！狂按回车，退出 U-Boot 的自动引导，进入 U-Boot 控制台。

### 准备网络环境
输入 `printenv` 查看当前环境变量，这里有几个关键的环境变量需要关注：
- `ipaddr`：当前设备的 IP 地址
- `serverip`：TFTP 服务器的 IP 地址

这是 U-Boot 自身的 IP 地址和默认的 TFTP 服务器地址，我们可以根据自己的网络环境来修改这两个变量或者直接使用默认值。

对于笔者的环境，默认值为：
```ini
ipaddr=192.168.1.1
serverip=192.168.1.254
```

故而，用一根跳线连接路由器和电脑，在电脑上手动设置 IP 为 `192.168.1.254`，子网前缀长度 `24`（掩码 `255.255.255.0`），然后我们就可以通过 U-Boot 沟通电脑上的 TFTP 服务器了～

### 刷入新 U-Boot 和 Recovery 固件
因为这个设备已经刷了 OpenWRT U-Boot，所以我们只需要使用 `boot_tftp_write_bl2` / `boot_tftp_write_fip` / `boot_tftp_recovery` 等快捷命令即可。（固件需要提前放到 TFTP 服务器上，并命名为特定文件名。至于具体的文件名，则可以使用 `printenv` 查看 `bootfile` 等变量的值来致知）

```bash
run boot_tftp_write_bl2

run boot_tftp_write_fip

setenv noboot 1
setenv replacevol 1
run boot_tftp_recovery

# 重启
reset
```

### 安装新固件
从 `192.168.1.1` 登陆路由器，会提示系统正在恢复模式下运行，此时可以通过 Web 安装固件，上传 `immortalwrt-23.05.3-mediatek-filogic-tplink_tl-xdr6086-squashfs-sysupgrade.itb` 刷机为正式固件。刷机完成后，手动重启。

## 尾声
至此，我们就成功地通过 U-Boot 恢复了无法引导的 OpenWRT 路由器。然后就是一些常规配置，比如设置上游网络和 LAN 口网段、配置无线、设置虚拟组网服务、配置状态统计服务等等啦～

截至本文写作时（2025 年 1 月 26 日），此路由器已经在我的宿舍运行了约 4 个月，稳定性良好，性能也不错，用 300 CNY 买到的这个设备还是超值哒～
