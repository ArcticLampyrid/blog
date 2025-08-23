---
title: IaC 实践：用代码管理 DNS 记录
date: 2025-08-24 07:28:00
category: 技术
tag: [IaC]
toc: true
---
## 引
随着自部署的服务越来越复杂且服务架构奇怪（为了在节约成本的同时满足一定的灵活性和可扩展性），DNS 记录越来越多，管理这些记录的难度也在增加。

橙橙子的 DNS 记录已经有 50+ 条，大部分记录可能是这样的风格：
```conf
service0.example.com {
  # host on server1 & server2
  A 1.2.3.4
  A 1.2.3.5
  AAAA 2001:db8::1
  AAAA 2001:db8::2
}

service1.example.com {
  # host on server1
  A 1.2.3.4
  AAAA 2001:db8::1
}

service2.example.com {
  # host on server2
  A 1.2.3.5
  AAAA 2001:db8::2
}
```
使用 Web 界面管理这些记录已经变得十分不便：
- 不便于分类整理、添加注释等
- 难以批量替换（如某台服务器 IP 变更时，需手动修改多个服务的记录）
- 缺乏备份和版本管理机制

因此，考虑使用 **基础设施即代码（IaC）** 工具来管理 DNS 记录。

## 调研
| (特性/工具)      | Terraform | Pulumi       | OctoDNS  | DNSControl |
| ---------------- | --------- | ------------ | -------- | ---------- |
| 适用范围         | 多种资源  | 多种资源     | 专注 DNS | 专注 DNS   |
| 描述文件语言     | HCL       | 多种编程语言 | YAML     | JavaScript |
| 资源配置简洁性   | 较复杂    | 较复杂       | 较简单   | 较简单     |
| 跨服务商统一配置 | 困难      | 有限支持     | 原生支持 | 原生支持   |
| 状态管理         | 需要存储  | 需要存储     | 无状态   | 无状态     |

### Terraform
可能是**最负盛名**的 IaC 工具之一，支持管理各种服务，如 DNS 记录、VPC 网络、EC2 实例等。Terraform 采用 [HCL 声明语言](https://github.com/hashicorp/hcl/blob/main/hclsyntax/spec.md)（具有变量和一定的逻辑运算能力）来定义基础设施的状态。其最大的优势在于可以同时使用 IaC 管理多种资源，并且和 DNS 资源联动（比如通过资源名直接引用 EC2 实例的 IP 地址）

使用 Terraform 工具管理 DNS 记录可以参考 [@Candinya 的相关博文](https://candinya.com/posts/manage-cloudflare-dns-with-terraform/)，其配置文件风格如下：
```hcl
resource "cloudflare_record" "alampy_com_root" {
  zone_id = cloudflare_zone.alampy_com.id
  name    = "@"
  value   = "example.com"
  type    = "CNAME"
  proxied = true
}
```

Terraform 在 DNS 管理方面的不足主要在于，缺乏原生的跨服务商 DNS 记录同步功能，但这对于个人用户可能并不紧要。

然而 Terraform 要求一个存储后端来保存状态信息，这可能会增加额外的复杂性。同时如果已有 DNS 记录配置存在，迁移到 Terraform 需要较复杂的 import 过程。

### Pulumi
Pulumi 也是著名的通用 IaC 工具，与 Terraform 的声明式配置不同，Pulumi 采用更灵活的编程式配置，支持多种编程语言（如 JavaScript、TypeScript、Python、Go 等），让开发者可以用熟悉的语言和工具管理基础设施。

其 DNS 管理能力可参考 [Cloudflare 官方文档](https://developers.cloudflare.com/pulumi/tutorial/add-site/)。

和 Terraform 类似，Pulumi 需要一个存储后端来保存状态信息，初次迁移需要较复杂的 import 过程。

### OctoDNS
OctoDNS 是专注于 DNS 记录管理的工具，最大特点是支持将同一份配置同时应用到多个 DNS 提供商（大型互联网服务常用多家 DNS 提供商，通过多 NS 记录提升冗余和可靠性），极大简化了跨平台 DNS 管理。

OctoDNS 的实现逻辑基于“同步”，即将配置从 `sources` 同步到 `targets`，确保各 DNS 提供商（本地文件可视为一种特殊 Provider）之间的一致性。这种逻辑使得 OctoDNS 不需要自行维护状态，而是基于实际情况进行 Diff 和 Apply，对于迁移和部署来说成本更低。

典型配置如下：
```yaml
providers:
  config:
    class: octodns.provider.yaml.YamlProvider
    directory: ./config
    default_ttl: 3600
    enforce_order: True
  ns1:
    class: octodns_ns1.Ns1Provider
    api_key: env/NS1_API_KEY
  route53:
    class: octodns_route53.Route53Provider
    access_key_id: env/AWS_ACCESS_KEY_ID
    secret_access_key: env/AWS_SECRET_ACCESS_KEY

zones:
  example.com.:
    sources:
      - config
    targets:
      - ns1
      - route53
```

OctoDNS 使用 YAML 作为本地记录格式，其配置复用能力依赖于 YAML 的引用、锚点、合并等特性：
```yaml
www:
  - &homepage_a_record
    type: A
    values:
    - 1.2.3.4
    - 1.2.3.5
'': # domain's apex
    - *homepage_a_record
    - type: MX
      value:
        exchange: mx.example.com.
        preference: 10
```

### DNSControl
DNSControl 是由 StackExchange 开发的一个开源 DNS 记录管理工具，专注于通过代码管理 DNS 记录。它支持多种 DNS 提供商。其使用基于 JavaScript 的 DSL 来定义 DNS 记录，允许用户以编程方式创建和管理 DNS 记录，风格大致如下：
```javascript
var REG_NONE = NewRegistrar("none");
var DNS_BIND = NewDnsProvider("bind");

D("example.com", REG_NONE, DnsProvider(DNS_BIND),
    A("@", "1.2.3.4"),    // "@" means the domain's apex.
);
```

DNSControl 也是无状态的，基于 Diff 和 Apply 完成配置，对于迁移和部署来说成本较低。

## 实践
### 0. 准备工具
基于已有情况：
- 橙橙子暂时还没有使用 IaC 管理多项服务的打算（考虑到 self-hosted 场景下会使用不少小厂的产品，这么做可能并不实际），目前只考虑在 DNS 记录管理上使用 IaC 工具
- 橙橙子希望配置文件具有较好的灵活性，方便复用逻辑
- 橙橙子已有一定的 DNS 记录，希望迁移较为方便
- 橙橙子希望在满足需求的情况下尽可能保持简单易部署

橙橙子选择了使用 DNSControl 作为 DNS 记录管理的 IaC 工具。

- 对于 Arch Linux 用户，可以安装 [dnscontrol-bin \[AUR\]](https://aur.archlinux.org/packages/dnscontrol-bin) 包。
- 对于 macOS 用户，可以使用 `brew install dnscontrol` 来安装。
- 对于 Golang 用户，可以使用 `go install github.com/StackExchange/dnscontrol/v4@latest` 来安装。
- 对于 Docker 用户，可以使用 `docker run --rm -it -v "$(pwd):/dns" ghcr.io/stackexchange/dnscontrol ${command}` 来运行。

### 1. 初始化仓库
准备一个仓库来存放 DNSControl 的配置文件。在这里我们使用 Git 进行管理（你也可以只是简单创建一个文件夹）。

```bash
mkdir dnscontrol_alampy
cd dnscontrol_alampy
git init
```

### 2. 配置凭据加密（可跳过）
DNSControl 需要一个 `creds.json` 文件来存储 API 凭据信息，为了加强安全性，我们使用 [`git-crypt`](https://www.agwa.name/projects/git-crypt/) 对该文件进行加密。具体步骤如下：

```bash
git-crypt init
echo "creds.json filter=git-crypt diff=git-crypt" >> .gitattributes
```

`git-crypt` 会生成一个对称密钥用于加解密数据，如果你有 GPG 密钥，可以使用：
```bash
git-crypt add-gpg-user $YOUR_GPG_UID
```
此时会使用你的公钥保存对称密钥，并自动生成一个 commit。之后，你只需要维护你的私钥不丢失，便可以解密 `creds.json` 文件。

如果你平时不使用 GPG 工具，也可以直接导出对称密钥并保存在安全的地方。
```bash
git-crypt export-key /path/to/keyfile
```

### 3. 配置凭据文件
创建 `creds.json` 文件，内容如下（请替换为适合你自己的配置）：
```jsonc
{
  "cloudflare:alampy.com": {
    "TYPE": "CLOUDFLAREAPI",
    "accountid": "your-cloudflare-account-id",
    "apitoken": "your-cloudflare-api-token"
  },
  "none": { "TYPE": "NONE" }
}
```

对于 Cloudflare 用户，参照 [DNSControl 文档](https://docs.dnscontrol.org/provider/cloudflareapi)，需要的权限如下：
- Zone → Zone → Read
- Zone → DNS → Edit
- Zone → SSL and Certificates → Edit
- Zone → Page Rules → Edit
- Zone → Single Redirect → Edit
- Account → Workers Scripts → Edit
- Zone → Workers Routes → Edit

### 4. 迁移原有配置
由于我原本已有配置，因此需要将其迁移到 DNSControl 中。

```bash
dnscontrol get-zones --format=js --out=dnsconfig.js cloudflare:alampy.com - alampy.com
```

迁移工具并不完美，**可能需要手动调整生成的配置文件以满足实际需求**。请务必仔细检查并测试迁移后的配置。

{% alertbar info "DNSControl 使用 [robertkrimen/otto](https://github.com/robertkrimen/otto) 作为 JavaScript 解释器，支持绝大多数 ES5 语法，但对于 ES6 支持较差" %}

在手动修正完成后，使用 `dnscontrol preview` 命令查看预览效果。

### 5. 手动推送配置

**首次推送前请务必执行一次 `preview`，以防止意外错误**。验证无误后，使用如下命令将配置推送到 DNS 提供商。

```bash
dnscontrol push
```

### 6. 配置 GitHub Actions
首先获取 git crypt 密钥：
```bash
git-crypt export-key - | base64
```
写入到 secret `GIT_CRYPT_KEY` 中。

然后编写一个如下的 Workflow：
```yaml
name: "Deploy"
on:
  push:
    branches: [ main ]
  workflow_dispatch:
jobs:
  deploy:
    name: Deploy DNS Config
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v5
      - name: Unlock Secrets
        run: |
          # Skip installing package docs
          echo "path-exclude /usr/share/man/*" | sudo tee /etc/dpkg/dpkg.cfg.d/01_nodoc
          sudo apt-get update
          sudo apt-get install git-crypt
          echo "$GIT_CRYPT_KEY" | base64 -d | git-crypt unlock -
        env:
          GIT_CRYPT_KEY: ${{ secrets.GIT_CRYPT_KEY }}
      - name: Deploy DNS Config
        run: |
          docker run --rm -i -v "$(pwd):/dns" ghcr.io/stackexchange/dnscontrol push
```
