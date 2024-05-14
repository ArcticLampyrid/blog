---
title: 使用 DKMS 来 Patch Linux 内核模块
date: 2024-04-19 01:45:32
updated: 2024-05-05 16:03:31
category: 技术
toc: true
tags:
- Linux
---
## 缘起
为了便于调教某些代码，前阵子咱投入了 [Arch Linux 娘](https://zh.moegirl.org.cn/Arch_Linux%E5%A8%98) 的怀抱。然而非常遗憾的是，Legion Y9000X 2022 IAH7 的扬声器拒绝了来自 Linux 的爱意。

在{% post_link fix-legion-y9000x-2022-iah7-speaker-on-linux 上一篇博文 %}中，我们通过修改内核配方解决了这个问题。但 nvidia-open 并不信任我们的内核配方，它拒绝了与我们调教后的小企鹅一起工作。

此外，手动 patch 的方法，也让滚动更新变得困难。因此，我们需要一种更加优雅的方式来 patch Linux 内核模块。

## 什么是 DKMS？
Dynamic Kernel Module Support (DKMS) 是 Dell 创建的动态内核模块支持框架，允许我们以源代码的形式插入新的内核模块。DKMS 会自动编译和安装这些模块，并在内核升级后重新编译。

通常而言，DKMS 用于加载树外的内核模块，但我们也可以通过加载同名模块来覆盖内核自带的模块。

## 如何使用 DKMS？
通常情况下，我们只需要准备好 DKMS 配置文件和模块源码，剩下的就可以交给 DKMS 来处理了。

不过，这里的情况稍微特殊了一些，我们是对 Linux 内核树内的模块进行 patch。那么便需要在编译前，先下载内核源代码，然后 patch 相关文件，再交付给 DKMS 进行编译。

那么，就让我们利用 DKMS 的 `PRE_BUILD` 钩子，在编译前执行一些特别的技巧吧。

编写一份 `dkms-patchmodule.sh` 脚本：
```bash dkms-patchmodule.sh
#!/bin/bash

DRIVER_PATH=$1

if [ -z "$kernelver" ]; then
    echo "No kernel version specified, using current kernel version"
    kernel_version=$(cat /proc/version | cut -d " " -f 3)
else
    kernel_version=$kernelver
fi
vers=${kernel_version//-/ }
vers=${vers//./ }
vers=($vers)
major="${vers[0]}"
minor="${vers[1]}"
subver="${vers[2]}"
version="$major.$minor.$subver"

kernel_source_file="linux-${version}.tar.xz"

cf_ns_trace=$(curl -s https://cf-ns.com/cdn-cgi/trace)
KERNEL_SOURCE="https://mirrors.edge.kernel.org/pub/linux/kernel/v$major.x/$kernel_source_file"
if [[ "$cf_ns_trace" == *"loc=CN"* ]]; then
  KERNEL_SOURCE="https://mirrors.ustc.edu.cn/kernel.org/linux/kernel/v$major.x/$kernel_source_file"
fi

if [ ! -f "${kernel_source_file}" ]; then
	echo "Downloading kernel source from $KERNEL_SOURCE"
	curl -sS $KERNEL_SOURCE -o $kernel_source_file
fi

echo "Extracting kernel source"
bsdtar -xvf $kernel_source_file linux-${version}/$DRIVER_PATH

for i in $(ls *.patch); do
    echo "Applying patch $i"
    patch -Np1 -d linux-${version}/ <$i
done

echo "Reorganizing sources"
mv linux-${version}/$DRIVER_PATH/* ./

echo "Cleaning up"
rm -rf ./linux-${version}
```

这将自动下载与当前内核版本相符的主线内核源代码，解压出指定目录树下的文件，并应用当前目录下的所有补丁文件。

由于我们需要修改的内核模块位于 `sound/pci/hda` 子目录树下，我们在 `dkms.conf` 中添加如下配置：

```conf dkms.conf
PRE_BUILD="dkms-patchmodule.sh sound/pci/hda"
```

需要覆盖的内核模块有 `snd-hda-scodec-cs35l41` 和 `snd-hda-codec-realtek`，因此在 `dkms.conf` 中添加如下配置：
```conf dkms.conf
BUILT_MODULE_NAME[0]="snd-hda-scodec-cs35l41"
BUILT_MODULE_NAME[1]="snd-hda-codec-realtek"
DEST_MODULE_LOCATION[0]="/updates/dkms/"
DEST_MODULE_LOCATION[1]="/updates/dkms/"
``` 

当然，我们还需要定义 DKMS 包的名称和版本号：
```conf dkms.conf
PACKAGE_NAME="@_PKGBASE@"
PACKAGE_VERSION="@PKGVER@"
```

## 打包成 DKMS Arch 包
既然使用了 Arch Linux，我们当然要将这个 DKMS 包打包成 Arch 包，以便于安装和管理。

根据约定，我们只需要在打包时将内核模块源码和 DKMS 配置文件放置到 `/usr/src/PACKAGE_NAME-PACKAGE_VERSION`，同时设置 Arch 包的名称以 `-dkms` 结尾，并添加相关依赖。[`dkms`](https://archlinux.org/packages/extra/any/dkms/) 的 pacman hook 会自动为我们注册和卸载内核模块。

一份供参考的 PKGBUILD 文件如下：
```bash PKGBUILD
_pkgbase=legion-y9000x-2022-iah7-sound-fix
pkgname=${_pkgbase}-dkms
pkgver=0.3.0
pkgrel=1
pkgdesc="DKMS package to fix internal speakers for Legion Y9000X 2022 IAH7 (which has cs35l41 amps identified as 17AA386E)"
arch=(any)
url="https://alampy.com/2024/04/19/use-dkms-to-patch-linux-kernel-mod/"
license=('GPL2')
depends=(dkms curl libarchive)
makedepends=()

source=('dkms-patchmodule.sh'
        'dkms.conf'
        'v3-1-2-ALSA-cs35l41-obey-the-trigger-type-from-DSDT.patch::https://patchwork.kernel.org/project/alsa-devel/patch/TYCP286MB253538FE76C93C032DB55212C40E2@TYCP286MB2535.JPNP286.PROD.OUTLOOK.COM/raw/'
        'v3-2-2-ALSA-hda-realtek-Fix-internal-speakers-for-Legion-Y9000X-2022-IAH7.patch::https://patchwork.kernel.org/project/alsa-devel/patch/TYCP286MB25359B61BB685A4B3110BB44C40E2@TYCP286MB2535.JPNP286.PROD.OUTLOOK.COM/raw')
sha256sums=('SKIP'
            'SKIP'
            '880a2ead1f744dd71b64188e964164be1fd8c40122adc5f726e9e49797a0bf3f'
            'e5b237c9ad9662684586a9ed52f7938486055d334072ad79534059de43cc803f')

package() {
    install -Dm644 dkms.conf "${pkgdir}"/usr/src/${_pkgbase}-${pkgver}/dkms.conf
    sed -e "s/@_PKGBASE@/${_pkgbase}/" \
        -e "s/@PKGVER@/${pkgver}/" \
        -i "${pkgdir}"/usr/src/${_pkgbase}-${pkgver}/dkms.conf
    for src in "${source[@]}"; do
        src="${src%%::*}"
        src="${src##*/}"
        [[ $src = *.patch ]] || continue
        install -Dm644 "${src}" "${pkgdir}"/usr/src/${_pkgbase}-${pkgver}/${src}
    done
    install -Dm755 dkms-patchmodule.sh "${pkgdir}"/usr/src/${_pkgbase}-${pkgver}/dkms-patchmodule.sh
}
```

## 生成并安装 Arch 包
```bash
makepkg -si
```

## 全部源码
- 站内下载：{% asset_link arch-pkg-legion-y9000x-2022-iah7-sound-fix-dkms.zip %}
- AUR 地址：[legion-y9000x-2022-iah7-sound-fix-dkms](https://aur.archlinux.org/packages/legion-y9000x-2022-iah7-sound-fix-dkms/)

## 参考资料
https://wiki.archlinuxcn.org/wiki/DKMS
https://wiki.archlinux.org/title/DKMS_package_guidelines
https://www.collabora.com/news-and-blog/blog/2021/05/05/quick-hack-patching-kernel-module-using-dkms/
