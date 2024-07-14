---
title: 禁用 WeChat UOS 的快捷键
date: 2024-07-15 02:37:00
updated: 2024-07-15 02:37:00
category: 技术
tags: [Linux]
---
## 引
WeChat UOS 使用了 Alt+A 快捷键作为全局截图快捷键，而我习惯使用 Alt+A 作为浏览器『沉浸式翻译』扩展的快捷键。因此，我希望禁用 WeChat UOS 的快捷键。遗憾的是，WeChat UOS 并没有提供设置界面来修改快捷键，因此我们只能尝试使用一些非常规方法。

其实咱知道这个问题很久了，但因为博主很少使用微信，所以一直拖延到了现在。由于最近正在参与一个偏向学术方向的小比赛项目，常常需要使用微信和导师、队友进行沟通 {% blur "（为什么要用微信这种难用的东西啊🥹）" %}，并且在沟通的同时可能还在使用浏览器查找资料（这些资料往往涉及咱非常不熟悉的领域，常常需要用到翻译插件），因此这个问题就变得尤为突出了。

## 原理
WeChat UOS 是基于 X Windows 系统的旧式 X11 应用程序，而旧时 X11 应用程序的快捷键往往依靠以下方法处理：
- 通过 Xlib `XGrabKey` 函数来捕获按键事件，只要给函数传递一个 Root Window，就可以在整个 X Windows 系统中捕获按键事件。
- 通过事件循环中的 `KeyPress` 和 `KeyRelease` 事件来处理按键事件。WeChat UOS 是通过 Qt 框架的 xcb 平台插件来与 X Windows 系统交互的，因此我们可以修改 `xcb_wait_for_event` 函数来拦截事件循环中的某些事件。

因此，想要禁止 WeChat UOS 的快捷键，我们需要：
- 阻止 WeChat UOS 调用 `XGrabKey` 函数捕获全局按键事件。
- 拦截事件循环中特定按键的 `KeyPress` 和 `KeyRelease` 事件，阻止 WeChat UOS 处理按键事件。（即使阻止了 `XGrabKey`，当我们位于 WeChat UOS 主界面时，WeChat UOS 也会捕获到相关快捷键的发生，因此我们还需要拦截事件循环中的特定按键的按键事件）

对于一个动态连接的 ELF 文件，我们可以采用以下方法对库文件的函数进行覆盖和修改：
- 与 Windows 下的 PE 文件导入表不同，ELF 文件动态符号表中的符号并不与库文件一一关联。即假设 ELF 文件依赖 `liba.so` 和 `libb.so`（前者早于后者加载），且调用了 `libb.so` 中的函数 `foo`，那么当我们为 `liba.so` 编写一个同名函数 `foo` 时，`liba.so` 中的 `foo` 会覆盖 `libb.so` 中的 `foo`，此时原先编译好的 ELF 文件就会调用 `liba.so` 中的 `foo`。类似的，我们可以通过编写同名函数来覆盖 Xlib 和 Xcb 的相关函数，从而实现我们的目的。
- 当一个动态连接的 ELF 文件被加载时，我们可以通过 `LD_PRELOAD` 环境变量来强制加载一个编译好的共享库，这个共享库的优先级更高，因此会覆盖原本的库文件中的函数。此外，在这个共享库中。我们可以通过 `dlsym(RTLD_NEXT, "foo")` 来获取原本库文件中函数的地址，从而在我们的函数中调用原库文件中的函数。

## 实现
我们编写以下 C++ 代码，编译为共享库，然后通过 `LD_PRELOAD` 环境变量来加载这个共享库。这个共享库会拦截 WeChat UOS 的快捷键。

```cpp hotkey_blocker.cpp
#include <X11/Xlib.h>
#include <X11/XKBlib.h>
#include <stdio.h>
#include <dlfcn.h>
#include <xcb/xcb.h>
#include <unordered_set>

struct pair_hash
{
public:
    template <typename T, typename U>
    auto operator()(const std::pair<T, U> &x) const
    {
        return std::hash<T>()(x.first) ^ std::hash<U>()(x.second);
    }
};

static std::unordered_set<std::pair<int, unsigned int>, pair_hash> blocked_hotkeys;

extern "C" int XGrabKey(
    Display *display,
    int keycode,
    unsigned int modifiers,
    Window grab_window,
    Bool owner_events,
    int pointer_mode,
    int keyboard_mode)
{

    blocked_hotkeys.insert({keycode, modifiers});
    printf("Hotkey registration blocked: keycode=%d modifiers=%d\n", keycode, modifiers);
    return 0;
}

extern "C" int XUngrabKey(
    Display *display,
    int keycode,
    unsigned int modifiers,
    Window grab_window)
{
    blocked_hotkeys.erase({keycode, modifiers});
    printf("Hotkey unregistration blocked: keycode=%d modifiers=%d\n", keycode, modifiers);
    return 0;
}

static bool filter_xcb_event(xcb_connection_t *c, xcb_generic_event_t *event)
{
    if (event != nullptr)
    {
        if (event->response_type == XCB_KEY_PRESS)
        {
            auto key_press = reinterpret_cast<xcb_key_press_event_t *>(event);
            if (blocked_hotkeys.find({key_press->detail, key_press->state}) != blocked_hotkeys.end())
            {
                printf("Hotkey event blocked: type=press detail=%d state=%d\n", key_press->detail, key_press->state);
                return false;
            }
        }
        else if (event->response_type == XCB_KEY_RELEASE)
        {
            auto key_release = reinterpret_cast<xcb_key_release_event_t *>(event);
            if (blocked_hotkeys.find({key_release->detail, key_release->state}) != blocked_hotkeys.end())
            {
                printf("Hotkey event blocked: type=release detail=%d state=%d\n", key_release->detail, key_release->state);
                return false;
            }
        }
    }
    return true;
}

extern "C" xcb_generic_event_t *xcb_wait_for_event(xcb_connection_t *c)
{
    static auto origin = reinterpret_cast<decltype(&xcb_wait_for_event)>(dlsym(RTLD_NEXT, "xcb_wait_for_event"));
    xcb_generic_event_t *event;
    do
    {
        event = origin(c);
    } while (!filter_xcb_event(c, event));
    return event;
}

extern "C" xcb_generic_event_t *xcb_poll_for_event(xcb_connection_t *c)
{
    static auto origin = reinterpret_cast<decltype(&xcb_poll_for_event)>(dlsym(RTLD_NEXT, "xcb_poll_for_event"));
    xcb_generic_event_t *event;
    do
    {
        event = origin(c);
    } while (!filter_xcb_event(c, event));
    return event;
}
```

相关编译脚本：
```cmake CMakeLists.txt
cmake_minimum_required(VERSION 3.10)
project(hotkey_blocker)
set(CMAKE_STATIC_LIBRARY_PREFIX "")
set(CMAKE_SHARED_LIBRARY_PREFIX "")
add_library(hotkey_blocker SHARED hotkey_blocker.cpp)
```

编译命令：
```bash
cmake -S . -B build -G "Ninja"
cmake --build build
```

之后我们就得到了一个名为 `hotkey_blocker.so` 的共享库。通过以下命令来启动 WeChat UOS 即可拦截快捷键：
```bash
LD_PRELOAD=/path/to/hotkey_blocker.so /path/to/wechat-uos
```

## 与 AUR `wechat-uos-bwrap` 包共同使用
如果您和咱一样正在使用 Arch Linux 的 [`wechat-uos-bwrap` 包](https://aur.archlinux.org/packages/wechat-uos-bwrap)来隔离运行 WeChat UOS ，那么您可以通过以下方法集成上述共享库：
1. 把 `hotkey_blocker.so` 文件放到 `/home/YOUR_USERNAME/.local/share/WeChat_Data/` 目录下。
2. 修改同目录下的 `wechat.env` 文件，添加以下内容：
   ```ini
   # 注意到 ~/.local/share/WeChat_Data/ 目录在隔离环境中将被挂载到 ~/ 目录，而下面的路径应是处于隔离环境中的路径
   LD_PRELOAD=/home/YOUR_USERNAME/hotkey_blocker.so
   ```
3. 重新启动 WeChat UOS 即可。

