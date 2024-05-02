---
title: 测试“六度分隔理论”在开往中的表现
date: 2024-05-02 18:23:05
updated: 2024-05-02 18:23:05
category: 技术
excerpt: 你听说过“六度分隔理论”吗？六度分隔理论是一个观点，认为所有人之间通过不超过六层的社交联系就可以相互联系。因此，可以通过一系列的“朋友的朋友”的声明来连接任何两个人，最多不超过六步。
---
## 引
你听说过“六度分隔理论”吗？六度分隔理论是一个观点，认为所有人之间通过不超过六层的社交联系就可以相互联系。因此，可以通过一系列的“朋友的朋友”的声明来连接任何两个人，最多不超过六步。

在[开往](https://www.travellings.cn/)群组中，很早便有人提出了这样一个有趣的想法：根据开往成员的友链信息，来验证“六度分隔理论”在开往中的表现。遗憾的是，由于大部分群友都十分繁忙，这个想法一直没有得到实现。于是我决定自己动手分析看看结果。

## 爬取数据
因为没有统一的格式来交换友情链接数据，这里只能尝试以爬虫的方式获取数据，考虑选择 Python + scrapy 库来实现。爬取数据的大致思路如下：
- 根据成员列表的信息，访问每个成员的起始页面。
- 在每个成员的起始页面中，查找友链页面的链接（主要通过两种方法：匹配 `<a>` 标签的 `href` 属性是否为 `/friends` 等常用友链页面的后缀；匹配 `<a>` 标签包裹的文本是否含有关键词）。
- 如果上述查找失败，尝试查找 “博客” 等关键词，试图先进入二级页面，再查找友链页面的链接。（这一步主要是应对成员列表链接到个人主页，而友链导航需要在博客页面查找的情况）
- 如果上述查找失败，自动更换域名为无 `www` 域名、`www` 域名、`blog` 域名等，再次查找友链页面的链接。（上一步的暴力版本）
- 在友链页面中，定位页面主体内容（通过 `<article>` 、`<main>` 等语义化标签或 `.post` 等常用 class）。
- 提取页面主体内容中的全部 `<a>` 标签，获取友链 URL 信息。

{% alertbox warning "由于这种爬取操作完全是经验性的、技巧性的，故而无法保证获取到准确的信息，只适用于粗略进行分析。" %}

## 数据处理
在爬取到 URL 列表后，为了便于分析，我们需要将这些 URL 转换为一个图（Graph）结构。为方便起见，这里选择了 Python + networkx 库来进行图结构的处理。数据处理的大致思路如下：
- 将爬取到的 URL 数据，根据域名转换为一个有向图，其中每个节点代表一个网站（域名），每条有向边代表一条友链关系。
- 通过 networkx 库提供的方法，计算节点之间的可达性和最短路径长度，并进行统计。

考虑使用 `nx.all_pairs_shortest_path_length` 函数计算全局最短路径（也可以手工实现 Floyd-Warshall 等算法），然后统计每个节点到其它节点（A connect to B）的可达性及其平均最短路径长度。

随后翻转所有边的方向，再次计算得到反向全局最短路径，此时我们可以得到每个节点被多少个节点可达（A is connected by B），及其平均最短路径长度。

注意到，A 被自身可达，因此我们需要将可达节点数量减去 1，得到“真”可达节点数量。

## 代码实现
参见 [GitHub: ArcticLampyrid/travellings-graph](https://github.com/ArcticLampyrid/travellings-graph) （MIT License）

代码仅供参考，可能存在错误或不完善之处，欢迎 Issue 和 PR。

## 结果分析
使用 2024 年 5 月 2 日爬取到的数据，我们得到了如下结果：
{% alertbox warning "请注意，数据可能已过时，结果可能与最新的不同。" %}

附件下载：{% asset_link "data-20240502.zip" %}

{% collapse "数据分析结果（节选）" %}
> - 颢天主页 is connected by 0 nodes, avg. distance 0.00
> - 风之暇想 is connected by 0 nodes, avg. distance 0.00
> - 风吟 is connected by 0 nodes, avg. distance 0.00
> - 飞跃高山与大洋的鱼 is connected by 0 nodes, avg. distance 0.00
> - BinGo's Blog is connected by 1 nodes, avg. distance 1.00
> - DaPeng's Blog is connected by 1 nodes, avg. distance 1.00
> - Legroft is connected by 1 nodes, avg. distance 1.00
> - Sianx's Blog is connected by 1 nodes, avg. distance 1.00
> - YunShu'Blog is connected by 1 nodes, avg. distance 1.00
> - c`Blog is connected by 1 nodes, avg. distance 1.00
> - daodaoshi is connected by 1 nodes, avg. distance 1.00
> - lsilencej の Blog is connected by 1 nodes, avg. distance 1.00
> - rqdmap is connected by 1 nodes, avg. distance 1.00
> - 小新的博客 is connected by 1 nodes, avg. distance 1.00
> - 小白 の 博客 is connected by 1 nodes, avg. distance 1.00
> - 开心果 is connected by 1 nodes, avg. distance 1.00
> - 挨拍的儿 is connected by 1 nodes, avg. distance 1.00
> - 阿岳的博客 is connected by 1 nodes, avg. distance 1.00
> - 阿蛮君博客 is connected by 1 nodes, avg. distance 1.00
> - 风渐远 is connected by 1 nodes, avg. distance 1.00
> - Yamdr is connected by 2 nodes, avg. distance 1.50
> - 倚栏听风 is connected by 2 nodes, avg. distance 1.50
> - COOL is connected by 2 nodes, avg. distance 1.00
> - 五叶魔法书 is connected by 2 nodes, avg. distance 1.00
> - 奇异维度 is connected by 2 nodes, avg. distance 1.00
> - MoYi's Blog is connected by 324 nodes, avg. distance 9.80
> - zisu.dev is connected by 324 nodes, avg. distance 9.80
> - ZigZagK 的博客 is connected by 323 nodes, avg. distance 8.83
> - 晨旭的博客 is connected by 323 nodes, avg. distance 7.84
> - CairBin's Blog is connected by 323 nodes, avg. distance 7.83
> - Sonic853 is connected by 323 nodes, avg. distance 6.84
> - CHI's blog is connected by 324 nodes, avg. distance 6.85
> - K'Blog is connected by 323 nodes, avg. distance 6.76
> - Sorryfu is connected by 324 nodes, avg. distance 6.76
{% endcollapse %}

可以看到，开往成员的友链状态主要分为两大类，一些网站基本属于孤岛状态（这其中有部分是因为爬取失败或博主没有设置友链界面导致的），而另一类网站则几乎都能通过不超过 6 步的友链关系连接到任何一个网站（就像“六度分隔理论”描述的那样）。

不难看出，添加友链是一种促进信息传播、避免信息孤岛、提高个人表达可见性的有效方式，也是维系独立博客社区的重要手段。

**那么，你打算和我交换友链吗～**
