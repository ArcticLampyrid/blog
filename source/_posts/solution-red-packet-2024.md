---
title: 2024 解谜红包解谜思路
date: 2024-02-11 01:00:00
updated: 2024-02-11 01:00:00
category: 技术
toc: true
---
## 谜面
详见 [2023 年度总结（附解谜红包）](life/15.md)

## 解谜方法
### 获取 zip 文件
2024 解谜红包仅提供一张图片，和 “Check the image file!” 的提示。
根据提示，我们使用二进制编辑器检查图片文件：这里使用 010 Editor 打开图片文件，010 Editor 内置了很多文件格式的解析器，可以结构化地查看文件内容。  
{% asset_img 010editor_of_image.webp %}

易发现，文件末尾存在标记为 unknownPadding 的数据，从未知部分的开头 PK\3\4 猜测，这是一个 zip 文件。

将 unknownPadding 的数据保存为 zip 文件，并使用解压缩软件打开。

> 部分解压缩软件如 WinRAR/Bandizip 等，支持直接读取从文件中间部分开始的 zip 文件，此时只需要直接改扩展名为 zip 即可。

### 解密 zip 文件
打开 zip 文件后，发现其中文件均加密，但从注释中可以看到密码提示：  
{% asset_img zip_password_hint.webp %}  
易发现这是 Base64 编码，解码易得：  

```
Python 3.11.0 (main, Oct 24 2022, 18:26:48) [MSC v.1933 64 bit (AMD64)] on win32
Type "help", "copyright", "credits" or "license" for more information.
>>> import base64
>>> base64.b64decode("cmVhZHRoZWRlc2NyaXB0aW9u")
b'readthedescription'
```

使用 readthedescription 作为密码解压缩 zip 文件，失败，但易发现该注释为如下英文：
> Read the description

考虑到 zip 文件中的其它数据已经被加密，因此易猜测该描述是指图片文件的描述。继续分析图片文件，检查图片 EXIF 信息。  
使用 exiftool 查看图片文件的 EXIF 信息，发现其中存在如下信息：  
{% asset_img exif_metadata.webp %}

易发现两个信息：
- doubtisthekeytoknowledge
- RedPacket2024

测试易得第一个信息为密码，使用 `doubtisthekeytoknowledge` 作为密码解压缩 zip 文件，成功解压缩。

### 运行 get_code 代码
这一部分提供了 Python 和 Node.js 两种代码，功能完全一致，均为获取下一步信息。

直接运行要求我们提供一个密钥，查看代码（以 Python 为例）发现如下逻辑：
```python
key = input("Press your key: ").encode("utf-8")
if xor_bytes(key, b"red-packet") != b"alampy.com":
	print("Key error")
	quit()
```

易发现，我们需要找到一个密钥 $k$，使得 $k \oplus \text{red-packet} = \text{alampy.com}$ 成立。  
由于异或运算的性质，我们可以得到 $k = \text{alampy.com} \oplus \text{red-packet}$。

代入后运行代码，得到如下输出：
```
TXT: redpacket2024.alampy.com
```

### 通过域名获取数据
打开浏览器，访问 redpacket2024.alampy.com，发现重定向到了 [RFC1035 规范文档](https://datatracker.ietf.org/doc/html/rfc1035)，易推测该域名需要使用非常规方法使用。结合上一步提示的 `TXT`，我们使用 `nslookup` 命令获取该域名的 `TXT` 记录：
```
> nslookup -q=txt redpacket2024.alampy.com 8.8.8.8
服务器:  dns.google
Address:  8.8.8.8

非权威应答:
redpacket2024.alampy.com        text =

        "red-packet-2024-38206469676974732c20313937312d30352d32335430373a31373a30335a"
```

Linux 下可以使用 `dig` 命令获取：
```
$ dig TXT redpacket2024.alampy.com

; <<>> DiG 9.18.18-0ubuntu0.22.04.1-Ubuntu <<>> TXT redpacket2024.alampy.com
;; global options: +cmd
;; Got answer:
;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 22995
;; flags: qr rd ra; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 0

;; QUESTION SECTION:
;redpacket2024.alampy.com.      IN      TXT

;; ANSWER SECTION:
redpacket2024.alampy.com. 298   IN      TXT     "red-packet-2024-38206469676974732c20313937312d30352d32335430373a31373a30335a"

;; Query time: 0 msec
;; SERVER: 127.0.0.42#53(127.0.0.42) (UDP)
;; WHEN: Sat Feb 10 20:42:42 CST 2024
;; MSG SIZE  rcvd: 131
```

易得到数据
```
red-packet-2024-38206469676974732c20313937312d30352d32335430373a31373a30335a
```

### 解密 TXT 记录获得口令
易发现该数据在去除前缀 `red-packet-2024-` 后是一个十六进制字符串，解码后得到如下数据：
```
8 digits, 1971-05-23T07:17:03Z
```

提示中的 `8 digits` 表明我们需要一个 8 位数字，但后续的数据却是一个 [RFC3339 格式的时间](https://datatracker.ietf.org/doc/html/rfc3339)。考虑到 1971 并不是一个常见的年份，且与 Unix Epoch 接近。而时间的一种常规表示方法是 Unix 时间戳，因此我们猜测口令为 Unix 时间戳。

将 1971-05-23T07:17:03Z 转换为 Unix 时间戳，得到 `43831023`，即为口令。

进入支付宝红包页面，输入口令，即可获得红包。

## 杂项
- 红包领取率：8 / 10
- 根据群聊消息，有大佬用 ~15 分钟似乎就解出来了。
- 开头这种把 zip 文件藏到 jpg 文件的方法，与 BT 时代的图种技术（参见[萌百相关词条](https://zh.moegirl.org.cn/zh-cn/%E5%9B%BE%E7%A7%8D)）有异曲同工之妙，大概有不少人会直接猜测到。
- 本谜不需要涉及 Bit plane、FFT 等高阶图像隐写技术。如果您尝试使用这些技术，很抱歉浪费了您的时间。
- 红包主要分享在了以下地方：
  - 本博客
  - QQ 空间
  - [elec-wiki](https://elec.alampy.com/) 相关群 [上电冒烟俱乐部](https://qm.qq.com/q/32f61gec3K)
  - [一言](https://hitokoto.cn/) 作者萌创团队（MoeTeam）的交流群  
  - [@Innei](https://innei.in/) 大佬的个人 QQ 群
  - [@社会易姐QwQ](https://shakaianee.top/) 的同好群
  - [SAST](https://sast.fun/) C++ 组 QQ 群
  - 陈钰的水群
