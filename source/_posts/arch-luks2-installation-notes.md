---
title: Arch Linux 安装笔记（LUKS2 + Secure Boot + TPM + PIN）
date: 2024-03-23 18:12:00
updated: 2024-05-07 12:33:00
category: 技术
toc: true
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
9. 建立 btrfs 及子卷：
   ```bash
   mkfs.btrfs --label system /dev/mapper/system
   mount /dev/mapper/system /mnt
   btrfs subvolume create /mnt/@root
   btrfs subvolume create /mnt/@home
   btrfs subvolume create /mnt/@var
   umount -R /mnt
   ```
10. 挂载文件系统：
    ```bash
    umount -R /mnt
    mount --mkdir -o noatime,subvol=@root /dev/mapper/system /mnt
    mount --mkdir -o noatime,subvol=@home /dev/mapper/system /mnt/home
    mount --mkdir -o noatime,subvol=@var /dev/mapper/system /mnt/var
    mount --mkdir /dev/nvme1n1p4 /mnt/efi
    ```
11. 安装基本系统：
    ```bash
    pacstrap -K /mnt base linux linux-firmware intel-ucode btrfs-progs
    ```
    如果为 AMD 系列 CPU，可将 `intel-ucode` 替换为 `amd-ucode` 以安装对应的微码
12. 生成 fstab 文件，将现有的挂载配置持久化：
    ```bash
    genfstab -U /mnt >> /mnt/etc/fstab
    ```
    生成后使用 `cat /mnt/etc/fstab` 检查是否正确
13. 切换根：
    ```bash
    arch-chroot /mnt
    ```
    注意：使用 `arch-chroot` 而不是 `chroot`
14. 设置时区：
    ```bash
    ln -sf /usr/share/zoneinfo/Asia/Shanghai /etc/localtime
    hwclock --systohc
    ```
    这里设置时区为上海，你可以根据自己的实际情况调整
15. 设置区域（Locale）：  
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
16. 编辑 `/etc/hostname` 写入主机名
17. 使用 `passwd` 设置 root 密码
18. 安装基础软件：
    ```bash
    pacman -Syu networkmanager base-devel vim sbctl efibootmgr terminus-font
    ```
19. 编辑 `/etc/mkinitcpio.conf` 使用以下 HOOKS：
    ```
    HOOKS=(base systemd autodetect modconf kms keyboard sd-vconsole block sd-encrypt filesystems fsck)
    ```
20. 查看磁盘分区永久名称：执行 `ls -l /dev/disk/by-uuid/` 找到连接到 `/dev/nvme1n1p5` 的 UUID。
20. 配置内核参数 `/etc/kernel/cmdline`：
    ```
    fbcon=nodefer rw rd.luks.allow-discards cryptdevice=/dev/disk/by-uuid/YOUR_DEVICE_UUID:system bgrt_disable root=LABEL=system rootflags=subvol=@root,rw splash vt.global_cursor_default=0
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
23. 通过 sbctl 创建自定义签名并生成 UKI（统一内核映像）：
    ```bash
    sbctl create-keys
    sbctl bundle -i /boot/intel-ucode.img -s /efi/main.efi
    mkinitcpio -P
    ```
24. 添加 EFI 引导项：
    ```bash
    efibootmgr --disk /dev/nvme1n1 --part 4 --create  --label "Arch Linux" --loader main.efi
    ```
25. 退出 chroot 环境：
    ```bash
    exit
    umount -R /mnt
    reboot
    ```
## 配置网络
```
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
```
[Settings]
gtk-im-module=fcitx
```

向 `~/.config/gtk-4.0/settings.ini` 写入：
```
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

对于 Electron 应用，可配置以下全局设定：
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
参照 [https://bbs.archlinux.org/viewtopic.php?id=283252](https://bbs.archlinux.org/viewtopic.php?id=283252)。

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
```
[General]
Numlock=on
```

### KDE 环境
配置 KDE 的 NumLock 设置为开启。

## 配置 Plymouth
Plymouth 是一个启动画面框架，可以用来美化启动过程。

```bash
pacman -S plymouth
```

修改 `/etc/mkinitcpio.conf`，在 HOOKS 中添加 `plymouth`（位于 `systemd` 后），在 FILES 中添加字体（如 `FILES=(/usr/share/fonts/noto/NotoSans-Regular.ttf)` ）


修改 `/etc/plymouth/plymouthd.conf` 配置高分屏缩放：
```
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

~~修改 `/etc/mkinitcpio.conf`，在 HOOKS 中删除 `kms`。~~

为了保证 plymouth 的显示不出现缩放失败、字体过小等问题，需要使用 early KMS。因此，在 `/etc/mkinitcpio.conf` 的 HOOKS 中保留 `kms` ，并在 MODULES 中添加 `nvidia nvidia_modeset nvidia_uvm nvidia_drm`。  
（参见 [ArchWiki: Kernel mode setting / mkinitcpio](https://wiki.archlinux.org/title/kernel_mode_setting#mkinitcpio) 和 [ArchWiki: NVIDIA / Early loading](https://wiki.archlinux.org/title/NVIDIA#Early_loading)）

配置 pacman hook，创建如下的 `/etc/pacman.d/hooks/nvidia.hook` 文件，以在每次安装新版本驱动后自动重建 initramfs：
```conf
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

编辑 `/etc/kernel/cmdline`，添加内核参数：
```
nvidia_drm.fbdev=1 nvidia_drm.modeset=1
```

重新生成 initramfs：
```bash
mkinitcpio -P
```

## 安装音频驱动
```bash
pacman -S sof-firmware
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

备注：
如果发现蓝牙无法在开机时被自动启用，请检查 `~/.config/bluedevilglobalrc` 文件（参见 [KDE plasma: Bluetooth not automatically powered on at login, try this](https://www.reddit.com/r/ManjaroLinux/comments/12fgj3o/kde_plasma_bluetooth_not_automatically_powered_on/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button)）


## 指纹识别
安装 `fprintd` 和 `libfprint`，由于本人使用的是 FPC 传感器，`libfprint` 原版还不支持，故从 AUR 安装 `libfprint-fpcmoh-git`：
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
