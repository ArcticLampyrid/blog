---
title: JSONArray 实现兼容老版本API的remove方法
date: 2016-04-02 15:12:32
category: 技术
---
## 前言
remove是在API level 19时加入的，在低版本调用时会出现错误。这里用反射实现了在低版本安卓上用的remove方法

## 代码
```java
public void JSONArray_Remove(int index, JSONArray jsonArray) throws Exception{
	if(index < 0)
		return;
	Field valuesField = JSONArray.class.getDeclaredField("values");
	valuesField.setAccessible(true);
	List<Object> values = (List<Object>)valuesField.get(jsonArray);
	if(index >= values.size())
		return;
	values.remove(index);
}
```

## 建议
真正使用时建议判断下API level，如果>=19则调用新版本增加的remove，否则使用此方法