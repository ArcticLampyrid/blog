---
title: 通过 GitHub Actions 为部署在 Fleek 的博客集成 WebSub
date: 2022-06-25 21:31:05
category: 技术
toc: true
---
## 关于 WebSub
[WebSub](https://w3c.github.io/websub/) (也称作 PubSubHubbub)，是对 RSS/Atom 的一次扩展，为订阅者提供了更新推送的功能
对于博主而言，使用WebSub需要三个步骤：
1. 首先选取一个Hub，如公共Hub：
   ```
   https://pubsubhubbub.appspot.com/
   ```
2. 然后在 RSS/Atom 中增加一个 tag，比如在 Atom 中为 
   ```xml
   <link href="https://pubsubhubbub.appspot.com/" rel="hub"/>
   ```
3. 每次更新完 RSS/Atom 后通知 Hub
   ```bash
   curl -i https://pubsubhubbub.appspot.com/ -F "hub.mode=publish" -F "hub.url=https://alampy.com/atom.xml"
   ```

注：Hub 是负责传达推送的服务设施，用户向 Hub 订阅通知（WebHook 形式），Blog 通知 Hub 有更新，Hub 将这一讯息传达给所有订阅者

## 使用 GitHub Actions 为 Fleek 的部署提供通知
本站使用了支持 IPFS 部署的 [Fleek](https://fleek.co/) 作为静态页面托管商
{% alertbox info "ps: 本站域名解析部署了 [DNSLink](https://dnslink.io/)，支持通过 IPFS 访问哦。在安装了 IPFS Companion 插件的浏览器，会自动通过 IPFS 网关获取本站数据哦" %}

截止到 2022-06-25，[Fleek](https://fleek.co/) 并没有提供原生的 WebHook，我们无法直接利用其通知
但 Fleek 关联 GitHub 仓库后会自动产生 check 信息（即 GitHub 上的那个小勾），我们可以利用这一点，将 GitHub Actions 的触发条件设置为 check run completed 来变现实现部署完成的通知，以便通知 Hub
```yaml
name: WebSub

on:
  check_run:
    types: [completed]
jobs:
  publish:
    runs-on: ubuntu-latest
    if: github.event.check_run.name == 'fleek-ci'
    steps:
      - name: Publish
        run: curl -i https://pubsubhubbub.appspot.com/ -F "hub.mode=publish" -F "hub.url=https://alampy.com/atom.xml"
```

## 为 Atom 添加 `rel="hub"`
本站使用的是 Hexo，`hexo-generator-feed` 为 WebSub 提供了良好的支持，只需要将 `hub` 属性设置一下即可增加相关 tag
```yaml
feed:
  enable: true
  type: atom
  path: atom.xml
  hub: https://pubsubhubbub.appspot.com
```