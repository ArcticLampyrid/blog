---
date: 2025-01-28 02:45:00
category: 技术
title: 使用 Qt 开发 macOS 的 UI 元素应用
tag: [Qt]
---
## 前言
macOS 将进程分为两种类型：UI 元素应用（UI Element）和前台应用（Foreground App）。UI 元素应用是一种特殊的应用，其具有不在 Dock 中显示等特性。一个典型的例子是纯托盘应用。

## 使用 `Info.plist` 创建 UI 元素应用
对于已打包的 macOS 应用，其默认应用类型由 Info.plist 文件中的 `LSUIElement` 键值控制。`LSUIElement` 的值为 `true` 时，应用为 UI 元素应用；为 `false` 时（默认），应用为前台应用。

```xml
<key>LSUIElement</key>
<true/>
```

然而这种方法有以下几个问题：
- 无法在运行时动态切换应用类型。
- 对于一个 App Bundle 中包含多个可执行文件的情况，无法为每个可执行文件指定应用类型。

## 通过代码切换应用类型
macOS 提供了 `TransformProcessType` 函数，可以在运行时动态切换应用类型。要将应用切换为 UI 元素应用，只需调用以下代码：

```cpp
#include <Carbon/Carbon.h>

ProcessSerialNumber psn = {0, kCurrentProcess};
TransformProcessType(&psn, kProcessTransformToUIElementApplication);
```

或者切换为前台应用：

```cpp
#include <Carbon/Carbon.h>

ProcessSerialNumber psn = {0, kCurrentProcess};
TransformProcessType(&psn, kProcessTransformToForegroundApplication);
```

## Qt 做了什么
如果你像我一样把切换到 UI Element Application 的代码加到 Qt 应用的 `main` 函数，或许你会发现根本没有生效：

```cpp
int main(int argc, char* argv[]) {
#ifdef __APPLE__
    // Transform the process into a UI element application,
    // which doesn't have a Dock icon or menu bar.
    ProcessSerialNumber psn = {0, kCurrentProcess};
    TransformProcessType(&psn, kProcessTransformToUIElementApplication);
#endif
    QApplication app(argc, argv);
    // do something
    return QApplication::exec();
}
```

通过阅读 Qt [相关代码](https://github.com/qt/qtbase/blob/6.5.0/src/plugins/platforms/cocoa/qcocoaintegration.mm#L133-L139)，发现在 Qt 平台插件中会自动调用 `TransformProcessType` 函数，将应用切换为前台应用（例外是 Qt 检测到了 `Info.plist` 文件）。为了避免 Qt 在这里自作主张，我们可以在 `QApplication` 构造前设置 `QT_MAC_DISABLE_FOREGROUND_APPLICATION_TRANSFORM` 环境变量来避免这种行为：

```cpp
// Prevent Qt being too clever
// See also https://github.com/qt/qtbase/blob/6.5.0/src/plugins/platforms/cocoa/qcocoaintegration.mm#L133-L139
qputenv("QT_MAC_DISABLE_FOREGROUND_APPLICATION_TRANSFORM", "1");

// Transform the process into a UI element application,
// which doesn't have a Dock icon or menu bar.
ProcessSerialNumber psn = {0, kCurrentProcess};
TransformProcessType(&psn, kProcessTransformToUIElementApplication);
```

## 一个真实的例子
sast-evento 2.0 使用了主程序与托盘程序分离的设计，其中托盘程序使用了 Qt 开发。由于两者同时打包在一个 App Bundle 中，因此不能通过 `Info.plist` 文件来指定应用类型。我们通过代码切换应用类型来实现这一目的。

相关代码见 [NJUPT-SAST/sast-evento@94f8c5b2/src/Tray/main.cc#L18-L27](https://github.com/NJUPT-SAST/sast-evento/blob/94f8c5b2c7cb43f6467849d037ea5d5a1deda2b9/src/Tray/main.cc#L18-L27)。
