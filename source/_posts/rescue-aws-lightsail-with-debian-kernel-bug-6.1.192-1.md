---
title: 在 AWS Lightsail 上抢救因 Debian 6.1.192-1 内核 Bug 失联的实例
date: 2026-11-17 23:31:00
updated: 2026-11-17 23:52:00
category: 技术
tags:
- Linux
toc: true
---

## 引
监控显示部署在 AWS Lightsail 的一台 Debian 12 服务器突然失联了，SSH 连不上，服务全部中断。登录 Lightsail 控制台一看，实例状态虽然还标着 `Running`，但健康检查已经报错（Status check failed）。

简单排查了一下近期动态，罪魁祸首很快浮出水面：为了修复 CVE-2026-99288，服务器及时更新到了 `linux-image-6.1.0-55`（对应源码包版本 `6.1.192-1`，[DLA-4906-1](https://security-tracker.debian.org/tracker/DLA-4906-1)）。但该版本的内核在 `ext4` 文件系统的多块分配器（`mballoc`）里引入了一个严重的回归 Bug（[Debian Bug #1154101](https://bugs.debian.org/1154101)：`ext4: NULL folio dereference in mballoc`）。

<!--more-->

由于机器装上了这个有问题的内核。一旦机器重启引导进 `6.1.0-55`，就会掉进一个非常棘手的循环：
- **能开机，但活不过几分钟**：系统引导阶段以读盘为主，通常能顺利走完 `systemd` 启动并拉起 `sshd`；但开机后几十秒到几分钟内，只要日志服务（`journald`）、Docker 容器或后台任务触发满足特定条件的 `ext4` 写入和块分配，内核就会立即触发空指针解引用（Kernel Panic / 死锁），整机直接卡死。
- **没有 VNC / 串行控制台**：偏偏 AWS Lightsail **根本不提供带外 VNC 或串行控制台（Serial Console）**，也没法像标准 EC2 那样直接在网页上把系统盘（Root Volume）卸下来挂到别的机器上修。

换言之，我们面对的是一台没有画面、不能拔系统盘、每次开机最多只能喘气几十秒的僵尸机器。本文记录一下针对这种场景的两种自救思路。

## 方案一：利用“启动存活窗口”热切 GRUB
{% alertbar warning "在进行任何抢修操作前，应该先创建快照，以保证不会越修问题越多。" %}

既然 `6.1.0-55` 是在开机后发生特定 `ext4` 写入时才会死锁，这就意味着在强制重启后、`sshd` 刚被拉起的那几十秒内，其实存在一个短暂的**启动存活窗口**。

同时，在升级内核时通常至少会保留**上一个正在运行的旧内核**（比如我这台机器上的 `6.1.0-54-cloud-amd64`）。只要能在这个窗口期内把默认启动内核切回 `6.1.0-54`，机器就能活过来。

### 踩坑：为什么常规操作在窗口期行不通？
如果趁着机器刚开机连上 SSH，按平时的习惯去修，大概率会踩中下面三个坑：
1. **直接在窗口期跑 `apt update && apt full-upgrade`**：Debian 官方虽然很快发了修复该回归问题的 `6.1.192-2`（`6.1.0-56`，[DLA-4906-2](https://security-tracker.debian.org/tracker/DLA-4906-2)），但你绝对不能顶着 `6.1.0-55` 内核去跑 `apt`。因为 `6.1.0-55` 的死穴就是 `ext4` 块分配，`apt` 下载解压内核包、重新生成 initramfs 会产生大量磁盘写入，几乎必定在升级中途直接触发 Kernel Panic，顺带留下一堆半安装状态（half-installed）的 dpkg 锁。
2. **改完 `/etc/default/grub` 后跑 `update-grub`**：`update-grub`（即 `grub-mkconfig`）会扫描所有磁盘并调用一堆探测脚本重新生成配置，耗时好几秒且伴随写盘。在随时会挂的窗口期，动作越慢、写盘越多，暴毙概率越高。
3. **用 `sudo reboot` 或控制台的 `Reboot` 重启**：常规软重启会让 `systemd` 依次停止服务并执行文件系统刷盘（sync/unmount）。这波关机刷盘正好一脚踩在 `ext4` 的雷上，结果就是机器直接死锁在关机阶段，怎么等都起不来。

### 一步到位：绕过 `update-grub` 直接改写 `grub.cfg`
在 GRUB 2 的机制中，`/etc/default/grub` 只是供 `update-grub` 渲染的模板，Bootloader 开机时真正读取的只有 `/boot/grub/grub.cfg`。

看看 `/boot/grub/grub.cfg` 开头控制默认启动项的逻辑：
```grub
if [ "${next_entry}" ] ; then
   set default="${next_entry}"
   set next_entry=
   save_env next_entry
   set boot_once=true
else
   set default="0"
fi
```
既然 `/boot/grub/grub.cfg` 本身只是个几 KB 的纯文本文件，在紧急救援时，我们完全可以**跳过 `update-grub`，直接用 `sed` 原地把 `set default="0"` 改成旧内核的菜单路径**。这样修改耗时不到 10 毫秒，只写一两个 4KB 的磁盘块，改完立刻 `sync` 并通过 SysRq 触发内核级硬重启。

### 抢占操作流程
首先在 Lightsail 控制台点击 **Stop**。由于内核已经死锁，常规停止会一直卡在 Stopping，此时可以强制停止，待状态变为 `Stopped` 后点击 **Start**。

点下 Start 的同时，在本地终端挂起下面这段循环脚本抢占 SSH 窗口：
```bash
until ssh -o ConnectTimeout=5 -o ConnectionAttempts=1 -o BatchMode=yes YOUR_SERVER bash -s 2>&1 <<'REMOTE' | tee /dev/stderr | grep -q '^\[+\] done'; do
set -e
BAD=$(uname -r)   # 刚开机跑的就是坏内核，直接排除它
echo "[*] 已连接，当前内核: $BAD"

# 1. 提取 Advanced options 子菜单 ID（ID 以 gnulinux-advanced- 开头），以及子菜单内第一个非当前内核、非 recovery 的 menuentry ID
SUB=$(sudo awk -F"'" '/^[[:space:]]*submenu / && $(NF-1) ~ /^gnulinux-advanced-/ {print $(NF-1); exit}' /boot/grub/grub.cfg)
TARGET=$(sudo awk -F"'" -v bad="$BAD" '
  /^[[:space:]]*submenu / && $(NF-1) ~ /^gnulinux-advanced-/ {s=1; next}
  s && /^[[:space:]]*menuentry / && /with Linux / && !/recovery/ && index($0, "with Linux " bad "\x27")==0 {print $(NF-1); exit}
' /boot/grub/grub.cfg)
[ -n "$SUB" ] && [ -n "$TARGET" ] || { echo "[!] 未找到可用的旧内核菜单项"; exit 1; }
echo "[*] 切换默认启动项至: $SUB>$TARGET"

# 2. 直接改 grub.cfg（不跑 update-grub），刷盘，打印完成标记，再用 SysRq 硬重启
sudo sed -i "s/^[[:space:]]*set default=.*/   set default=\"$SUB>$TARGET\"/" /boot/grub/grub.cfg
sudo sync
echo "[+] done"
echo b | sudo tee /proc/sysrq-trigger >/dev/null 2>&1 || true
REMOTE
  sleep 1
done
```

这里最后一句 `echo b | sudo tee /proc/sysrq-trigger` 相当于直接按主板物理 Reset 键，在 `sync` 保证 `grub.cfg` 落盘后直接重置 CPU，不给任何用户态进程在关机时写盘引爆 Bug 的机会。

### 收尾：升级 `6.1.0-56` 并清理坏内核
硬重启后等二三十秒，再连上去看 `uname -r`，机器已经稳稳地跑在旧内核 `6.1.0-54-cloud-amd64` 上了。现在文件操作不再有崩溃风险，可以正常走 `apt` 升级修复版内核并清理现场：
```bash
# 升级至修复了 Bug #1154101 的 6.1.192-2 (linux-image-6.1.0-56-cloud-amd64)
sudo apt-get update
sudo DEBIAN_FRONTEND=noninteractive apt-get full-upgrade -y

# 彻底卸载 6.1.0-55
sudo DEBIAN_FRONTEND=noninteractive apt-get purge -y linux-image-6.1.0-55-cloud-amd64

# 重启进入新内核
sudo systemctl reboot
```
值得一提的是，刚才我们只用 `sed` 临时改了 `/boot/grub/grub.cfg` 而没动 `/etc/default/grub`，当上面执行 `apt-get purge` 自动触发 `update-grub` 重新生成 `grub.cfg` 时，默认启动项会自动还原为 `set default="0"`（即指向刚装好的 `6.1.0-56`），同时保留 `6.1.0-54` 作为备用，连手动还原 GRUB 配置的步骤都省了。

## 方案二：如果彻底进不去 SSH 怎么办？
上面的方案一有一个前提：系统至少还能撑到 `sshd` 启动，并且 `/boot` 下确实留着旧内核。

如果遇到更极端的情况——比如旧内核之前被手动清理光了、或者某次更新把 `initramfs` / GRUB 彻底搞坏导致开机直接 Panic，连 1 秒钟的 SSH 窗口都没有，在 Lightsail 上又该如何处理？

### Lightsail 的两个平台限制
如果去搜 AWS 文档，通常能看到两种和快照相关的功能，但实际用起来都有坑：
1. **导出到 EC2（Export to Amazon EC2）是单向的**：Lightsail 支持把实例快照导出为 EC2 的 AMI 和 EBS 卷（[官方文档](https://lightsail.aws.amazon.com/ls/docs/en_us/articles/amazon-lightsail-exporting-snapshots-to-amazon-ec2)）。导出后确实可以在 EC2 里把 EBS 卷挂到别的机器上修好，但 **AWS 不支持把 EC2 的 AMI 或卷导回 Lightsail**。一旦走这条路，你就只能放弃 Lightsail 便宜的套餐包，留在 EC2 上按量付费运行了。
2. **系统盘块存储快照只能变数据盘，不能变回系统盘**：AWS CLI 提供了一个网页控制台上没有的功能，可以把某个实例的**系统盘（Root Volume）** 单独打成块存储快照（Disk Snapshot），再从这个快照创建一块附加数据盘（Block Storage Disk）挂到其他 Lightsail 实例上（[官方文档](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-create-an-instance-root-volume-snapshot.html)）。但注意， Lightsail 里 `Disk Snapshot` 只能拿来建附加数据盘，**既不能直接用来创建新实例，也不能挂回原实例替掉损坏的系统盘**。

### 曲线救国：CLI 提取系统盘 + 新实例 `chroot` 修复 + 覆写克隆
既然没办法把修好的附加数据盘直接变回系统盘，但我们又想留在 Lightsail，唯一的办法就是“借壳上市”：把坏实例的系统盘通过 CLI 提取成附加数据盘，挂载到一台同规格的新 Lightsail 实例上修好，然后**直接把修好的附加盘数据覆写回新实例自己的系统盘**。

大致思路如下：
1. 用 AWS CLI 提取坏实例的系统盘为数据盘快照
2. 开一台同规格新实例并挂载该盘
3. 挂载并 `chroot` 修复原系统
4. 将修好的系统克隆回新实例的系统盘，可能是通过 dd 或者 rsync。注意同步过程应该在一个纯内存的临时环境中进行，类似 reinstall 脚本的原理。
5. 切换静态 IP 到新实例上面

## 尾声
总的来说，只要能够撑到 `sshd` 启动，**方案一（利用“启动存活窗口”热切 GRUB）** 绝对是最省时省力的解法，一两分钟就能无损救回；而万一真的遇到彻底无法引导的死局，就只能利用 `aws lightsail create-disk-snapshot` 把系统盘抽出来挂到新实例上修复、运行了。

## 致谢
本次修复和本文编写过程广泛采用了 AI，主要使用了 Gemini 4 Argon 和 GPT 6.1 Sol 模型，特此感谢。
