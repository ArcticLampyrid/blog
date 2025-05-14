---
title: 在 Purple Pi OH 鸿蒙开发板上安装中文输入法
date: 2025-05-15 07:05:00
updated: 2025-05-15 07:05:00
category: 技术
---

## 引
由于比赛要求入手了 [Purple Pi OH 鸿蒙开发板](http://www.industio.cn/product-item-37.html)，但其自带的系统是没有中文输入法的，无法输入中文。搜索得知已经有人制作了一个中文输入法（[BV1z24y1w78x：为一加6T的OpenHarmony系统移植简易的中文输入法](https://www.bilibili.com/video/BV1z24y1w78x)），于是尝试安装到我们的开发板上。

## 克隆代码
```shell
git clone https://gitee.com/ohos_port/applications_inputmethod
```

注：本文编写时使用的 commit 为 76fef66bc5bf530a0a3aafbf88e7faa033d7bd6f \(2024-09-28T17:27:19Z\)

## 迁移项目结构
使用 DevEco Studio 5.0.3 打开，会提示：同步失败，需要迁移。

{% asset_image deveco-sync-failed.webp %}

我们直接将项目迁移到最新结构。

{% asset_image deveco-migrate-project.webp %}


## 更改 SDK 版本
由于我已经安装了 SDK 12，为了避免再下载一份 SDK 11，我们修改 SDK 版本为 12。如果你已经安装了 SDK 11，那么不修改应该也行。

修改 `<project-root>/build-profile.json5`：
```json
{
  "compileSdkVersion": 12,
  "compatibleSdkVersion": 12
}
```

修改完成之后，重启一下 IDE 避免问题。

## 修复错误
### 修正 Index 文件名
重命名 `<project-root>/entry/src/main/ets/pages` 目录下的 `index.ets` 文件为 `Index.ets`（注意首字母的大小写）

不知道原 app 为什么会存在这个问题，可能老版本的 OHOS 不区分大小写？

### 添加 armeabi-v7a ABI
修改 `<project-root>/entry/build-profile.json5` 中的 `externalNativeOptions`，添加 `abiFilters` 数组并包含 `armeabi-v7a`：

```json
{
  "externalNativeOptions": {
    "path": "./src/main/cpp/CMakeLists.txt",
    "arguments": "",
    "cppFlags": "",
    "abiFilters": [
      "armeabi-v7a",
      "arm64-v8a"
    ]
  }
}
```

注：Purple Pi 使用的是 RK3568，支持 arm64 架构。但是默认出厂自带的系统是 32 位的，所以我们需要添加 `armeabi-v7a` ABI。

## 处理输入法权限
修改 `<ohos-sdk>/<sdk-version>/toolchains/lib/UnsgnedReleasedProfileTemplate.json` 文件，添加 ACL：
```json
{
  "acls":{
    "allowed-acls":[
      "ohos.permission.CONNECT_IME_ABILITY"
    ]
  }
}
```

然后在 DevEco 中打开 File --> Project Structure --> Signing Configs，勾选 Automatically generate signature，使 DevEco 重新生成一下签名。这样我们对 Profile Template 的修改才会生效。

{% asset_image deveco-generate-signature.webp %}


## 启用输入法
在 DevEco 中点击运行按钮，App 将被自动安装并运行。

{% asset_image deveco-run.webp %}

点击默认输入法后面的 `>`，选择【中文输入法】，点击 `OK`，然后就可以使用了。

{% asset_image deveco-choose-ime.webp %}


## 尾声
效果如下，稍微有点卡，但 it works！

{% asset_image app-preview.webp %}

测试下来这个输入法还是有部分 bug 的，而且看起来似乎已经不在积极维护了。  
但目前 OHOS 生态下很少有可用的中文输入法，除了自己写一个输入法以外，也没有比 [@wathinst](https://gitee.com/wathinst) 开发的这个输入法更好的选择了。
