---
title: 强制忽略VisualStudio启动时提示的 安装错误
date: 2016-04-22 15:28:18
updated: 2022-03-26 20:18:16
category: 技术
---

> 修复/修改操作未成功完成。请先修复 Visual Studio，然后再继续。可以继续运行 Visual Studio，但是操作可能不可靠。  
> 是否继续运行 Visual Studio?

或者

> 安装操作未成功完成。请重新安装或修复 Visual Studio。

如果你在Windows上运行VisualStudio时提示这些错误，请尝试：

打开注册表编辑器，定位到 `HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\Setup\vs\enterprise`  
这里的`14.0`为版本号，`enterprise`为版本类型。我这里用的是 `VisualStudio 2015 企业版`  
`IsInstallInProgress` 改成`0`（没有请创建，类型：字符串，`REG_SZ`）  
`InstallResult` 改成`0`（没有请创建，类型：字符串，`REG_SZ`）

一个简单的版本号参照：
| 年份版本号 | 内部版本号 |
| ---- | ---- |
| Visual Studio .NET 2002 | 7.0 |
| Visual Studio .NET 2003 | 7.1 |
| Visual Studio 2005 | 8.0 |
| Visual Studio 2008 | 9.0 |
| Visual Studio 2010 | 10.0 |
| Visual Studio 2012 | 11.0 |
| Visual Studio 2013 | 12.0 |
| Visual Studio 2015 | 14.0 | 
| Visual Studio 2017 | 15.0 | 
| Visual Studio 2019 | 16.0 | 

**注意：出现此类提示说明安装、使用VisualStudio的过程中损坏了文件，或在安装过程中取消安装某些组件导致。有些情况下跳过检查可以继续使用VisualStudio；但部分情况下，由于文件损坏，强制跳过检查继续运行也会导致VisualStudio崩溃**