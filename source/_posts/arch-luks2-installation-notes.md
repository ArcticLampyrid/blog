---
title: Arch Linux 安装笔记（LUKS2 + Secure Boot + TPM + PIN）
date: 2024-03-23 18:12:00
updated: 2025-07-27 19:56:00
category: 技术
toc: true
tags:
- Linux
---
## 注意事项
这篇文章不是教程，仅仅用于记录我在安装 Arch Linux 时的一些配置过程，以实现某种意义上的“可重现性”。您不应该直接复制粘贴这里的内容，而应该根据自己的需求和环境进行调整。

由于 Arch Linux 的更新速度较快，安装过程可能会随着时间而变化，所以请注意查看 Arch Wiki 和相关文档以获取最新的信息。

## 一些抉择
- **使用块设备加密**：保护数据不被泄露。
- **不使用任何 Bootloader**：Windows BitLocker 在使用 EFI Chainload 的情况下会拒绝启动，必须直接由 UEFI 固件引导。
- **使用 UKI（统一内核映像） 启动方式**：便于签名并使用 Secure Boot。
- **不加密内核**：内核本身并不具有任何敏感信息，泄露的风险不高。且 Secure Boot 会保证内核完整性。
- **使用独立的 EFI 系统分区**：避免休眠时 EFI 系统分区被另一系统挂载。若在 Linux 下不会挂载任何 Windows 使用的分区，则无需关闭 Windows 的快速启动。

## 准备分区
由于已安装 Windows，为方便起见，我们在 Windows 下使用磁盘管理工具调整分区：
- 新建一个 EFI 系统分区，无需格式化，这里采用了 1 GiB 的大小（请根据实际情况调整）
- 新建一个数据分区，无需格式化，这里采用了 350 GiB 的大小（请根据实际情况调整）

如果磁盘没有未分配空间，则可能还需要缩小现有分区以腾出空间。如果你需要对 NTFS 分区进行无损缩小，可以考虑使用在 Windows 下使用 [傲梅分区助手](https://www.disktool.cn/)，注意调整过程中需要先关闭 BitLocker。对于 ReFS 分区，目前暂时还没有找到无损缩小的方法（如果有的话，欢迎在 Telegram 上 PM 哦），只能备份数据后重建分区。

我这里所创建的 EFI 分区为磁盘 2 的第 4 个分区，数据分区为磁盘 2 的第 5 个分区。在 Linux，将分别被识别为 `/dev/nvme1n1p4` 和 `/dev/nvme1n1p5`。

## 预配置 Windows
考虑到安装 Arch 前本地已有 Windows 系统，为了避免双系统读取 RTC 时间时因为时区不一致导致未知问题，在 Windows 端设置写入到 RTC 的时区为 UTC：
```cmd
reg add "HKEY_LOCAL_MACHINE\System\CurrentControlSet\Control\TimeZoneInformation" /v RealTimeIsUniversal /d 1 /t REG_DWORD /f
```

## 准备安装介质
1. 下载 Arch Linux LiveCD 镜像，官方站：[Arch Linux Downloads](https://archlinux.org/download/)
2. 通过 GPG 验证下载到的镜像来自 Arch Linux 官方（从镜像站下载时，尤其应该进行此步骤）
3. 使用 Rufus 制作 UEFI 启动盘（这里在 Windows 下操作，如果你从其他系统操作，请自行查找相应的工具）

## 安装 Arch Linux
1. 启动到 LiveCD。注意 Live CD 不能使用 Secure Boot 启动，请在安装过程中临时关闭 Secure Boot。
2. 使用 `cat /sys/firmware/efi/fw_platform_size` 验证 UEFI 引导模式，应为 `64`
3. 使用 `ip link` 检查 LiveCD 环境的网络连接
4. 使用 `timedatectl` 从网络上更新时间
5. 检查分区信息
   ```bash
   fdisk -l
   ```
6. 格式化 EFI 分区
   ```bash
   mkfs.vfat -n EFI /dev/nvme1n1p4
   ```
7. 格式化数据分区为 LUKS2 容器，此时请设置一个强密码（后续我们将使用 TPM + PIN 模式简化大部分情况下的密码输入）：
   ```bash
   cryptsetup luksFormat /dev/nvme1n1p5
   cryptsetup open /dev/nvme1n1p5 system
   ```
8. 本文使用的子卷布局如下：
   | 子卷 | 挂载点 | 用途 | 
   | ---- | ------ | ---- |
   | @ | / | 根目录 |
   | @home | /home | 用户数据 |
   | @var_log | /var/log | 日志文件 |
   | @swap | /swap | 交换文件（后面再创建） |

   这样可以使得系统和用户数据分离，允许您将 `@` 恢复到以前的快照，同时保持 `/home` 不变。同时便于为系统和用户数据设置不同的快照策略。
   
   我们先建立除交换子卷以外的 btrfs 及子卷：
   ```bash
   mkfs.btrfs --label system /dev/mapper/system
   mount /dev/mapper/system /mnt
   btrfs subvolume create /mnt/@
   btrfs subvolume create /mnt/@home
   btrfs subvolume create /mnt/@var_log
   ```
9.  挂载文件系统：
    ```bash
    umount -R /mnt
    mount --mkdir -o noatime,subvol=@ /dev/mapper/system /mnt
    mount --mkdir -o noatime,subvol=@home /dev/mapper/system /mnt/home
    mount --mkdir -o noatime,subvol=@var_log /dev/mapper/system /mnt/var/log
    mount --mkdir /dev/nvme1n1p4 /mnt/efi
    ```
10. 安装基本系统：
    ```bash
    pacstrap -K /mnt base linux linux-firmware intel-ucode btrfs-progs
    ```
    如果为 AMD 系列 CPU，可将 `intel-ucode` 替换为 `amd-ucode` 以安装对应的微码
11. 生成 fstab 文件，将现有的挂载配置持久化：
    ```bash
    genfstab -U /mnt >> /mnt/etc/fstab
    ```
    生成后使用 `cat /mnt/etc/fstab` 检查是否正确
12. 切换根：
    ```bash
    arch-chroot /mnt
    ```
    注意：使用 `arch-chroot` 而不是 `chroot`
13. 设置时区：
    ```bash
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
    hwclock --systohc
    ```
    这里设置时区为上海，你可以根据自己的实际情况调整
14. 设置区域（Locale）：  
    1. 编辑 `/etc/locale.gen`
    2. 取消注释 `en_US.UTF-8 UTF-8` 和 `zh_CN.UTF-8 UTF-8`
    3. 生成区域设置：
       ```bash
       locale-gen
       ```
    4. 编辑 `/etc/locale.conf` 写入：  
       ```
       LANG=en_US.UTF-8
       ```
       由于 TTY 无法显示中文，所以全局语言设置为英文，中文环境将在桌面环境中设置。
15. 编辑 `/etc/hostname` 写入主机名
16. 使用 `passwd` 设置 root 密码
17. 安装基础软件：
    ```bash
    pacman -Syu networkmanager base-devel vim sbctl efibootmgr terminus-font
    ```
18. 编辑 `/etc/mkinitcpio.conf` 使用以下 HOOKS：
    ```
    HOOKS=(base systemd autodetect modconf kms keyboard sd-vconsole block sd-encrypt filesystems fsck)
    ```
19. 查看磁盘分区永久名称：执行 `ls -l /dev/disk/by-uuid/` 找到连接到 `/dev/nvme1n1p5` 的 UUID。
20. 配置内核参数 `/etc/kernel/cmdline`：
    ```
    fbcon=nodefer rw rd.luks.allow-discards cryptdevice=/dev/disk/by-uuid/YOUR_DEVICE_UUID:system bgrt_disable root=LABEL=system rootflags=subvol=@,rw splash vt.global_cursor_default=0
    ```
21. 配置启动时解密 `/etc/crypttab.initramfs`：
    ```
    system /dev/disk/by-uuid/YOUR_DEVICE_UUID none timeout=180
    ```
22. 设置 `/etc/vconsole.conf`：
    ```
    KEYMAP=us
    FONT=ter-132b
    ```
23. 通过 sbctl 创建自定义签名：
    ```bash
    sbctl create-keys
    ```
24. 使用 mkinitcpio 生成 UKI（统一内核映像）：
    修改 `/etc/mkinitcpio.d/linux.preset`，注释掉 `default_config` 和 `fallback_config`，取消注释 `default_uki` 和 `fallback_uki`，然后执行：
    ```bash
    mkdir -P /efi/EFI/Linux
    mkinitcpio -P
    ```
25. 添加 EFI 引导项：
    ```bash
    efibootmgr --disk /dev/nvme1n1 --part 4 --create  --label "Arch Linux" --loader "\EFI\Linux\arch-linux.efi"
    ```
26. 退出 chroot 环境：
    ```bash
    exit
    umount -R /mnt
    reboot
    ```
## 配置网络
```bash
systemctl enable NetworkManager
systemctl start NetworkManager
```

## 创建用户
1. 配置用户
   ```bash
   useradd -m alampy
   passwd alampy
   ```
2. 配置 sudo 权限：  
   1. 首先配置用户组
      ```bash
      groupadd sudo
      usermod -aG sudo alampy
      ```
   2. 然后运行编辑配置 `visudo`，取消注释 `%sudo ALL=(ALL:ALL) ALL`

## 配置 Secure Boot
进入 UEFI 设置，重置 Secure Boot 模式为 Setup Mode，进入系统：
```bash
sbctl enroll-keys -mcft
```

| 参数 | 含义                 |
| ---- | -------------------- |
| -m   | 添加微软密钥         |
| -c   | 添加我们的自定义密钥 |
| -f   | 添加固件内置密钥     |
| -t   | 添加 TPM 事件日志    |

重启进入 UEFI 设置，开启 Secure Boot。

## 配置 TPM + PIN 解密模式
```bash
sudo systemd-cryptenroll --wipe-slot tpm2 --tpm2-device auto --tpm2-pcrs 7 --tpm2-with-pin=yes /dev/nvme1n1p5
```

## 配置磁盘自动 Scrub（可选）
Scrub 是 Btrfs 文件系统的一种检查机制，用于检查文件系统的一致性。我们可以配置定时 Scrub 来保证文件系统的健康。

系统默认提供了 `btrfs-scrub@.timer` 模板，可以用于定期检查 Btrfs 文件系统的一致性。我们可以使用此模板来配置自动 Scrub。
```bash
sudo systemctl enable $(systemd-escape --template=btrfs-scrub@.timer --path /)
```

注意：Scrub 对整个文件系统进行检查，而非单个子卷。故而我们只需要对挂载点 `/` 进行配置即可。

## 安装桌面环境
```bash
pacman -S plasma-meta sddm konsole dolphin kwrite ark
systemctl enable sddm
```

| 包名称      | 用途                |
| ----------- | ------------------- |
| plasma-meta | KDE 桌面环境        |
| SDDM        | 会话管理器          |
| konsole     | GUI 终端            |
| dolphin     | 文件管理器          |
| kwrite      | 记事本              |
| ark         | 压缩文件管理工具    |
| okular      | PDF/EPUB 文档查看器 |

## 配置中文输入法
遵循新设置标准：[Support in Wayland Compositor: KDE Plasma](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland#KDE_Plasma)

### 安装输入法
```bash
sudo pacman -S fcitx5-im fcitx5-chinese-addons fcitx5-rime
```

### 修改环境变量
编辑 `/etc/environment`，写入：
```
XMODIFIERS=@im=fcitx
```

不在全局环境变量中设置 `GTK_IM_MODULE` & `QT_IM_MODULE` & `SDL_IM_MODULE`，如遇到无法支持 Wayland IME 的软件，可按需单独设置

### 配置在 X11 下运行的 GTK 应用
向 `~/.gtkrc-2.0` 写入：
```
gtk-im-module="fcitx"
```

向 `~/.config/gtk-3.0/settings.ini` 写入：
```ini
[Settings]
gtk-im-module=fcitx
```

向 `~/.config/gtk-4.0/settings.ini` 写入：
```ini
[Settings]
gtk-im-module=fcitx
```

这些配置不会被 Wayland 下运行的 GTK 应用读取，可以保证 Wayland 应用使用 `text-input-v3` 的同时，X11 应用使用 `fcitx5`。

### 配置输入法
进入 KDE 的虚拟键盘设置，选择 `fcitx5`

### 应用配置
运行 Chromium/Electron 应用时，加入启动参数：
```
--ozone-platform-hint=auto --enable-wayland-ime
```

对于 Electron 应用，可做如下设定：
- 写入到 `~/.config/electron25-flags.conf`：
  ```
  --enable-features=WaylandWindowDecorations
  --ozone-platform-hint=auto
  --enable-wayland-ime
  ```
- 写入到 `~/.config/electron13-flags.conf`：
  ```
  --enable-features=UseOzonePlatform
  --ozone-platform=wayland
  --enable-wayland-ime
  ```

对于 VSCode，写入如下配置到 `~/.config/code-flags.conf`：
```
--enable-features=WaylandWindowDecorations
--ozone-platform-hint=auto
--enable-wayland-ime
```

## 配置自动开启 NumLock
### 早期环境
写入 `/usr/bin/numlock`（并给予执行权限）：
```bash
#!/bin/bash
for tty in /dev/tty[0-9]; do
    /usr/bin/setleds -D +num < "$tty"
done
```

写入 `/usr/lib/initcpio/install/numlock`（并给予执行权限）：
```bash
#!/bin/bash
build() {
    add_binary /bin/bash
    add_binary /usr/bin/setleds
    add_binary /usr/bin/numlock
 
    cat >"$BUILDROOT/usr/lib/systemd/system/numlock.service" <<EOF
[Unit]
Description=Numlock before LUKS
Before=cryptsetup-pre.target
DefaultDependencies=no
[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/numlock
EOF
    add_systemd_unit cryptsetup-pre.target
    cd "$BUILDROOT/usr/lib/systemd/system/sysinit.target.wants" || exit
    ln -sf /usr/lib/systemd/system/cryptsetup-pre.target cryptsetup-pre.target
    ln -sf /usr/lib/systemd/system/numlock.service numlock.service
}
 
help() {
    cat <<HELPEOF
This hook adds support to enable numlock before sd-encrypt hook is run.
HELPEOF
}
```

修改 `/etc/mkinitcpio.conf`，在 HOOKS 中添加 `numlock`（位于 `sd-vconsole` 后）

```bash
mkinitcpio -P
```

这保证了解密过程中 Num Lock 被设置。

### SDDM 环境
编辑 `/etc/sddm.conf`，加入：
```ini
[General]
Numlock=on
```

### KDE 环境
配置 KDE 的 NumLock 设置为开启。

## 配置 SDDM 使用 Wayland 执行
SDDM 提供会话管理和登录界面（注意与锁屏界面区分），默认情况下会使用 X11。为了使用 Wayland，我们需要修改 SDDM 的配置。

对于 KDE 用户，可以向 `/etc/sddm.conf.d/10-wayland.conf` 写入以下内容：
```ini
[General]
DisplayServer=wayland
GreeterEnvironment=QT_WAYLAND_SHELL_INTEGRATION=layer-shell

[Wayland]
CompositorCommand=kwin_wayland --drm --no-lockscreen --no-global-shortcuts --locale1
```

## 配置 Plymouth
Plymouth 是一个启动画面框架，可以用来美化启动过程。

```bash
pacman -S plymouth
```

修改 `/etc/mkinitcpio.conf`，在 HOOKS 中添加 `plymouth`（位于 `systemd` 后），在 FILES 中添加字体（如 `FILES=(/usr/share/fonts/noto/NotoSans-Regular.ttf)` ）


修改 `/etc/plymouth/plymouthd.conf` 配置高分屏缩放：
```ini
[Daemon]
DeviceScale=2
```

重新生成 initramfs：
```bash
mkinitcpio -P
```

## 安装 Paru 作为 AUR Helper
AUR Helper 提供了方便的 AUR 软件包安装方式，这里使用 Paru：
```bash
sudo pacman -S --needed base-devel
git clone https://aur.archlinux.org/paru.git
cd paru
makepkg -si
```

## 安装 NVIDIA 驱动
对于 NV160 及之后系列的显卡，可以选择官方开源驱动：
```bash
pacman -S nvidia-open
```

一些文章（包括 Arch wiki）曾建议在 `/etc/mkinitcpio.conf` 中删除 `kms` hook，以防止 nouveau 被错误加载。实际上 `nvidia-utils` 包已经自带了屏蔽规则来防止 nouveau 被加载，因此不需要手动删除 `kms` hook。对于纯 Nvidia 用户，`kms` hook 几乎没有任何作用。然而对于双显卡用户（如 Intel + Nvidia），`kms` 仍然应该保留，以保证 Intel 显卡在早期阶段被正确加载，这有助于 Plymouth 和其他早期图形应用的正常运行。

{% collapse "若需要启用 early KMS（对于双显卡用户，此种配置易导致 bug，故博主不使用）" %}
若需要使用 early KMS（在内核早期阶段，加载 Nvidia 的驱动并进行 modeset），修改 `/etc/mkinitcpio.conf`，在 MODULES 中添加 `nvidia nvidia_modeset nvidia_uvm nvidia_drm`。

配置 pacman hook，创建如下的 `/etc/pacman.d/hooks/nvidia.hook` 文件，以在每次安装新版本驱动后自动重建 initramfs：
```ini
[Trigger]
Operation=Install
Operation=Upgrade
Operation=Remove
Type=Package
Target=nvidia-open
Target=linux

[Action]
Description=Updating NVIDIA module in initcpio
Depends=mkinitcpio
When=PostTransaction
NeedsTargets
Exec=/bin/sh -c 'while read -r trg; do case $trg in linux*) exit 0; esac; done; /usr/bin/mkinitcpio -P'
```
{% endcollapse %}

编辑 `/etc/kernel/cmdline`，添加内核参数：
```
nvidia_drm.fbdev=1 nvidia_drm.modeset=1
```

重新生成 initramfs：
```bash
mkinitcpio -P
```

## 视频编解码硬件加速
注：若不正确配置硬件加速，可能会导致 HEVC (H.265) 视频无法播放，YouTube、BiliBili 等网站的视频播放卡顿。

### VA-API 支持
VA-API 是一个专用于视频处理硬件加速的 API。

笔者的电脑具有 Intel 核显，安装 `intel-media-driver` 获得 VA-API 支持：
```bash
# 对于 Broadwell (2014) 之前的 Intel 处理器，请改用 libva-intel-driver
pacman -S intel-media-driver
```

AMD 用户可以通过 `mesa` 获得 VA-API 支持，而对于纯 Nvidia **专有驱动**用户，则可以使用 `libva-nvidia-driver` 翻译层翻译到 NVDEC。

在安装完成后，可以通过 `vainfo`（由 `libva-utils` 包提供）命令检查 VA-API 是否正常工作。

### Vulkan 支持
对于 Intel GPU，需要安装 `vulkan-intel`：
```bash
pacman -S vulkan-intel
```

对于 AMD GPU 用户，可以考虑安装 `vulkan-radeon`（或 amdgpu-pro 等闭源实现）。对于 Nvidia GPU，专有驱动中已经包含了 Vulkan 支持，无需额外安装。

### Intel VPL 支持
安装 `libvpl` 和 `vpl-gpu-rt` 以获得 Intel VPL 的加速支持：
```bash
# 对于 Tiger Lake (2020) 之前的 Intel 处理器，请改用 intel-media-sdk 替换 vpl-gpu-rt
pacman -S libvpl vpl-gpu-rt
```

### 应用配置
#### VLC Player
对于 VLC PLayer，建议安装 ffmpeg plugin 以正确获得硬件加速支持：
```bash
pacman -S vlc-plugin-ffmpeg
```

#### GStreamer
安装 `gst-plugin-va` 以获得 VA-API 支持。
```bash
pacman -S gst-plugin-va
```

#### Chromium-based App
对于 Chromium-based 应用（如 Chrome、Edge、Electron 等），笔者测试**需要打开 Vulkan 支持**才能正确使用视频解码硬件加速（注：有在 OpenGL 环境下使用 VA-API 的记录，但笔者未成功复现）：
```bash
# eg. Microsoft Edge Stable
microsoft-edge-stable --enable-features=Vulkan,DefaultANGLEVulkan,VulkanFromANGLE,VaapiIgnoreDriverChecks,VaapiVideoDecoder,VaapiVideoEncoder
```

然而，在笔者电脑上，Vulkan 模式默认将使用 Nvidia 显卡，这导致了以下严重问题（_F\*\*k Nvidia_）：
- 如果同时开启 Wayland 模式，整个界面渲染异常
- 若启用 `VaapiVideoDecoder`，所有视频播放失败，Edge 浏览器在 GPU 进程崩溃多次后回退到纯软件渲染模式

笔者目前的解决方法是设置 `VK_ICD_FILENAMES` 以强制使用 Intel GPU：
```bash
# 使用以下命令查看当前可用的 Vulkan ICD 配置
# ls -al /usr/share/vulkan/icd.d
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/intel_icd.x86_64.json
```

考虑到笔者使用浏览器时不涉及重度图形渲染，因此优先使用 Intel GPU 是合理的。

一切配置完成后，可以使用以下页面测试 HEVC 视频是否可以播放：<https://tests.caniuse.com/?feat=hevc>

### 观察视频加速效果
可以使用 `nvtop` 观察硬件编解码占用率。注意，刚启动 `nvtop` 时可能不会显示 ENC/DEC 这一栏，请稍等一会。

{% alertpanel "info" "备注" %}
尽管 `nvtop` 名字中有 `nv`，但这主要是历史原因，实际上其早就支持监控 Intel、AMD 等各种 GPU 了，效果如下：
{% asset_img nvtop-enc-dec-bar.webp "NVTop Enc/Dec Bar" %}
{% endalertpanel %}

## 安装音频驱动
```bash
pacman -S sof-firmware
```

## 添加 Swap 文件
为了支持休眠及大内存负载应用，我们需要一个 swap 文件。为方便管理、设置快照逻辑，我们将 swap 文件放在单独的子卷中，并挂载到 `/swap`。

首先，运行：
```bash
mkdir -p /mnt
mount /dev/mapper/system /mnt
btrfs sub create /mnt/@swap
umount /mnt
mkdir -p /swap
mount -o compress=no,space_cache,ssd,discard=async,subvol=@swap /dev/mapper/system /swap
btrfs filesystem mkswapfile --size 48g --uuid clear /swap/swapfile
swapon /swap/swapfile
```

编辑 `/etc/fstab`，添加：
```
UUID={your-uuid} /swap btrfs compress=no,space_cache,ssd,discard=async,subvol=/@swap 0 0
/swap/swapfile none swap defaults 0 0
```

## 蓝牙配对
为了使得蓝牙设备在双系统下同时可用，需要提取配对过程中产生的临时密钥并写入到另一系统，请参照：[Bluetooth: Dual boot pairing](https://wiki.archlinux.org/title/Bluetooth#Dual_boot_pairing)

首先，启用蓝牙服务（新系统默认关闭）：
```bash
systemctl enable bluetooth
```

先在 Linux 配对，然后在 Windows 配对，最后提取 Windows 下的密钥并回写到 Linux 系统的 `/var/lib/bluetooth/BT-Adapter-MAC-address/device-MAC-address/info` 文件中。

部分设备的 MAC 会在每次配对后自增，此时，请修改 Linux 侧的文件夹为自增后的MAC。

最后，重启蓝牙服务：
```bash
systemctl restart bluetooth
```

{% alertpanel "info" "备注" %}
~~如果发现蓝牙无法在开机时被自动启用，请检查 `~/.config/bluedevilglobalrc` 文件（参见 [KDE plasma: Bluetooth not automatically powered on at login, try this](https://www.reddit.com/r/ManjaroLinux/comments/12fgj3o/kde_plasma_bluetooth_not_automatically_powered_on/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)）~~

有关蓝牙无法在开机时被自动启用的问题，已提交解决方案（[MR #165](https://invent.kde.org/plasma/bluedevil/-/merge_requests/165)）并被合并到 KDE 6.0.5 及以上版本，故不再需要此 trick。
{% endalertpanel %}


## 指纹识别
安装 `fprintd` 和 `libfprint`，由于本人使用的是 FPC 传感器，`libfprint` 原版还不支持，故从 AUR 安装 `libfprint-fpcmoh-git`（安全警告：这将引入闭源的专有组件）：
```bash
paru -S libfprint-fpcmoh-git
pacman -S fprintd
```

录入指纹：
```bash
fprintd-enroll -f "right-index-finger"
```

为了同时启用密码和指纹认证，安装：
```bash
paru -S pam-fprint-grosshack
```

添加 `auth sufficient pam_fprintd_grosshack.so` 到 `/etc/pam.d/sddm` 和 `/etc/pam.d/sudo` 文件起始位置

## 自动登陆并锁定
写入 `/etc/sddm.conf.d/autologin.conf`：
```ini
[Autologin]
User=alampy
Session=plasma.desktop
```

写入 `~/.config/autostart-scripts/00-auto-lock.sh`：
```bash
#!/bin/sh
/usr/bin/dbus-send --session --type=method_call --dest=org.freedesktop.ScreenSaver /ScreenSaver org.freedesktop.ScreenSaver.Lock &
```

## 配置 Shell
安装并使用 Fish：
```bash
pacman -S fish
chsh $(which fish)
```

## mDNS 服务
> mDNS 是一种零配置网络服务发现协议，允许设备在局域网内自动发现其他设备。常用于 SMB 共享数据集、网络打印机、隔空投送等服务的发现。

如果需要局域网内的设备发现，安装 `avahi` 和 `nss-mdns`：
```bash
pacman -S avahi nss-mdns
systemctl enable avahi-daemon
```

并编辑 `/etc/nsswitch.conf`，在 `hosts` 行添加 `mdns_minimal [NOTFOUND=return]`（在 `resolve` 之前）。
```patch
- hosts: mymachines resolve [!UNAVAIL=return] files myhostname dns
+ hosts: mymachines mdns_minimal [NOTFOUND=return] resolve [!UNAVAIL=return] files myhostname dns
```

之后就可以使用 `.local` 后缀的域名访问局域网内开启了 mDNS 的设备了。
```bash
ping another-device.local
```

## 参考资料
- [LUKS2 YubiKey 全盘加密手稿 by 北雁云依](https://blog.yunyi.beiyan.us/posts/luksNote/)
- [ArchWiki: Installation guide](https://wiki.archlinux.org/title/Installation_guide)
- [ArchWiki: Unified kernel image](https://wiki.archlinux.org/title/Unified_kernel_image)
- [ArchWiki: Snapper](https://wiki.archlinux.org/title/Snapper)
- [\[SOLVED\] Numlock not activating during boot time (systemd-boot)](https://bbs.archlinux.org/viewtopic.php?id=283252)
- [ArchWiki: Kernel mode setting / mkinitcpio](https://wiki.archlinux.org/title/kernel_mode_setting#mkinitcpio)
- [ArchWiki: NVIDIA / Early loading](https://wiki.archlinux.org/title/NVIDIA#Early_loading)
- [ArchWiki: Avahi](https://wiki.archlinux.org/title/Avahi)
- [ArchWiki: SDDM / Wayland](https://wiki.archlinux.org/title/SDDM#Wayland)
- [ArchWiki: Vulkan](https://wiki.archlinux.org/title/Vulkan)
- [ArchWiki: Hardware video acceleration](https://wiki.archlinux.org/title/Hardware_video_acceleration)
- [Using Fcitx 5 on Wayland](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland)
