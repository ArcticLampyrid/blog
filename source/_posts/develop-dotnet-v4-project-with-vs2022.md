---
title: 在 VS2022 中编辑 .NET 4.0 项目
date: 2024-02-17 01:24:25
updated: 2024-02-17 01:24:25
category: 技术
---
## 问题
试图打开一个 old-style 的 .NET 4.0 项目（远古遗迹）时，VS2022 提示需要安装 .NET Framework 4.0 开发工具包，但是 4.0 并没有现代的 .NET SDK 安装程序。
<!--more-->

在 VS2019 及以前，此包通常是通过 Visual Studio 组件中的 .NET Framework 4.0 Targeting Pack 来安装的，但是 VS2022 Installer 已经不提供 4.5 以下的 Targeting Pack 了。

## 解决方案
1. 手动下载 .NET Framework 4.0 的引用程序集（Reference Assemblies）：  
   打开 [NuGet Gallery | Microsoft.NETFramework.ReferenceAssemblies.net40](https://www.nuget.org/packages/microsoft.netframework.referenceassemblies.net40)，点击右边栏的 `Download package` 下载 NuGet 包（`.nupkg` 文件）
2. 删除 `C:\Program Files (x86)\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.0` 目录下的现有文件（以防万一，建议做好备份）
3. 解压 NuGet 包（NuGet 包是 zip 格式的压缩包），将其中 `build/.NETFramework/v4.0/` 下的文件复制到 `C:\Program Files (x86)\Reference Assemblies\Microsoft\Framework\.NETFramework\v4.0` 目录下

## 参考
- [Reddit: The comment on How to use .NET Framework 4.0-4.5 in VS2022 by @Riskeez](https://www.reddit.com/r/VisualStudio/comments/qyfio0/comment/hmxr90v/?utm_source=share&utm_medium=web2x&context=3)
