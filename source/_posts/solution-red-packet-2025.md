---
title: 2025 解谜红包解谜思路
date: 2025-01-30 00:22:00
updated: 2025-01-30 00:22:00
category: 技术
toc: true
---
## 谜面
详见 {% post_link life/20-2024-wrapped %}

## 解谜方法
### 阅读题面
1. 来自**通信工程**学生的新年祝福：暗示了本次解谜可能需要用到一些**通信**或**信号**相关的知识。
2. check the image below：表明解谜的关键是图片。
3. 音乐播放器的 iframe 具有属性 `data-hint="caesar"`：暗示了解谜可能涉及到凯撒密码。

### 图片分析
观察题目中的图片，发现在四周具有明显的失真干扰，结合题面中的暗示，易推测我们需要对图片进行**信号处理**。
使用如下 Python 代码对图片进行二维傅里叶变换（AI-assisted）：

```python
import numpy as np
import cv2

image = cv2.imread('RedPacket2025.webp')

image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)

height, width, _ = image_rgb.shape

def to_spectrum(channel):
    channel_float32 = np.float32(channel)
    dft = cv2.dft(channel_float32, flags=cv2.DFT_COMPLEX_OUTPUT)
    magnitude = cv2.magnitude(dft[:, :, 0], dft[:, :, 1])
    magnitude_log = 20 * np.log(magnitude)
    return magnitude_log

red_spectrum = to_spectrum(image_rgb[:, :, 0])
green_spectrum = to_spectrum(image_rgb[:, :, 1])
blue_spectrum = to_spectrum(image_rgb[:, :, 2])

def normalize_spectrum(spectrum):
    return (spectrum - np.min(spectrum)) / (np.max(spectrum) - np.min(spectrum))

red_spectrum = normalize_spectrum(red_spectrum)
green_spectrum = normalize_spectrum(green_spectrum)
blue_spectrum = normalize_spectrum(blue_spectrum)

rgb_spectrum = np.dstack([red_spectrum, green_spectrum, blue_spectrum])
rgb_spectrum = np.uint8(rgb_spectrum * 255)
rgb_spectrum_bgr = cv2.cvtColor(rgb_spectrum, cv2.COLOR_RGB2BGR)

cv2.imwrite('spectrum.png', rgb_spectrum_bgr)

cv2.namedWindow("Spectrum Image", cv2.WND_PROP_FULLSCREEN)
cv2.setWindowProperty("Spectrum Image", cv2.WND_PROP_FULLSCREEN, cv2.WINDOW_FULLSCREEN)
cv2.imshow('Spectrum Image', rgb_spectrum_bgr)

while True:
    if cv2.waitKey(0) & 0xFF == 27:
        # ESC Key
        break

cv2.destroyAllWindows()
```

观察频谱图，易看到如下内容：
{% asset_img spectrum_roi.webp "频谱图（关键局部）" %}

提取出关键信息：
```
service binding record for rdpkt2025.alampy.com
```

### DNS 查询
易知 `rdpkt2025.alampy.com` 是一个域名，同时又暗示了我们需要使用 service binding record。

> 服务绑定（SVCB）记录用于提供对服务具有权威性的替代端点（有点类似 CNAME），以及与每个端点**关联**的参数（这个是重点，这样可以给每个端点指定 ALPN、ECH 公钥等信息）。具体功能可以参见涛叔的 [DNS SVCB/HTTPS 记录介绍](https://taoshu.in/dns/dns-svcb-https.html)

使用 `dig` 命令查询该域名的 SVCB 记录：

```bash
# 需要你的 DNS 服务器支持 SVCB 记录查询
dig +short rdpkt2025.alampy.com SVCB
```

得到如下结果：
```
1 alampy.com. alpn="synt{nynzcl97q8q26oq6p2}\032symmetric\032rotation"
```

### Rot13 解密
根据 SVCB 记录中的信息，我们需要对 `synt{nynzcl97q8q26oq6p2}` 进行解密，我们共有两个 hint：
1. `symmetric rotation`：表明我们需要使用具有某种对称性的轮换密码。
2. `caesar`：表明我们需要使用凯撒密码。

结合以上信息，易推测使用 Rot13（即移位量 = 13 的凯撒密码）解密：

```python
import codecs

ciphertext = 'synt{nynzcl97q8q26oq6p2}'
plaintext = codecs.decode(ciphertext, 'rot_13')

print(plaintext)
```

得到解密结果：
```
flag{alampy97d8d26bd6c2}
```

### 解谜结果
最终解密结果 `alampy97d8d26bd6c2` 即为支付宝拼手气口令红包的口令。  
由于 DNS 缓冲问题，有部分时间可能会解出测试 flag `alampy42d*********`，如有这种情况的可以找我手动领取红包。
