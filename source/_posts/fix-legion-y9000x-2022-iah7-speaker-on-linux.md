---
title: 修复 Legion Y9000X 2022 IAH7 内置扬声器在 Linux 下无声音的问题
date: 2024-04-13 00:01:55
updated: 2024-04-18 15:15:33
category: 技术
toc: true
---

对于拯救者 Y9000X 2022 用户，在安装 `sof-firmware` 后，尽管内置麦克风工作正常，但无法通过内置扬声器播放声音。本文尝试简单修补 Linux 内核，以避免残缺 ACPI 表带来的参数缺失，正确驱动 CS35L4L 音频放大器。
<!--more-->

本文假定您使用 Arch Linux 和 linux-v6.8.5-arch1 内核，尽管您可以参考其过程 backport 到其它内核版本/发行版。

## 免责声明
由于作者并不了解 Linux 内核开发，纯粹是拿起生疏的工具尝试自食其力地解决问题，故难以保证本文方法的正确性和优雅性。  
同时请在尝试本文方法前做好数据备份工作并准备好 Live CD，以防止发生数据损坏、无法启动等问题。  
此外，错误的驱动配置可能损坏您的硬件，故请谨慎操作。如出现意外情况将由您自行承担相关损失，与作者无关。

## 检查错误
查看 CS35L4L 相关信息:
```bash
journalctl -b -g 'csc|cs35l41' --case-sensitive=false --output short-monotonic
```

发现 CS35L4L 驱动加载失败:
```
Serial bus multi instantiate pseudo device driver CSC3551:00: Instantiated 2 I2C devices.
cs35l41-hda i2c-CSC3551:00-cs35l41-hda.0: Failed property cirrus,dev-index: -22
cs35l41-hda i2c-CSC3551:00-cs35l41-hda.0: error -EINVAL: Platform not supported
cs35l41-hda: probe of i2c-CSC3551:00-cs35l41-hda.0 failed with error -22
cs35l41-hda i2c-CSC3551:00-cs35l41-hda.1: Failed property cirrus,dev-index: -22
cs35l41-hda i2c-CSC3551:00-cs35l41-hda.1: error -EINVAL: Platform not supported
cs35l41-hda: probe of i2c-CSC3551:00-cs35l41-hda.1 failed with error -22
```

CS35L4L 在 Linux 下具有驱动，但由于某些厂商并没有在 ACPI Table 中正确地描述音频设备，而是在其 Windows 的驱动中硬编码某些配置项（坏文明！），导致 Linux 下无法正确识别音频设备。

这里需要修改内核源码，以硬编码拯救者的音频设备信息。由于大量厂商的设备存在类似问题，内核树中已存在对 CS35L4L 参数硬编码的良好支持，只需要添加一条记录即可。

## 修补问题
### 查找 Subsystem ID
查看 ACPI Table:
```bash
# sudo pacman -S acpica
sudo cat /sys/firmware/acpi/tables/DSDT > dsdt.dat
iasl -d dsdt.dat
less dsdt.dsl
```

使用 `/CSC3551<Enter>` 搜索，可以找到相关信息:
```
Name (_HID, "CSC3551")  // _HID: Hardware ID
Name (_SUB, "17AA386E")  // _SUB: Subsystem ID
```

即我们需要处理的设备 Subsystem ID 为 `17AA386E`

### 制作 Patch (v1)
从 https://github.com/archlinux/linux/tree/v6.8.5-arch1 查看内核源码，修改相关文件。

#### 修改 `sound/pci/hda/patch_realtek.c`
和大部分机型不同，Y9000X 2022 IAH7 的两个放大芯片的中断 IRQ 相同，且中断引脚通过 APIC 连接。为了避免以下错误，不直接使用 `generic_dsd_config`
> genirq: Flags mismatch irq 58. 00002088 (cs35l41 IRQ1 Controller) vs. 00002088 (cs35l41 IRQ1 Controller)

作为 workaround，我们自己写一个配置函数，关闭第二个放大器的中断功能：
```c
static int single_interrupt_dsd_config(struct cs35l41_hda *cs35l41, struct device *physdev, int id, const char *hid)
{
  generic_dsd_config(cs35l41, physdev, id, hid);
  if (id != 0x40) {
    cs35l41->hw_cfg.gpio2.func = CS35L41_NOT_USED;
  }
  return 0;
}
```

添加到配置模型表：
```c
// array cs35l41_prop_model_table
{ "CSC3551", "17AA386E", single_interrupt_dsd_config }
```

并配置引脚信息和输出模式：
```c
// array cs35l41_config_table
{ "17AA386E", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 }
```

#### 修改 `sound/pci/hda/patch_realtek.c`
添加 `SND_PCI_QUIRK`：
```c
// array alc269_fixup_tbl
SND_PCI_QUIRK(0x17aa, 0x386e, "Legion Y9000X 2022 IAH7", ALC287_FIXUP_CS35L41_I2C_2)
```

#### 生成补丁文件 `sound_17aa386e_fix.patch`
```bash
# i：修改前的源码，w：修改后的源码
git diff --no-index i/ w/ --no-prefix > sound_17aa386e_fix.patch
```

{% collapse "sound_17aa386e_fix.patch" %}
```diff
diff --git i/sound/pci/hda/cs35l41_hda_property.c w/sound/pci/hda/cs35l41_hda_property.c
index 4d1f873..e9f721b 100644
--- i/sound/pci/hda/cs35l41_hda_property.c
+++ w/sound/pci/hda/cs35l41_hda_property.c
@@ -98,6 +98,7 @@ static const struct cs35l41_config cs35l41_config_table[] = {
 	{ "10431F1F", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, -1, 0, 0, 0, 0 },
 	{ "10431F62", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, 2, 0, 0, 0, 0 },
 	{ "10433A60", 2, INTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, 2, 0, 1000, 4500, 24 },
+	{ "17AA386E", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
 	{ "17AA386F", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, -1, -1, 0, 0, 0 },
 	{ "17AA3877", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
 	{ "17AA3878", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
@@ -367,6 +368,16 @@ static int lenovo_legion_no_acpi(struct cs35l41_hda *cs35l41, struct device *phy
 	return 0;
 }
 
+static int single_interrupt_dsd_config(struct cs35l41_hda *cs35l41, struct device *physdev, int id,
+												 const char *hid)
+{
+	generic_dsd_config(cs35l41, physdev, id, hid);
+	if (id != 0x40) {
+		cs35l41->hw_cfg.gpio2.func = CS35L41_NOT_USED;
+	}
+	return 0;
+}
+
 struct cs35l41_prop_model {
 	const char *hid;
 	const char *ssid;
@@ -438,6 +449,7 @@ static const struct cs35l41_prop_model cs35l41_prop_model_table[] = {
 	{ "CSC3551", "10431F1F", generic_dsd_config },
 	{ "CSC3551", "10431F62", generic_dsd_config },
 	{ "CSC3551", "10433A60", generic_dsd_config },
+	{ "CSC3551", "17AA386E", single_interrupt_dsd_config },
 	{ "CSC3551", "17AA386F", generic_dsd_config },
 	{ "CSC3551", "17AA3877", generic_dsd_config },
 	{ "CSC3551", "17AA3878", generic_dsd_config },
diff --git i/sound/pci/hda/patch_realtek.c w/sound/pci/hda/patch_realtek.c
index f4a02bf..bac3161 100644
--- i/sound/pci/hda/patch_realtek.c
+++ w/sound/pci/hda/patch_realtek.c
@@ -10359,6 +10359,7 @@ static const struct snd_pci_quirk alc269_fixup_tbl[] = {
 	SND_PCI_QUIRK(0x17aa, 0x3853, "Lenovo Yoga 7 15ITL5", ALC287_FIXUP_YOGA7_14ITL_SPEAKERS),
 	SND_PCI_QUIRK(0x17aa, 0x3855, "Legion 7 16ITHG6", ALC287_FIXUP_LEGION_16ITHG6),
 	SND_PCI_QUIRK(0x17aa, 0x3869, "Lenovo Yoga7 14IAL7", ALC287_FIXUP_YOGA9_14IAP7_BASS_SPK_PIN),
+	SND_PCI_QUIRK(0x17aa, 0x386e, "Legion Y9000X 2022 IAH7", ALC287_FIXUP_CS35L41_I2C_2),
 	SND_PCI_QUIRK(0x17aa, 0x386f, "Legion 7i 16IAX7", ALC287_FIXUP_CS35L41_I2C_2),
 	SND_PCI_QUIRK(0x17aa, 0x3870, "Lenovo Yoga 7 14ARB7", ALC287_FIXUP_YOGA7_14ARB7_I2C),
 	SND_PCI_QUIRK(0x17aa, 0x3877, "Lenovo Legion 7 Slim 16ARHA7", ALC287_FIXUP_CS35L41_I2C_2),
```
{% endcollapse %}

### 制作 Patch (v2)
#### 问题分析
上述方法直接关闭了第二个放大器的中断功能，这可能导致某些状态下无法自动重新初始化放大器。

关注错误：
> genirq: Flags mismatch irq 58. 00002088 (cs35l41 IRQ1 Controller) vs. 00002088 (cs35l41 IRQ1 Controller)

这非常令人困惑，因为日志给出的两个 Flags 是相同的。

进一步调查显示，错误由 `__setup_irq` 函数中的以下检查引发：

```c
if (irqd_trigger_type_was_set(&desc->irq_data)) {
    oldtype = irqd_get_trigger_type(&desc->irq_data);
} else {
    oldtype = new->flags & IRQF_TRIGGER_MASK;
    irqd_set_trigger_type(&desc->irq_data, oldtype);
}

if (!((old->flags & new->flags) & IRQF_SHARED) ||
    (oldtype != (new->flags & IRQF_TRIGGER_MASK)))
    goto mismatch;
```

可以看到，检查使用的 `oldtype` 实际上是通过 `irqd_get_trigger_type` 获取的。
虽然所有的中断都是用标志位 `0x00002088 = IRQF_ONESHOT | IRQF_SHARED | IRQF_TRIGGER_LOW` 请求的。
但这里获取到的 `oldtype` 是 `IRQF_TRIGGER_RISING (0x1)`（遵从了 DSDT 表中的配置） 而非 `IRQF_TRIGGER_LOW (0x8)`，导致了错误。

由于我们的中断脚是连接到 APIC 的，关注 `platform_get_irq_optional`：
```c
if (r && r->flags & IORESOURCE_BITS) {
	struct irq_data *irqd;

	irqd = irq_get_irq_data(r->start);
	if (!irqd)
		goto out_not_found;
	irqd_set_trigger_type(irqd, r->flags & IORESOURCE_BITS);
}
```

可以看到 DSDT 表中的信息将用于配置 trigger type。

#### 问题解决
修改 `sound/pci/hda/cs35l41_hda.c`，在请求中断时尊重已有的中断配置：
```diff
 	irq_pol = cs35l41_gpio_config(cs35l41->regmap, hw_cfg);
 
 	if (cs35l41->irq && using_irq) {
+		struct irq_data *irq_data;
+
+		irq_data = irq_get_irq_data(cs35l41->irq);
+		if (irq_data && irqd_trigger_type_was_set(irq_data)) {
+			irq_pol = irqd_get_trigger_type(irq_data);
+			dev_info(cs35l41->dev, "Using configured IRQ Polarity: %d\n", irq_pol);
+		}
+
 		ret = devm_regmap_add_irq_chip(cs35l41->dev, cs35l41->regmap, cs35l41->irq,
 					       IRQF_ONESHOT | IRQF_SHARED | irq_pol,
 					       0, &cs35l41_regmap_irq_chip, &cs35l41->irq_data);
```

之后我们就可以使用 `generic_dsd_config` 完成配置了。

#### 补丁文件 `sound_17aa386e_fix.patch`
{% collapse "sound_17aa386e_fix.patch" %}
```diff
diff --git a/sound/pci/hda/cs35l41_hda.c b/sound/pci/hda/cs35l41_hda.c
index d3fa6e136744..d9c7b4034684 100644
--- a/sound/pci/hda/cs35l41_hda.c
+++ b/sound/pci/hda/cs35l41_hda.c
@@ -10,6 +10,7 @@
 #include <linux/module.h>
 #include <linux/moduleparam.h>
 #include <sound/hda_codec.h>
+#include <linux/irq.h>
 #include <sound/soc.h>
 #include <linux/pm_runtime.h>
 #include <linux/spi/spi.h>
@@ -1511,6 +1512,14 @@ static int cs35l41_hda_apply_properties(struct cs35l41_hda *cs35l41)
 	irq_pol = cs35l41_gpio_config(cs35l41->regmap, hw_cfg);
 
 	if (cs35l41->irq && using_irq) {
+		struct irq_data *irq_data;
+
+		irq_data = irq_get_irq_data(cs35l41->irq);
+		if (irq_data && irqd_trigger_type_was_set(irq_data)) {
+			irq_pol = irqd_get_trigger_type(irq_data);
+			dev_info(cs35l41->dev, "Using configured IRQ Polarity: %d\n", irq_pol);
+		}
+
 		ret = devm_regmap_add_irq_chip(cs35l41->dev, cs35l41->regmap, cs35l41->irq,
 					       IRQF_ONESHOT | IRQF_SHARED | irq_pol,
 					       0, &cs35l41_regmap_irq_chip, &cs35l41->irq_data);
diff --git a/sound/pci/hda/cs35l41_hda_property.c b/sound/pci/hda/cs35l41_hda_property.c
index 8fb688e41414..60ad2344488b 100644
--- a/sound/pci/hda/cs35l41_hda_property.c
+++ b/sound/pci/hda/cs35l41_hda_property.c
@@ -109,6 +109,7 @@ static const struct cs35l41_config cs35l41_config_table[] = {
 	{ "10431F1F", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, -1, 0, 0, 0, 0 },
 	{ "10431F62", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, 2, 0, 0, 0, 0 },
 	{ "10433A60", 2, INTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 1, 2, 0, 1000, 4500, 24 },
+	{ "17AA386E", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
 	{ "17AA386F", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, -1, -1, 0, 0, 0 },
 	{ "17AA3877", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
 	{ "17AA3878", 2, EXTERNAL, { CS35L41_LEFT, CS35L41_RIGHT, 0, 0 }, 0, 1, -1, 0, 0, 0 },
@@ -500,6 +501,7 @@ static const struct cs35l41_prop_model cs35l41_prop_model_table[] = {
 	{ "CSC3551", "10431F1F", generic_dsd_config },
 	{ "CSC3551", "10431F62", generic_dsd_config },
 	{ "CSC3551", "10433A60", generic_dsd_config },
+	{ "CSC3551", "17AA386E", generic_dsd_config },
 	{ "CSC3551", "17AA386F", generic_dsd_config },
 	{ "CSC3551", "17AA3877", generic_dsd_config },
 	{ "CSC3551", "17AA3878", generic_dsd_config },
diff --git a/sound/pci/hda/patch_realtek.c b/sound/pci/hda/patch_realtek.c
index cdcb28aa9d7b..ac729187f6a7 100644
--- a/sound/pci/hda/patch_realtek.c
+++ b/sound/pci/hda/patch_realtek.c
@@ -10382,6 +10382,7 @@ static const struct snd_pci_quirk alc269_fixup_tbl[] = {
 	SND_PCI_QUIRK(0x17aa, 0x3853, "Lenovo Yoga 7 15ITL5", ALC287_FIXUP_YOGA7_14ITL_SPEAKERS),
 	SND_PCI_QUIRK(0x17aa, 0x3855, "Legion 7 16ITHG6", ALC287_FIXUP_LEGION_16ITHG6),
 	SND_PCI_QUIRK(0x17aa, 0x3869, "Lenovo Yoga7 14IAL7", ALC287_FIXUP_YOGA9_14IAP7_BASS_SPK_PIN),
+	SND_PCI_QUIRK(0x17aa, 0x386e, "Legion Y9000X 2022 IAH7", ALC287_FIXUP_CS35L41_I2C_2),
 	SND_PCI_QUIRK(0x17aa, 0x386f, "Legion 7i 16IAX7", ALC287_FIXUP_CS35L41_I2C_2),
 	SND_PCI_QUIRK(0x17aa, 0x3870, "Lenovo Yoga 7 14ARB7", ALC287_FIXUP_YOGA7_14ARB7_I2C),
 	SND_PCI_QUIRK(0x17aa, 0x3877, "Lenovo Legion 7 Slim 16ARHA7", ALC287_FIXUP_CS35L41_I2C_2),
```
{% endcollapse %}

### 构建内核
克隆 Arch Linux 内核包构建文件:
```bash
git clone https://gitlab.archlinux.org/archlinux/packaging/packages/linux
git checkout 6.8.5.arch1-1
```

修改 `PKGBUILD`, 添加 `sound_17aa386e_fix.patch` 到 `source` 数组:

```diff
source=(
  https://cdn.kernel.org/pub/linux/kernel/v${pkgver%%.*}.x/${_srcname}.tar.{xz,sign}
  $url/releases/download/$_srctag/linux-$_srctag.patch.zst{,.sig}
  config  # the main kernel config file
  docutils.patch  # fix the docs build
+ sound_17aa386e_fix.patch
)
```

同时添加 `SKIP` 到 `sha256sums` 和 `b2sums` 数组，以跳过校验。

`linux` 包本身存在批量应用 patch 的功能，故**无需修改** `prepare()` 函数
```bash
local src
for src in "${source[@]}"; do
    src="${src%%::*}"
    src="${src##*/}"
    src="${src%.zst}"
    [[ $src = *.patch ]] || continue
    echo "Applying patch $src..."
    patch -Np1 < "../$src"
done
```

构建包:
```bash
# 很慢，坐和放宽（sit back and relax）
makepkg -s
```

### 安装内核
```bash
sudo pacman -U linux-6.8.5.arch1-1-x86_64.pkg.tar.zst
```

### 重启
```bash
sudo reboot
```

## 注意事项
推荐提前设置好 `~/.config/pacman/makepkg.conf` 文件，以加速构建过程，例如:
```bash
MAKEFLAGS="-j$(nproc)"
```

内核编译需要占用大量空间，请提前检查 `BUILDDIR` 空间是否足够。

## 参考资料
- https://bugs.launchpad.net/ubuntu/+source/alsa-driver/+bug/1984157
- https://wiki.archlinux.org/title/DSDT
- https://yadom.in/archives/asus-notebook-cirrus-amp-in-linux-fix.html
- https://lore.kernel.org/lkml/SY4P282MB18359DB2390AEFED26AC53A0E037A@SY4P282MB1835.AUSP282.PROD.OUTLOOK.COM/

## 另记
又通宵了一个晚上（虽然是因为我菜，对内核不了解🥹），困死了。果然晚上不适合开始任何非劳力型的工作。

{% alertbox info "正在试图将该补丁提交到 Linux Kernel 主线，相关讨论见：
- https://lore.kernel.org/lkml/TYCP286MB25352F3E995FED9CCE90F1F6C40B2@TYCP286MB2535.JPNP286.PROD.OUTLOOK.COM/T/
- https://lore.kernel.org/lkml/TYCP286MB253523D85F6E0ECAA3E03D58C40E2@TYCP286MB2535.JPNP286.PROD.OUTLOOK.COM/T/"
" %}
