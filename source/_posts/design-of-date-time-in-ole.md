---
title: OLE 中 日期时间型(OLEDate) 的设计
date: 2022-03-08 22:42:21
updated: 2022-03-08 22:42:21
category: 技术
---
## 基本信息
在 OLE 中，对于时间的存储，传统上采用 `OLEDate` (或称 `COMDateTime` / `OADate`) 格式  

## 数据格式
`OLEDate` 在底层使用浮点类型 `double` (IEEE 754 binary64) 存储数据  
| 整数部分 及 符号 | 小数部分 |
| ---- | ---- |
| 自 1899-12-30 至今的天数（负数表示 1899-12-30 之前） | 所在天已流经的时间（如 0.5 表示正午 12 时，0.75 表示 18 时） |

### 特别注意
***即使数值为负值，其小数部分所代表的时间仍然按照正值意义解释***  
即：  
```python
# Sign = -1 or 1
# IntegralPart >= 0
# 0 <= FractionalPart < 1
DayOffest = (Sign * IntegralPart) + FractionalPart
```
例如：
- -1.25 **并不**代表 1899-12-30 向负方向推进 1.25 天（所得结果为 `1899-12-28 18:00:00 24小时制`）
- -1.25 实际代表 1899-12-30 向负方向推进 1 天，再向正方向推进 0.25 天（所得结果为 `1899-12-29 06:00:00 24小时制`）  

## 互操作性
.NET 程序可通过 `FromOADate` / `ToOADate` 与之进行互操作  
VB6 / 易语言 的 日期时间 均使用 `OLEDate` 格式存储  
COM / OLE 组件所用的标准日期时间型即为 `OLEDate`   
C++ 中可用 `COleDateTime` （MFC组件，虽然并不推荐使用MFC）处理，也可自行根据数据格式处理  
Win32 中可使用 SDK 函数 `VariableTimeToSystemTime` 解析数据