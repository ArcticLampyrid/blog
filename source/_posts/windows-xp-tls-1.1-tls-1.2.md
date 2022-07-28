---
date: 2022-07-28T20:18:13+08:00
updated: 2022-07-28T20:18:13+08:00
category: 技术
toc: true
title: Windows XP 下使用 TLS 1.1 及 TLS 1.2
---
***若无特殊需要，我们强烈建议您不要使用 Windows XP 系统***

## 更新根证书
安装 [KB931125](http://www.itmop.com/downinfo/401846.html) 更新根证书  
运行 `rootsupd.exe` ，注：无反应为正常现象（该程序为全静默运行）

## 安装 TLS 1.1/1.2 加解密组件
1. 将 XP 系统伪造为 POSReady 以便接收延长更新（导入以下注册表信息）
   ```
   Windows Registry Editor Version 5.00 
   [HKEY_LOCAL_MACHINE\SYSTEM\WPA\PosReady] 
   "Installed"=dword:00000001
   ```
2. 安装 [KB4019276](https://www.catalog.update.microsoft.com/search.aspx?q=kb4019276)，选择 Products 为 `Windows XP Embedded` 的一项点最右边的 `Download`
3. 启用 TLS 1.1/1.2（导入以下注册表信息）
   ```
   Windows Registry Editor Version 5.00
   [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Client]
   "DisabledByDefault"=dword:00000000
   
   [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.1\Server]
   "DisabledByDefault"=dword:00000000
   
   [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Client]
   "DisabledByDefault"=dword:00000000
   
   [HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\SecurityProviders\SCHANNEL\Protocols\TLS 1.2\Server]
   "DisabledByDefault"=dword:00000000
   ```

## 为 WinHttp 启用 TLS 1.1/1.2 支持
1. 安装 [KB4467770](https://www.catalog.update.microsoft.com/Search.aspx?q=KB4467770)，选择 Products 为 `Windows XP Embedded` 的一项点最右边的 `Download`
2. 导入以下注册表信息
   ```
   Windows Registry Editor Version 5.00                
   [HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\Internet Settings\WinHttp]
   "DefaultSecureProtocols"=dword:00000a80
   ```

## 为 IE8 启用 TLS 1.1/1.2 支持
1. 安装 [KB4316682](https://www.catalog.update.microsoft.com/Search.aspx?q=KB4316682) 和 [KB4230450](https://www.catalog.update.microsoft.com/search.aspx?q=KB4230450) ，均选择 Products 为 `Windows XP Embedded` 的一项点最右边的 `Download`
2. 导入以下注册表信息
   ```
   Windows Registry Editor Version 5.00
   [HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Internet Explorer\AdvancedOptions\CRYPTO\TLS1.1]
   "OSVersion"="3.5.1.0.0"
   
   [HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Internet Explorer\AdvancedOptions\CRYPTO\TLS1.2]
   "OSVersion"="3.5.1.0.0"
   ```
3. 打开 IE 选项，在 高级 选项卡下会出现 `使用 TLS 1.1` 和 `使用 TLS 1.2`，勾选即可

## 临门一脚
以上所有修改完成后务必重启一次