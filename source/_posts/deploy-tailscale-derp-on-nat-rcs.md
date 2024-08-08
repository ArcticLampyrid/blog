---
title: '在 NAT 云上部署 Tailscale DERP 服务器'
date: 2024-08-08 18:55:00
updated: 2024-08-08 18:55:00
category: 技术
---
## 引
Tailscale 是常用的虚拟组网工具，使用 DERP 服务器实现 Peer 间的初始化连接，以及 Peer 无法直接连接时的中继。由于官方 DERP 服务器位于海外，连接速度较慢，我们往往考虑自行部署 DERP 服务器，以提高中国大陆境内的连接速度。由于自建的 DERP 通常不用于对外服务，且端口号等均由控制平面自动下发，故使用高位端口，将其部署在廉价免备案 NAT 云服务器上是一个不错的选择。

## Certbot 证书申请
Tailscale DERP 服务器需要使用 TLS 证书，默认情况下 derper 会自动申请 Let's Encrypt 证书，但是由于我们使用的是高位端口，无法通过自动验证，故需要手动申请证书。

在这里，博主使用 Certbot 申请证书，通过 DNS Challenge 验证域名所有权。首先，通过 Snap 安装 Certbot：
```bash
sudo apt install snapd
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

随后安装 DNS Challenge 插件（这里以 Cloudflare 为例）：
```bash
sudo snap set certbot trust-plugin-with-root=ok
sudo snap install certbot-dns-cloudflare
```

申请 Cloudflare API Token（[在这里](https://dash.cloudflare.com/profile/api-tokens)），权限为 `Zone:DNS`，将其保存在 `~/.secrets/certbot/cloudflare.ini` 中：
```ini
dns_cloudflare_api_token = your-api-token
```

运行 Certbot 申请证书：
```bash
certbot certonly --dns-cloudflare --dns-cloudflare-credentials ~/.secrets/certbot/cloudflare.ini -d example.com
```

Certbot 会自动生成续期定时任务，无需手动续期。我们在 `/etc/letsencrypt/renewal-hooks/deploy/` 中创建脚本 `derper.sh`，用于自动续期完成后持续部署：
```bash
#!/usr/bin/env bash
HOSTNAME=example.com
mkdir -p /etc/derper/certs
rm -f /etc/derper/certs/${HOSTNAME}.key
rm -f /etc/derper/certs/${HOSTNAME}.crt
cp /etc/letsencrypt/live/${HOSTNAME}/privkey.pem /etc/derper/certs/${HOSTNAME}.key
cp /etc/letsencrypt/live/${HOSTNAME}/fullchain.pem /etc/derper/certs/${HOSTNAME}.crt
# 重启 DERP 服务器，这里假定容器名称为 tailscale-derper
docker restart tailscale-derper
```

## 设置 NAT 云端口转发规则
找到 NAT 云控制平面板，设置端口转发规则，需要一个 UDP 端口和一个 TCP 端口，这里以 33478 和 33443 为例。

{% asset_img "port-mapping.png" "端口转发配置图" %}

## 修改 DERP 服务器
为了增强隐私安全、避免潜在的域名泄漏，我们使用无 SNI 方式建立 TLS 连接，DERPMap 支持通过 `CertName` 字段指定证书名称，指定后我们可以直接将 `HostName` 设置为 IP 地址，这样域名将仅用于证书验证，不会在连接时作为 SNI 传递。

非常遗憾的是，尽管 Tailscale 官方客户端支持此功能，但 Tailscale 官方 derper 程序对证书的验证非常严格，无法使用与 `HostName` 不匹配的证书，故我们需要对其进行 Patch。

一份可用的 Patch 如下：
```diff
diff --git a/cmd/derper/cert.go b/cmd/derper/cert.go
index db84aa515..377bca4f6 100644
--- a/cmd/derper/cert.go
+++ b/cmd/derper/cert.go
@@ -5,7 +5,6 @@
 
 import (
 	"crypto/tls"
-	"crypto/x509"
 	"errors"
 	"fmt"
 	"net/http"
@@ -66,14 +65,6 @@ func NewManualCertManager(certdir, hostname string) (certProvider, error) {
 	if err != nil {
 		return nil, fmt.Errorf("can not load x509 key pair for hostname %q: %w", keyname, err)
 	}
-	// ensure hostname matches with the certificate
-	x509Cert, err := x509.ParseCertificate(cert.Certificate[0])
-	if err != nil {
-		return nil, fmt.Errorf("can not load cert: %w", err)
-	}
-	if err := x509Cert.VerifyHostname(hostname); err != nil {
-		return nil, fmt.Errorf("cert invalid for hostname %q: %w", hostname, err)
-	}
 	return &manualCertManager{cert: &cert, hostname: hostname}, nil
 }
 
@@ -88,10 +79,6 @@ func (m *manualCertManager) TLSConfig() *tls.Config {
 }
 
 func (m *manualCertManager) getCertificate(hi *tls.ClientHelloInfo) (*tls.Certificate, error) {
-	if hi.ServerName != m.hostname {
-		return nil, fmt.Errorf("cert mismatch with hostname: %q", hi.ServerName)
-	}
-
 	// Return a shallow copy of the cert so the caller can append to its
 	// Certificate field.
 	certCopy := new(tls.Certificate)
```

将 Patch 保存为 `derper.patch`，并在 `tailscale/` 目录下执行：
```bash
patch -p1 < derper.patch
```

即可完成 Patch。随后编译并部署 DERP 服务器即可。

## 部署 DERP 服务器
我们使用 Docker 部署 DERP 服务器，一份带上述 Patch 的 Docker 镜像参见 [ArcticLampyrid/docker-derper-custom-cert](https://github.com/ArcticLampyrid/docker-derper-custom-cert)。

我们使用 Docker Compose 部署 DERP 服务器，创建 `docker-compose.yml`：
```yaml
services:
  derper:
    container_name: tailscale-derper
    restart: always
    build:
      context: https://github.com/ArcticLampyrid/docker-derper-custom-cert.git#main
    network_mode: "host"
    environment:
      - DERP_DOMAIN=example.com
      - DERP_CERT_MODE=manual
      - DERP_PORT=33443
      - DERP_STUN=true
      - DERP_STUN_PORT=33478
      - DERP_HTTP_PORT=-1
      # 2024-08-08: 
      # 待 https://github.com/juanfont/headscale/issues/1953 解决后，
      # 可以指向 `https://headscale/verify`，以只允许已登陆的节点使用自建 DERP 服务器
      # （也可以直接使用未合并的 PR 来先行使用相关功能）
      - DERP_VERIFY_CLIENT_URL=""
    volumes:
      - /etc/derper/certs:/app/certs
      - /etc/derper/data:/var/lib/derper
```

部署 Docker Compose：
```bash
docker-compose up -d
```

随后，我们将自建的 DERP 服务器配置到控制平面中。如果您使用 Headscale 作为控制平面，可以将如下配置保存到 `/etc/headscale/derpmap.yaml` 中：
```yaml
regions:
 900:
   # 自定义区域 ID：900～999
   regionid: 900
   regioncode: "homelab"
   regionname: "HomeLab"
   nodes:
     - name: 'homelab'
       regionid: 900
       hostname: '1.2.3.4'
       certname: 'example.com'
       ipv4: '1.2.3.4'
       ipv6: 'none' # 禁用 IPv6
       stunport: 33478
       stunonly: false
       derpport: 33443
       canport80: false
```

然后在 `/etc/headscale/config.yaml` 中引用 `derpmap.yaml`：
```yaml
derp:
  paths:
    - /etc/headscale/derpmap.yaml
```

重启 Headscale 服务即可。

## 测试 DERP 服务器
在本地机器上运行 Tailscale 客户端，登陆到 Tailscale 网络。

如果想要查看控制平面下发的 DERPMap，可以在终端运行：
```bash
tailscale debug netmap
```

为了测试自建的 DERP 服务器，可以运行：
```bash
tailscale debug derp homelab
```

查看当前设备到所有 DERP 服务器的延迟：
```bash
tailscale netcheck
```
