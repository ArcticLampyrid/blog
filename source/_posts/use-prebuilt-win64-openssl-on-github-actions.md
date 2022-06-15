---
title: 在GitHub Actions中使用预编译的OpenSSL
date: 2022-06-15 23:04:52
category: 技术
---
#### 思路
先卸载 openssl.light 包再安装完整的 openssl  
由于 choco 的 openssl 无法自定义安装路径，故而直接从 [slproweb](https://slproweb.com/) 下载 prebuilt 的安装包

#### 代码
自动安装最新版本 OpenSSL（目前为3.x）
```yaml
- if: ${{ env.isWindows == 'true' }}
name: Install OpenSSL
run: >
    choco uninstall openssl.light ;
    $installer_url = (Invoke-WebRequest https://raw.githubusercontent.com/slproweb/opensslhashes/master/win32_openssl_hashes.json ).Content 
    | jq --raw-output '.files | to_entries | map(select(.key | test(\"^.*Win64OpenSSL-.*\\.exe$\"))) | max_by(.key) | .value.url' ;
    Invoke-WebRequest -OutFile Win64OpenSSL.exe $installer_url ;
    Start-Process -FilePath ./Win64OpenSSL.exe -ArgumentList "/silent","/sp-","/suppressmsgboxes","/DIR=C:\OpenSSL" -Wait; 
    C:\OpenSSL\bin\openssl.exe version
shell: pwsh
```