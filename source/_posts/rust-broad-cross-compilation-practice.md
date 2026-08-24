---
title: Rust 泛交叉编译实践
date: 2026-08-25 03:28:00
updated: 2026-08-25 03:28:00
category: 技术
toc: true
---

## 什么是交叉编译
交叉编译是指在一种平台上编译生成另一平台的可执行文件的过程。对于一个编译器而言，其运行在 Host 平台上，生成的可执行文件运行在 Target 平台上。例如，想要在 x86_64 平台上编译生成 RISC-V 64 架构的可执行文件，就需要进行交叉编译。特别地，对于 native 编译器而言，Host = Target。

## 你需要真正的交叉编译吗
在几乎任何现代通用计算平台上，本地编译都是最简单的选择。在决定交叉编译之前，不妨先看看，我们能不能用本地编译解决问题。

### 也许你的 CI 可以用于本地编译
在 2026 年，AArch64 架构已经被许多 CI 平台所支持，例如 GitHub Actions。只要在 CI 配置文件上正确指定，就可以避免交叉编译的麻烦，直接进行本地编译。

以 GitHub Actions 为例，我们可以在 CI 配置文件中指定 `runs-on` 为 `ubuntu-xxx-arm`：
```yaml
name: Build
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-24.04-arm
  steps:
    - name: Check
      run: dpkg --print-architecture
```

当然，如果你需要 RISC-V 64 架构的产物，那么就相对麻烦一些，因为大多数 CI 平台仍然不支持 RISC-V 64 架构。

### Rust 源码发行
这也许是最简单的方式。Rust 的构建系统非常易用，只要用户有 Rust 的工具链，就可以 `cargo build` 来编译生成可执行文件。如果不想 `git clone` 源码，也可以通过 `cargo install` 来编译安装。

### Distro 包源码发行
另一种源码发行的方式是发布 Linux 发行版的打包脚本源码。相比 Rust 源码发行，这种方式的好处是可以使用系统包管理器来依赖一些外部 C 库等，更加便于处理涉及 FFI 的场景。同时，这可以让软件包的管理更加方便，用户可以通过包管理器来安装、升级和卸载软件包。

在许多发行版上，这种方式是非常常见的，例如：Arch Linux 的 AUR、NixOS 等等。

### 伪交叉编译——QEMU 模拟器
另一种方法是，我们可以通过 QEMU 用户态模拟器来将编译过程转换为本地编译。QEMU 用户态模拟器可以在 Host 平台上模拟 Target 平台的 CPU 指令集，从而直接运行 Target 平台的 native 编译器。

由于现代容器技术的存在，用户态仿真已经变得非常易用，只需要设置 binfmt_misc 规则，并在拉取容器镜像时指定 `--platform` 参数，就可以直接在 Host 平台上运行 Target 平台的 native 编译器。

以 Arch Linux 下的 Podman 为例：
```bash
sudo pacman -S qemu-user-static-binfmt
sudo systemctl restart systemd-binfmt.service
podman run --rm --platform 'linux/riscv64' 'docker.io/alpine:latest' arch
```

对于 GitHub Actions 平台，我们可以使用 `docker/setup-qemu-action` 来设置 QEMU 用户态模拟器：
```yaml
- uses: docker/setup-qemu-action@v4
  with:
    platforms: riscv64
- run: docker run --rm --platform 'linux/riscv64' 'docker.io/alpine:latest' arch
```

这样就可以在 x86_64 平台上运行 RISC-V 64 架构的 Alpine Linux 容器，并且可以直接在容器中使用 RISC-V 64 架构的 native 编译器。

当然这种方法具有明显的局限性，跨架构模拟会带来大量性能损耗，据个人观察，编译速度有时可以相差 10x，尤其是在编译大型项目或宿主机资源有限（如 CI/CD 环境）时。

## 那就交叉编译吧
### 最基本的交叉编译
Rust 官方提供了 `rustup target add` 命令来安装 Target 平台的标准库，从而支持交叉编译。

然而，如果我们直接用如下的方式进行交叉编译：
```bash
rustup target add riscv64gc-unknown-linux-gnu
cargo build --target riscv64gc-unknown-linux-gnu
```
那么我们会发现编译失败，报错信息类似：
```
error: linking with `cc` failed: exit status: 1
```

这是因为 Rust 在进行连接阶段时，需要依赖系统的连接器（linker）来生成最终的可执行文件。而默认情况下，Rust 的编译器会使用 Host 平台的连接器，这就导致了链接失败。

为此，我们还需要安装 Target 平台的交叉工具链，例如在 Debian/Ubuntu 平台上，我们可以使用如下命令安装 RISC-V 64 架构的交叉工具链：
```bash
sudo apt install crossbuild-essential-riscv64
```

然后使用环境变量来指定 Rust 编译器使用 Target 平台的连接器：
```bash
# 指定连接器
export CARGO_TARGET_RISCV64GC_UNKNOWN_LINUX_GNU_LINKER=riscv64-linux-gnu-gcc
# 下面这些只在特定情况下需要设置
export CC_riscv64gc_unknown_linux_gnu=riscv64-linux-gnu-gcc
export CXX_riscv64gc_unknown_linux_gnu=riscv64-linux-gnu-g++
export AR_riscv64gc_unknown_linux_gnu=riscv64-linux-gnu-ar
# pkg-config 相关的环境变量
export PKG_CONFIG_PATH=/usr/riscv64-linux-gnu/lib/pkgconfig
export PKG_CONFIG_LIBDIR=/usr/riscv64-linux-gnu
export PKG_CONFIG_SYSROOT_DIR=/
export PKG_CONFIG_ALLOW_CROSS=true
cargo build --target riscv64gc-unknown-linux-gnu
```

### 处理系统依赖库
这是交叉编译中比较麻烦的部分。对于 Rust 项目而言，很多时候我们会依赖一些 C 库，这些 C 库通常是为 Host 平台编译的，而不是 Target 平台的。

为了在交叉编译时正确地链接这些 C 库，我们需要为 Target 平台安装这些库的交叉编译版本。

#### 在 Debian/Ubuntu 等支持 multiarch 的发行版上
Debian/Ubuntu 等发行版支持 multiarch，我们可以直接安装 Target 平台的 C 库。


以 Ubuntu 为例，我们首先需要在 apt source 中添加 Ubuntu Ports 仓库，以便拥有 RISC-V 64 等架构的包：
```bash
# 确保原有的 apt 源只用于 native 架构
native_arch="$(dpkg --print-architecture)"
dpkg_arch="riscv64"
sudo sed -Ei "/^deb /{/^deb \\[/! s|^deb |deb [arch=${native_arch}] |}" /etc/apt/sources.list

# 添加 Ubuntu Ports 仓库
. /etc/lsb-release
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME main restricted" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-updates main restricted" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME universe" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-updates universe" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME multiverse" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-updates multiverse" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-backports main restricted universe multiverse" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-security main restricted" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-security universe" | sudo tee -a /etc/apt/sources.list
echo "deb [arch=$dpkg_arch] http://ports.ubuntu.com/ubuntu-ports $DISTRIB_CODENAME-security multiverse" | sudo tee -a /etc/apt/sources.list
```
然后需要开启 multiarch 支持：
```bash
sudo dpkg --add-architecture riscv64
sudo apt update
```
接下来就可以安装 Target 平台的 C 库了，例如：
```bash
sudo apt install libssl-dev:riscv64
```

这样就可以在交叉编译时正确地链接这些 C 库了。

##### 什么，apt 安装失败了？
如果你在 `ubuntu:22.04` 尝试安装 `libtinfo6:riscv64` 时，可能会遇到神秘的错误：
```
Some packages could not be installed. This may mean that you have
requested an impossible situation or if you are using the unstable
distribution that some required packages have not yet been created
or been moved out of Incoming.
The following information may help to resolve the situation:

The following packages have unmet dependencies:
 bash : PreDepends: libtinfo6 (>= 6) but it is not installable
        Recommends: bash-completion (>= 20060301-0) but it is not going to be installed
 ncurses-bin : PreDepends: libtinfo6 (>= 6.3) but it is not installable
 util-linux : PreDepends: libtinfo6 (>= 6) but it is not installable
E: Error, pkgProblemResolver::Resolve generated breaks, this may be caused by held packages.
```

非常神秘，经过调查，问题出在 Ubuntu 22.04 发布了 libtinfo6 (6.3-2ubuntu0.2) 这个安全更新，同时这个包的策略是 `Multi-Arch: same`。然而，并不存在 libtinfo6:riscv64 (6.3-2ubuntu0.2) 这个包。由于这里无法同时安装两个版本的 libtinfo6，因此导致了依赖冲突。

{% collapse "附 libtinfo6 的可选版本列表" %} 
- libtinfo6 6.3-2 in amd64
- libtinfo6 6.3-2ubuntu0.2 in amd64
- libtinfo6 6.3-2 in arm64
- libtinfo6 6.3-2ubuntu0.2 in arm64
- libtinfo6 6.3-2 in armhf
- libtinfo6 6.3-2ubuntu0.2 in armhf
- libtinfo6 6.3-2 in i386
- libtinfo6 6.3-2ubuntu0.2 in i386
- libtinfo6 6.3-2 in ppc64el
- libtinfo6 6.3-2ubuntu0.2 in ppc64el
- libtinfo6 6.3-2 in riscv64
- libtinfo6 6.3-2ubuntu0.1 in riscv64
- libtinfo6 6.3-2 in s390x
- libtinfo6 6.3-2ubuntu0.2 in s390x
{% endcollapse %}

为了处理这种问题，我们需要在安装过程中执行一些自动降级，一种处理方法是使用 `aptitude` 并配置特定的问题解决约束：
```bash
# 需要安装的依赖包
dependencies=(
    "libtinfo6:riscv64"
)
# 安装 aptitude 工具
sudo apt install aptitude
# 屏蔽掉拒绝安装 dependencies 的解决方案
aptitude_options=()
for package in "${dependencies[@]}"; do
    aptitude_options+=(-o "Aptitude::ProblemResolver::Hints::=reject ${package%%:*} :UNINST")
done
sudo aptitude install -y --without-recommends \
    -o "Aptitude::ProblemResolver::SolutionCost=removals, safety, priority" \
    "${aptitude_options[@]}" "${dependencies[@]}"
# aptitude 在局部失败时可能也会正常退出，我们检测一下依赖是不是都安装成功了
for package in "${dependencies[@]}"; do
    test "$(dpkg-query -W -f='${db:Status-Abbrev}' "$package")" = "ii "
done
```

`aptitude` 支持更复杂的依赖问题解决策略，在这个例子中，将推导出以下方案：
```
The following packages have unmet dependencies:
 aptitude : Depends: libtinfo6 (>= 6.1+20180210) but it is not going to be installed
 libcwidget4 : Depends: libtinfo6 (>= 6.0+20180210) but it is not going to be installed
 util-linux : PreDepends: libtinfo6 (>= 6) but it is not going to be installed
 bash : PreDepends: libtinfo6 (>= 6) but it is not going to be installed
 procps : Depends: libtinfo6 (>= 6) but it is not going to be installed
 libncursesw6 : Depends: libtinfo6 (= 6.3-2ubuntu0.2) but it is not going to be installed
 ncurses-bin : PreDepends: libtinfo6 (>= 6.3) but it is not going to be installed
 libncurses6 : Depends: libtinfo6 (= 6.3-2ubuntu0.2) but it is not going to be installed
The following actions will resolve these dependencies:

     Install the following packages:
1)     libtinfo6:riscv64 [6.3-2 (jammy)]

     Downgrade the following packages:
2)     libncurses6 [6.3-2ubuntu0.2 (jammy-security, jammy-updates, now) -> 6.3-2 (jammy)]
3)     libncursesw6 [6.3-2ubuntu0.2 (jammy-security, jammy-updates, now) -> 6.3-2 (jammy)]
4)     libtinfo6 [6.3-2ubuntu0.2 (jammy-security, jammy-updates, now) -> 6.3-2 (jammy)]
```

#### 使用 Container + Sysroot 提供系统依赖库信息
对于缺乏 multiarch 支持的环境（例如许多 musl-based 的环境），想要安装 Target 平台的 C 库就比较麻烦了。当然，我们可以先交叉编译这些 C 库，只是这么做的成本比较高。
这里介绍一种比较 tricky 的做法：
- 使用 Container + QEMU 在 Target 平台上运行并安装相关依赖
- 使用 export 将容器文件系统导出为 tar 包
- 解压 tar 包到宿主机的某个目录下，作为 Sysroot。之后的交叉编译过程中，使用一个相似容器环境，编译时指定 `--sysroot` 参数选择这个目录。
- 这样，相关依赖就是从我们导出的那个容器环境中获取的，而不是从宿主机的系统中获取的。

所谓 Sysroot，就是包含 Target 平台头文件和库文件的一个模拟系统根目录，在交叉编译时，编译器会将其作为 Target 平台的根目录来查找头文件和库文件。注意为了使用 Sysroot，我们需要在多个参数中设置：
- pkg-config 相关的环境变量中，需要指向 Sysroot 目录
- cflags/cxxflags 中，需要使用 `--sysroot` 参数和 `--gcc-toolchain` 参数
- linkflags 中，需要使用 `--sysroot` 参数和 `--gcc-toolchain` 参数，并且需要指定动态链接器路径和 rpath-link。rpath-link 的作用是告诉链接器在链接时去哪里寻找依赖的共享库，注意和 rpath 不一样（不会保存到最终的可执行文件中）。
- 特别地，Rust 场景下，可以通过 rustflags 来间接设置 linkflags。

这里给出一份完整的 CI 示范：
```yaml
deploy-linux-musl:
  strategy:
    fail-fast: false
    matrix:
      release_name:
        - "linux-riscv64-musl"
      include:
        - release_name: "linux-riscv64-musl"
          host_oci_arch: "amd64"
          target_oci_arch: "riscv64"
          sysroot_base: "alpine:3.24"
  runs-on: ubuntu-latest
  steps:
    - name: Checkout
      uses: actions/checkout@v7
    - name: Set up QEMU
      if: matrix.host_oci_arch != matrix.target_oci_arch
      uses: docker/setup-qemu-action@v4
      with:
        platforms: ${{ matrix.target_oci_arch }}
    - name: Prepare Alpine Sysroot
      run: |
        container="alpine-${{ matrix.target_oci_arch }}-sysroot-${GITHUB_RUN_ID}"
        sysroot="$RUNNER_TEMP/alpine-sysroot"
        mkdir -p "$sysroot"
        docker run \
          --name "$container" \
          --platform "linux/${{ matrix.target_oci_arch }}" \
          '${{ matrix.sysroot_base }}' sh -e -c '
            apk --no-cache add build-base linux-headers gtk+3.0-dev rust cargo
            mkdir -p /var/lib/build-config
            rustc -vV | sed -n "s/^host: //p" > /var/lib/build-config/rust-target
            gcc -dumpmachine > /var/lib/build-config/clang-target
            readelf -lW /bin/busybox | sed -n "s@.*Requesting program interpreter: \(.*\)]@\1@p" > /var/lib/build-config/loader
            readelf -hW /bin/busybox | sed -n "s/^ *Machine: *//p" > /var/lib/build-config/elf-machine
            rm -rf /var/cache/apk/* /tmp/* /var/tmp/*
            rm -f /var/log/apk.log
          '
        trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
        docker export "$container" | sudo tar --extract --directory "$sysroot" \
          --numeric-owner --same-permissions --delay-directory-restore
        docker rm "$container"
        trap - EXIT

        {
          echo "SYSROOT=$sysroot"
          echo "RUST_TARGET=$(cat "$sysroot/var/lib/build-config/rust-target")"
          echo "CLANG_TARGET=$(cat "$sysroot/var/lib/build-config/clang-target")"
          echo "LOADER=$(cat "$sysroot/var/lib/build-config/loader")"
          echo "ELF_MACHINE=$(cat "$sysroot/var/lib/build-config/elf-machine")"
        } >> "$GITHUB_ENV"
    - name: Build (Release)
      run: |
        docker run --rm \
          -e SYSROOT=/sysroot \
          -e RUST_TARGET \
          -e CLANG_TARGET \
          -e LOADER \
          -e ELF_MACHINE \
          -v "${{ github.workspace }}:/workspace" \
          -v "$SYSROOT:/sysroot:ro" \
          -w /workspace \
          --platform "linux/${{ matrix.host_oci_arch }}" \
          '${{ matrix.sysroot_base }}' sh -e -c '
            apk add --no-cache rust cargo clang lld pkgconf binutils
            cp -a "$SYSROOT/usr/lib/rustlib/$RUST_TARGET" /usr/lib/rustlib/
            cargo_env=$(printf %s "$RUST_TARGET" | tr "[:lower:]-" "[:upper:]_")
            cargo_env_lower=$(printf %s "$RUST_TARGET" | tr - _)
            export PKG_CONFIG_ALLOW_CROSS=1
            export PKG_CONFIG_ALL_DYNAMIC=1
            export PKG_CONFIG_SYSROOT_DIR="$SYSROOT"
            export PKG_CONFIG_LIBDIR="$SYSROOT/usr/lib/pkgconfig:$SYSROOT/usr/share/pkgconfig:$SYSROOT/lib/pkgconfig"
            unset PKG_CONFIG_ALL_STATIC PKG_CONFIG_PATH
            export "PKG_CONFIG_SYSROOT_DIR_$cargo_env_lower=$SYSROOT"
            export "PKG_CONFIG_LIBDIR_$cargo_env_lower=$PKG_CONFIG_LIBDIR"
            export "PKG_CONFIG_PATH_$cargo_env_lower="
            export "CC_$cargo_env_lower=clang"
            export "CXX_$cargo_env_lower=clang++"
            export "AR_$cargo_env_lower=ar"
            export "CFLAGS_$cargo_env_lower=--target=$CLANG_TARGET --sysroot=$SYSROOT --gcc-toolchain=$SYSROOT/usr"
            export "CXXFLAGS_$cargo_env_lower=--target=$CLANG_TARGET --sysroot=$SYSROOT --gcc-toolchain=$SYSROOT/usr"
            export "CARGO_TARGET_${cargo_env}_LINKER=clang"
            rustflags="-C target-feature=-crt-static -C link-arg=--target=$CLANG_TARGET -C link-arg=--sysroot=$SYSROOT -C link-arg=--gcc-toolchain=$SYSROOT/usr -C link-arg=-fuse-ld=lld -C link-arg=-Wl,-dynamic-linker,$LOADER -C link-arg=-Wl,-rpath-link,$SYSROOT/lib -C link-arg=-Wl,-rpath-link,$SYSROOT/usr/lib"
            export "CARGO_TARGET_${cargo_env}_RUSTFLAGS=$rustflags"
            cargo build --release --target "$RUST_TARGET" --verbose
          '
```

## 致谢
本文记录的许多问题是在一些 hobby project 中的真实探索发现。在处理这些问题的过程中，GPT-5.6 Sol 提供了非常有价值的帮助，感谢其在问题分析和解决方案设计方面的支持。

此外，感谢 [DeRouter](https://derouter.ai?ref=ALAMPY) 提供的 LLM API 付费服务，使得访问前沿模型更加便捷实惠。
