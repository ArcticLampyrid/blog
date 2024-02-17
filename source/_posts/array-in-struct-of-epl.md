---
title: 关于易语言 struct 中数组的结构
date: 2018-12-16T10:40:05+08:00
updated: 2024-02-18T02:51:25+08:00
category: 技术
---
> 本文原发布于旧版博客，现重新发布于新版博客。

下面信息来源于逆向和实验，并非来源于文档定义，可能会在未来的版本中有所变化：
1. 易 struct 中的数组有别于 C++ struct 中的数组，实际是个指向带下标等信息的数组结构（`array_data`）的指针（`array_data*`）。  
   数组结构 `array_data` 的内存布局为：
    - `uint32_t dim;`：数组维度
    - `uint32_t length[dim];`：第 i 维的元素数
    - `elem_type data[count];`：数组数据，其中 $\mathrm{count} = \prod_{i=0}^{\mathrm{dim} - 1} \mathrm{length}[i]$。
2. 易 struct 中的数组，不允许在声明时设定下标为 `0`（运行可重定义为 0）。
3. 在调用 FFI (eg. Win32 API / C Library Function) 时，为了使外部函数接口可以识别相关结构，易会生成一个中间 struct 再传递给外部函数，其封送（marshal）规则包括使用 1 字节对齐规则、数组成员嵌入结构体（C-style）等。其中对于数组，**封送时所依据的成员数信息是【声明时提供的下标】，而非【运行时数组结构中的成员数数据】**，因此此时【数组成员数】应保证大于等于【声明时提供的下标所计算出的成员数】，否则会出现内存越界访问，后果不可预料。
4. 易 struct 中的【传址】属性对数组（在封送数据时用 `elem_type* array` 代替 `elem_type array[N]` ）、数值型、用户自定义其他结构体类型均有效，但对文本型（始终传递 `const char*`）、字节集（始终传递 `const uint8_t*`）无效。
