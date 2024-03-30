---
title: '简介 C++ 的 #include 检查工具 IWYU'
date: 2024-03-30T19:03:00+08:00
updated: 2024-03-30T19:03:00+08:00
category: 技术
toc: true
---
## 缘起
前段时间试图给 CMake 贡献代码（[MR #9348](https://gitlab.kitware.com/cmake/cmake/-/merge_requests/9348)），在 CI 中遇到了一个没有见过的 C++ 代码检查工具 [Include What You Use (IWYU)](https://include-what-you-use.org/) 的报错，故仔细研究了一下这个工具。

## 什么是 IWYU
顾名思义，IWYU 是一个检查 C/C++ 代码中的 `#include` 语句是否合理的工具。那么，什么样的 `#include` 语句是合理的呢？

## 合理的 `#include` 语句
IWYU 默认认为符合如下规则的 `#include` 语句是合理的：

### 不应该包含不需要的头文件
这是显然的。

### 不应该依赖于其他头文件的间接包含
假设我们有如下代码：
```cpp
// MyData.h
#include <vector>
class MyData {
    std::vector<int> data;
};
```

则：
```cpp
// main.cpp
#include <MyData.h>
#include <vector>   // 应该添加这一行，即使 MyData.h 中已经包含了 <vector>
int main() {
    MyData data;
    std::vector<int> vec;
    return 0;
}
```

### 尽可能使用前置声明（Forward Declaration）替代 `#include` 语句
**这一条有争议**，IWYU 也提供了关闭这一规则的选项。
```cpp
#include <MyData.h>   // 不合理
class MyData;         // 合理

void func(MyData* data);
```

## 为什么要使用 IWYU
### 更快的编译速度
当编译一个源文件时，每引入一个 .h 文件都会增加编译时间。如果你实际上没有使用一个 .h 文件，删除这个文件将避免这种时间成本。对于模板代码来说，其完整代码必须放在 .h 文件中，这可能涉及数十万字节的代码。根据 Google 的某个使用案例，使用 IWYU 可以减少某些文件 30% 的编译时间。

这里，IWYU 的主要好处来源于它的反面：不包含你不使用的。

### 避免不必要的重新编译
许多构建工具的自动依赖分析机制通常会追踪 `#include` 指令。当列出不必要的 `#include` 时，构建系统可能会错误地认为某个文件需要重新编译，从而导致不必要的重新编译。

这里，IWYU 的主要好处仍然来源于它的反面：不包含你不使用的。

### 避免隐式依赖，便于重构
假设原有 `foo.h` 文件中包含了 `#include <vector>`，而重构后的 `foo.h` 不再需要使用 `std::vector`，那么理论上你可以将 `#include <vector>` 从 `foo.h` 中移除。但实践中可能不行：某些大量使用 `std::vector` 的代码可能正在通过 `#include <foo.h>` 获取 `std::vector`的声明，从而在不知不觉中形成了对 `foo.h` 文件中 `#include <vector>` 指令的依赖。强行移除 `#include <vector>` 将导致大量代码需要被修改。

使用 IWYU 政策可以避免这种情况的发生，因为所有使用 `std::vector` 的代码（在最初编写时）都会被要求显式包含 `#include <vector>`。

### 便于检查依赖关系
通过使用 IWYU，代码中的 `#include` 指令将准确地反映出代码的依赖关系。这些 `#include` 指令可以为视为某种文档。将来，利用这些 `#include` 指令，你可以更容易地理解代码的结构。

同时，如果你发现你的程序错误地依赖了某些符号，通过这些准确反映依赖关系的 `#include` 指令，你也可以更容易地找到相关错误。

### 使用前置声明（Forward Declaration）
尽可能使用前置声明，可以提高编译速度并减少对头文件的依赖（减少重新编译）。

#### 争议
通常而言，优先使用前置声明是合理的。但前置声明也有其成本：
- 难以使用上文提到的通过 `#include` 指令调查某些依赖关系的方法，检查相关文件。
- 对于一些庞大的模板类，当重构这些模板类的模板参数时，可能需要修改分布在多个文件中的前置声明。

由于以上原因，某些新的 C++ 编码规范不再推荐或强制要求优先使用前置声明，此时可以通过 `--no_fwd_decls` 选项关闭 IWYU 对前置声明的优先使用。

## 其他 IWYU 规则
### 自动二次导出（Re-export）
#### 类型别名
考虑如下代码：
```cpp
// foo.h
#include <ostream>
typedef std::ostream OutputEmitter;
```

那么包含 `foo.h` 的代码应该添加 `#include <ostream>` 吗？

通常而言，这种对 `OutputEmitter` 的定义本质是为了屏蔽 `std::ostream` 的实现细节，因此按照惯例不应该要求用户包含 `#include <ostream>`。

IWYU 实现了二次导出（re-export）的概念，对于 re-export 的头文件，IWYU 不会要求用户包含其依赖的头文件。

默认情况下，对于形如 `typedef Foo MyTypedef;` 的类型别名，遵循以下规则决定是否自动二次导出：
- 如果进行 `typedef` 的文件直接 `#include` 底层类型的定义，那么 IWYU 会假设你意图二次导出。
- 如果进行 `typedef` 的文件明确提供了底层类型的前置声明，而不是直接 `#include` 其定义，那么 IWYU 会假设你不打算二次导出。
- 其他情况，IWYU 会假设你不打算二次导出。

```cpp
#include "foo.h"
typedef Foo Typedef1;   // IWYU 会假设你意图二次导出（intend to re-export）。

class Bar;
typedef Bar Typedef2;   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。

#include "file_including_baz.h"   // 没有直接包含 Baz 的定义
typedef Baz Typedef3;   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。
```

#### 函数返回值
对于函数返回值，使用同上的规则判断是否自动二次导出。

```cpp
#include "foo.h"
Foo Func1();   // IWYU 会假设你意图二次导出（intend to re-export）。

class Bar;
Bar Func2();   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。

#include "file_including_baz.h"   // 没有直接包含 Baz 的定义
Baz Func3();   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。
```

#### 用于转换的构造函数
如果存在用于转换的构造函数，IWYU 会在某些情景下假设你意图二次导出。

假定我们有：
```cpp
class Foo {
  public:
    Foo(int i) { ... };    // 注意：不是一个显式（explicit）构造函数
};
```

那么对于在另一头文件中的以下函数定义：
```cpp
#include "foo.h"
void Func1(Foo foo);   // IWYU 会假设你意图二次导出（intend to re-export）。

class Foo;
void Func2(Foo foo);   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。

#include "file_including_foo.h"   // 没有直接包含 foo 的定义
void Func3(Foo foo);   // IWYU 会假设你不打算二次导出（NOT intend to re-export）。
```

若某些函数的参数将使用相关构造函数进行类型转换，IWYU 会使用同上的规则判断是否自动二次导出。

### Mapping 文件
IWYU 需要处理的一个重要问题是：如何区分定义该符号的头文件，和实际应该被普通库用户包含的头文件。例如，对于 GCC 的 libstdc++，`std::unique_ptr<T>` 是在 `<bits/unique_ptr.h>` 中定义的，但是用户应该包含的头文件是 `<memory>`。

对于标准库，IWYU 已经内置了大部分需要的规则。然而，对于第三方库（如 Boost、Qt），我们可能需要自己提供这些规则。IWYU 的 Mapping 文件扩展名为 `.imp`（**I**wyu **M**a**P**ping），其格式如下：

```yaml
[
    # 指定 <bits/std_abs.h> 是一个私有头文件，不应该被用户包含。用户应该通过 <math.h> 包含相关符号。
    { "include": ["<bits/std_abs.h>", "private", "<math.h>", "public"] },
    # 使用正则表达式指定私有头文件
    { "include": ["@[\"<](QtCore/)?qnamespace\\.h[\">]", "private", "<Qt>", "public"]},
    # 指定 NULL 符号应该通过 <cstddef> 被用户包含
    { "symbol": ["NULL", "private", "<cstddef>", "public"] },
    # 引用另一个 Mapping 文件
    { "ref": "more.symbols.imp" }
]
```

我们可以通过使用 `--mapping_file` 选项使用我们的 Mapping 文件：
```bash
include-what-you-use -Xiwyu --mapping_file=main.imp ...
```

#### 特定于 Qt 的 Mapping
对于 Qt，我们可以使用 IWYU 提供的 Python 脚本 [iwyu-mapgen-qt.py](https://github.com/include-what-you-use/include-what-you-use/blob/master/mapgen/iwyu-mapgen-qt.py) 自动生成 Mapping 文件：
```bash
iwyu-mapgen-qt --source-dir /usr/include/qt6 > qt6.imp
```

### 手动设置的 IWYU 指令
IWYU 支持通过特殊的注释指令来控制检查结果。
#### keep 指令
keep 指令告诉 IWYU 保留指定的 `#include` 指令，即使 IWYU 认为这个 `#include` 指令是不必要的。

```cpp
#include <header_maybe_unused.h>          // IWYU pragma: keep
class forward_declaration_maybe_unused;   // IWYU pragma: keep
```

也可以用 begin_keep & end_keep 指令对多个 `#include` 指令进行保留。

```cpp
// IWYU pragma: begin_keep
#include <header_maybe_unused.h>
class forward_declaration_maybe_unused;
// IWYU pragma: end_keep
```

#### export 指令
export 指令告诉 IWYU 将指定的 `#include` 指令视为二次导出。

```cpp
#include "detail/constants.h" // IWYU pragma: export
#include "detail/types.h" // IWYU pragma: export
#include <vector> // 默认情况不会被视为二次导出
class Other; // IWYU pragma: export
```

同样，也可以用 begin_exports & end_exports 指令对多个 `#include` 指令进行二次导出。

```cpp
// IWYU pragma: begin_exports
#include "detail/constants.h"
#include "detail/types.h"
class Other;
// IWYU pragma: end_exports

#include <vector> // 默认情况不会被视为二次导出
```

#### private 指令
private 指令用于表明当前文件是私有的，不应该被其他文件包含。其他文件应该通过包含另一个公共接口头文件来访问相关信息。
```cpp
// private.h
    // IWYU pragma: private, include "public.h"
    struct Private {};
// public.h
    #include "private.h"
```

此时，若你在 `main.cpp` 中使用 `Private` 类型，则 IWYU 会提示你应该包含 `public.h` 而不是 `private.h`。

#### no_include 指令
no_include 指令告诉 IWYU 不要提醒用户包含指定的头文件。

```cpp
#include "file_including_foo.h"
// IWYU pragma: no_include "foo.h"
Foo foo;
```

#### no_forward_declare 指令
no_forward_declare 指令告诉 IWYU 不要提醒用户使用指定的前置声明。（这不是用于全局配置的方式！）

```cpp
#include "unrelated.h" // 声明了 Public
// IWYU pragma: no_forward_declare Public

Public* i;
```

#### friend 指令
类似于 C++ 中的友元，允许特定的文件包含当前文件，即使当前文件是私有的。

```cpp
// detail/private.h
    // IWYU pragma: private
    // IWYU pragma: friend "detail/.*"
    struct Private {};
// detail/alsoprivate.h
    #include "detail/private.h"
```

#### associated 指令
指定与当前源文件关联的头文件。

默认情况下，IWYU 使用源文件的基本名（不带扩展名的文件名）自动检测哪个是关联的头文件，但有时可能自动关联失败，此时可以使用 associated 指令手动指定关联的头文件。

```cpp
// component/public.h:
    struct Foo {
        void Bar();
    };
// component/component.cc
    #include "component/public.h"  // IWYU pragma: associated
    void Foo::Bar() {
    }
```

#### always_keep 指令
always_keep 指令告诉 IWYU，即使当前文件中的符号没有被使用，其他文件中包含当前文件的 `#include` 指令也应该始终被保留。

```cpp
// header.h
    // IWYU pragma: always_keep
    struct Unused {};
// main.cc
    #include "header.h"
```

## 如何使用 IWYU
### 安装 IWYU
要使用 IWYU，首先需要安装 IWYU。对于 Arch Linux，我们可以通过 AUR 安装 `include-what-you-use` 包。假设您使用 `paru` 作为 AUR Helper{% blur "（螃蟹比地鼠更加可爱的，对吧？）" %}，可以使用如下命令安装 IWYU：
```bash
paru -S include-what-you-use
```

### 在 CMake 项目中配置 IWYU
对于 CMake 项目，自 CMake 3.3 起，可以使用 `CMAKE_<LANG>_INCLUDE_WHAT_YOU_USE` 变量指定 IWYU 的路径，随后 CMake 会在编译过程中自动调用 IWYU 进行检查。

参考如下 Preset：
```json
{
    "name": "code-check",
    "displayName": "Code Check",
    "generator": "Ninja",
    "binaryDir": "${sourceDir}/out/build/${presetName}",
    "installDir": "${sourceDir}/out/install/${presetName}",
    "cacheVariables": {
        "CMAKE_C_COMPILER": "clang",
        "CMAKE_CXX_COMPILER": "clang++",
        "CMAKE_C_INCLUDE_WHAT_YOU_USE": "include-what-you-use;-Xiwyu;--mapping_file=${sourceDir}/iwyu/main.imp;-Xiwyu;--error",
        "CMAKE_CXX_INCLUDE_WHAT_YOU_USE": "include-what-you-use;-Xiwyu;--mapping_file=${sourceDir}/iwyu/main.imp;-Xiwyu;--error"
    }
}
```

其中 `--mapping_file` 选项用于指定 Mapping 文件，`--error` 选项用于将 IWYU 的警告视为错误。

### 处理自动生成的文件
我们的 CMake 代码树可能包含自动生成的代码文件（例如：对于 Qt 项目，系统会自动生成 `.rcc/**.cpp` 文件），通常这些自动生成的文件会违反 IWYU 的规则，但这些文件不应该被检查。此时，我们可以在 CMake 中给这些文件设置 `SKIP_LINTING` 属性以跳过相关检查：
```cmake
if (CMAKE_VERSION VERSION_GREATER_EQUAL 3.27)
    get_target_property(_sources YOUR_TARGET_NAME SOURCES)
    foreach(_source IN ITEMS ${_sources})
        get_source_file_property(_generated ${_source} GENERATED)
        if(_generated)
            set_source_files_properties(${_source} PROPERTIES SKIP_LINTING TRUE)
        endif()
    endforeach()
    unset(_sources)
else()
    message(WARNING "CMake version is less than 3.27, automatic generated files will not be skipped linting.")
endif()
```

### 一个实际的例子
参照 [GitHub: ArcticLampyrid/TwentyFourPoint](https://github.com/ArcticLampyrid/TwentyFourPoint) 项目。
