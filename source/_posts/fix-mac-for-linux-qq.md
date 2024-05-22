---
title: 为 Linux QQ 提供固定 MAC 地址以解决自动登录问题
date: 2024-05-15 00:38:00
updated: 2024-05-22 22:17:00
category: 技术
toc: true
tags:
- Linux
---
## 背景
Linux QQ 的设备码识别机制中包含了本地所有网卡的 MAC 地址，如果网卡的 MAC 地址发生变化，那么设备码也会发生变化，导致需要重新扫码登录。

不幸的是，如果你本地存在虚拟网络设备，或您经常插拔网卡，那么 QQ 获取到的 MAC 地址可能会发生变化，这样就会导致 QQ 无法自动登录。

具体而言，考虑一下场景：
- 您正在使用 Docker，Docker 会创建一个虚拟网络设备 `docker0`，这个设备的 MAC 地址是随机的。
- 您正在使用 TUN/TAP 设备来进行多出口分流，这个设备的 MAC 地址也是随机的。
- 您正在使用 TailScale、ZeroTier 等软件进行虚拟组网，这些软件也会创建虚拟网络设备，MAC 地址也是随机的。
- 您通过扩展坞连接到不同场景的网络，并通过插拔扩展坞来切换场景，则您的网络设备列表会经常变化，MAC 地址也会变化。
- 您和我一样，同时满足上述多个（甚至是全部）条件🥹

## 方案
### 基本思路
使用命名空间（Namespace）技术，将 QQ 运行在单独的网络命名空间中，并通过一个固定 MAC 地址的虚拟网络设备来提供网络连接。这样 QQ 获取到的 MAC 地址就是固定的，不会因为本地网络设备的变化而发生变化。

为了便于使用，我们采用 rootless 的方案，使用 user namespace 来隔离 QQ 进程，使用 slirp4netns 来提供网络连接。

### 设置 DNS 服务
由于命名空间隔离，`localhost` 也会被隔离，故而 QQ 无法直接访问本地的网络服务。为此，我们需要单独配置一些网络设备，避免因无法连接 `localhost:53` 的 DNS 服务而导致 QQ 无法正常解析域名。

我们使用 OverlayFS 来覆盖 `/etc/resolv.conf` 文件以避免 QQ 使用本地的 DNS 服务。相比对文件本身进行 mount，使用 OverlayFS 可以有效避免命名空间内配置文件被 NetworkManager 刷新的问题。

### 处理代理问题
为了分流，本地往往存在指向 `localhost` 的代理服务，但这些代理服务也会被隔离在命名空间之外。为此，我们需要在启动 QQ 时禁用这些代理服务。我们 unset `http_proxy` 等环境变量来避免使用本地代理服务，并使用 `--no-proxy-server` 参数来禁用 Electron 读取 KDE 代理配置自动设置代理。

### 支持快捷登陆
QQ 通过在 `localhost` 上监听一个端口来实现快捷登陆，但这个端口也会被隔离在命名空间之外。为此，我们需要在启动 QQ 时将这个端口映射到命名空间之外。注意 QQ 本身会拒绝非 `localhost` 的请求，所以我们需要在命名空间内使用 `socat` 来转发请求，再在命名空间外通过 `slirp4netns` 的 API 跨命名空间转发请求。

### 转发 `xdg-open`
QQ 通过调用 `xdg-open` 来打开链接，但 `xdg-open` 也会在我们的 network namespace 中运行，导致最后打开的浏览器等应用无法正确连接位于 localhost 的代理服务。为此，我们需要将 `xdg-open` 的调用转发到命名空间外。（2024-05-20 新增）

## 实现
### 安装依赖
对于 Arch Linux：
```bash
pacman -S slirp4netns socat util-linux
```

### 安装 QQ
对于使用 `paru` 的 Arch Linux 用户：
```bash
paru -S linuxqq
```

### 编写启动脚本
> #### ChangeLog
> ##### 2024-05-20
> - 把 xdg-open 转发到命名空间之外，以避免打开的浏览器跑在命名空间里面而无法连接位于 localhost 的 proxy
> ##### 2024-05-22
> - 修复在某些性能太好的机器上，可能会在 `slirp4netns` 未初始化好时尝试进行端口映射的问题 （感谢 [Kirikaze Chiyuki](https://chyk.ink/)）
> - 部分格式调整

```bash
#!/usr/bin/env bash

if [ -z "$(which slirp4netns)" ]; then
    echo "Please install slirp4netns"
    exit 1
fi

if [ -z "$(which socat)" ]; then
    echo "Please install socat"
    exit 1
fi

if [ -z "$(which nsenter)" ]; then
    echo "nsenter not found"
    exit 1
fi

if [ -z "$(which unshare)" ]; then
    echo "unshare not found"
    exit 1
fi

if [ -z "$(which linuxqq)" ]; then
    echo "Please install linuxqq"
    exit 1
fi

if [ $(basename "$0") = "xdg-open" ]; then
    echo "$1" | socat - UNIX-CONNECT:$XDG_OPEN_SOCKET
    exit
fi

# Make sure sub-processes are killed when the script exits
trap 'kill $(jobs -p) 2>/dev/null' EXIT
# Get the real path of the script
SCRIPT=$(realpath -s "$0")
if [ "$1" = "inside" ]; then
    echo $$ >"$2"
    # wait for the file to be deleted
    while [ -f "$2" ]; do
        sleep 0.01
    done
    # clear proxy settings
    unset http_proxy
    unset https_proxy
    unset ftp_proxy
    unset all_proxy
    socat tcp-listen:94301,reuseaddr,fork tcp:127.0.0.1:4301 &
    socat tcp-listen:94310,reuseaddr,fork tcp:127.0.0.1:4310 &
    linuxqq --no-proxy-server
    exit $?
elif [ "$1" = "mount" ]; then
    ETC_OVERLAY=$(mktemp -d)
    ETC_UPPER=$ETC_OVERLAY/upper
    ETC_LOWER=$ETC_OVERLAY/lower
    mkdir -p $ETC_UPPER $ETC_LOWER
    echo "nameserver 10.0.2.3" >$ETC_UPPER/resolv.conf
    mount --rbind /etc $ETC_LOWER
    mount -t overlay overlay -o lowerdir=$ETC_UPPER:$ETC_LOWER /etc
    mount --bind $SCRIPT /usr/bin/xdg-open
else
    # read the mac address from ~/.qq_mac, if not exist, generate a random one
    if [ -f ~/.qq_mac ]; then
        qq_mac=$(cat ~/.qq_mac)
    else
        qq_mac=00\:$(hexdump -n5 -e '/1 ":%02X"' /dev/random | sed s/^://g)
        echo $qq_mac >~/.qq_mac
    fi

    INFO_DIR=$(mktemp -d)
    INFO_FILE=$INFO_DIR/info
    export XDG_OPEN_SOCKET=$INFO_DIR/xdg-open.sock
    unshare --user --map-user=$(id -u) --map-group=$(id -g) --map-users=auto --map-groups=auto --keep-caps --setgroups allow --net --mount bash "$SCRIPT" inside $INFO_FILE &
    if [ $? -ne 0 ]; then
        rm -rf "${INFO_DIR:?}"
        echo "unshare failed"
        exit 1
    fi
    while [ ! -s $INFO_FILE ]; do
        sleep 0.01
    done
    PID=$(cat $INFO_FILE)
    echo "SubProcess PID: $PID"
    SLIRP_API_SOCKET=$INFO_DIR/slirp.sock
    slirp4netns --configure --mtu=65520 --disable-host-loopback --enable-ipv6 $PID eth0 --macaddress $qq_mac --api-socket $SLIRP_API_SOCKET &
    SLIRP_PID=$!
    # wait for the socket to be created, thanks for the fix from [Kirikaze Chiyuki](https://chyk.ink/)
    while [ ! -S "$SLIRP_API_SOCKET" ]; do
        sleep 0.01
    done
    if [ $? -ne 0 ]; then
        echo "slirp4netns failed"
        kill $PID
        rm -rf "${INFO_DIR:?}"
        exit 1
    fi
    nsenter -U -m --target $PID bash "$SCRIPT" mount
    add_hostfwd() {
        local proto=$1
        local guest_port=$2
        shift 2
        local ports=("$@")
        for port in "${ports[@]}"; do
            result=$(echo -n "{\"execute\": \"add_hostfwd\", \"arguments\": {\"proto\": \"$proto\", \"host_addr\": \"127.0.0.1\", \"host_port\": $port, \"guest_port\": $guest_port}}" | socat UNIX-CONNECT:$SLIRP_API_SOCKET -)
            if [[ $result != *"error"* ]]; then
                echo "$proto forwarding setup on port $port"
                return 0
            fi
        done
        echo "Failed to setup $proto forwarding."
        return 1
    }
    https_ports=(4301 4303 4305 4307 4309)
    http_ports=(4310 4308 4306 4304 4302)
    add_hostfwd "tcp" 94301 "${https_ports[@]}"
    add_hostfwd "tcp" 94310 "${http_ports[@]}"
    socat UNIX-LISTEN:$XDG_OPEN_SOCKET,fork EXEC:"xargs -d '\n' -n 1 xdg-open",pty,stderr &
    XDG_OPEN_SOCKET_PID=$!
    rm "$INFO_FILE"
    tail --pid=$PID -f /dev/null
    kill -TERM $SLIRP_PID
    wait $SLIRP_PID
    kill -TERM $XDG_OPEN_SOCKET_PID
    wait $XDG_OPEN_SOCKET_PID
    rm -rf "${INFO_DIR:?}"
    exit 0
fi
```

### 修改桌面文件
复制 `/usr/share/applications/qq.desktop` 到 `~/.local/share/applications/qq.desktop`，并修改 `Exec` 为启动脚本的路径。
