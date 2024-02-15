---
title: 3.5mm TS接口单声道麦克风转 TRRS 耳麦接口
date: 2023-12-12 16:40:41
updated: 2023-12-12 16:40:41
category: 技术
---
一些奇怪的折腾日志，记录一下。

由于一些简单的录制需要，买了一个[漫步者 IU1 无线麦克风](https://item.jd.com/56010519093.html)，其接收器接口为 3.5mm TS 形式的单声道输出，然而我的电脑只有一个 TRRS 形式的耳麦接口，于是开始折腾转接。

## 一些理论准备
TS 接口（2段）麦克风如下图，非常简单：
{% asset_img ts.svg TS接口 %}

如果插入到 TRS 接口（3段）的立体声麦克风接口，则左声道有信号，右声道没有信号（与 GND 短接）：
{% asset_img ts_trs.svg TRS接口 %}

然而，我所使用的是一台笔记本电脑，没有像台式机一样单独的麦克风接口，只有一个 TRRS 形式（4段）的耳麦接口，如下图：
{% asset_img trrs_omtp_ctia.png TRRS接口 %}

这个接口的标准有两种，OMTP 和 CTIA，两者的信号排列顺序不同，通常电脑的耳麦接口为 CTIA 标准。

## 第一次尝试
首先尝试在淘宝上购买了一个[耳机麦克风一分二头](https://detail.tmall.com/item.htm?id=596326065197)，然后将麦克风接入其中一个接口，但发现麦克风并没有工作。

于是开始研究这个一分二头的原理，发现其实是将 TRRS 的耳麦接口分成了 TRS 的耳机接口和 TRS 的麦克风接口，然后将 TRS 的麦克风接口的左声道和右声道**一起**连接到了 TRRS 的麦克风信号段。然而，由于我的麦克风是 TS 接口的，这种接法会导致最后 TRRS 的麦克风信号短接到了 GND，因此麦克风无法工作。

{% asset_img exp1.svg 第一次尝试电路 %}

## 第二次尝试
又购入了[LR双声道分线器（一公出两母）](https://item.taobao.com/item.htm?id=669970266883)作二次转换，发现该转接器的两个独立声道接口均为 TRS 接口，其中 TRS 的左右声道短接，并分别连接到公口的左右声道，于是 TS 接口插入到母口后，麦克风信号同样短接到了 GND，无法使用。

{% asset_img exp2.svg 第二次尝试电路 %}

## 第三次尝试
购入了[LR双声道分线器（一母出两公）](https://item.taobao.com/item.htm?id=669970266883)作二次转换，麦克风接收器的 TS 公口插入到母口，然后将母口的左声道接到 耳机麦克风一分二头 的麦克风接口，成功。

{% asset_img exp3.svg 第三次尝试电路 %}

## 结论
不得不说 3.5mm 家族比想象得复杂多了。

买个双孔耳麦转 Type-C 的外置声卡，或许会更加简单。🤣