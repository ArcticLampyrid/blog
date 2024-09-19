---
title: 简介多平台下的动态库加载路径
date: 2024-09-20 02:06:00
updated: 2024-09-20 02:06:00
toc: true
category: 技术
---
## 缘起
最近在处理跨平台打包（{% blur "怎么变成天天在写 CI/CD 的样子了啊" %}）时，遇到了一个问题：在 MacOS 下，程序无法加载动态库。经过一番排查，发现三大桌面平台（Windows、Linux、MacOS）对动态库加载路径的处理有所不同，故简单记录一下。

## Windows：万物归一
不考虑动态加载，只考虑通过导入表引用的动态库，那么 Windows 下的动态库加载路径是相对简单的：
- 对系统 DLL 和需要重定向的特殊 DLL 进行特殊处理
- 对清单文件中提及的 DLL 进行重定向等处理（对于普通 Dll 而言，这种机制几乎不会被用到）
- 程序所在目录
- 环境变量 `PATH` 中指定的目录

对于普通 Dll 而言，通常不会触发各种重定向策略，此时查找路径的行为几乎与查找可执行文件（`*.exe`, `*.com`, etc）路径的方式一致。

## Linux：多元共存
Linux 下的动态库加载路径相对复杂一些，其存在多种指定加载路径的方式。默认情况下，GNU ld 不会从程序所在目录加载动态库，而是依赖于 `ld.so` 的配置，只从系统默认的路径加载动态库（主要是 `/lib` 和 `/usr/lib`）。

如果想要临时从其它位置加载动态库，则可以通过环境变量 `LD_LIBRARY_PATH` 来指定，多个路径之间用 `:` 分隔。由于库加载路径与 `PATH` 变量独立，因此被认为具有更好的安全性。

除此之外，Linux 提供了一种更加灵活的方式：`rpath`。通过在编译时指定 `-rpath` 选项，可以将动态库的加载路径写入到 ELF 文件中，使得程序在运行时可以从指定的路径加载动态库。这种方式不仅可以避免环境变量的干扰，还可以避免动态库的版本冲突。

假设我们有以下目录结构：
```
/opt/myapp/
├── bin/
│   └── myapp
└── lib/
    └── libmylib.so
```

如果我们希望 `myapp` 在运行时可以加载到 `libmylib.so`，则可以在编译时指定 `-rpath` 选项：
```bash
# 使用 $ORIGIN 变量指定相对于 ELF 文件所在目录的路径
gcc -o myapp -L/opt/myapp/lib '-Wl,-rpath=$ORIGIN/../lib' myapp.c -lmylib
```

这样，`myapp` 在运行时会从 `/opt/myapp/lib` 目录加载动态库。

## macOS：独树一帜
macOS 非常地特别，会在动态库文件（`.dylib`）中记录动态库的安装名称（install name），我们可以通过 `otool` 命令来查看动态库的安装名称：
```bash
otool -l libmylib.dylib | grep -A 2 LC_ID_DYLIB
```

当把这些动态库连接到可执行文件时，会将动态库的安装名称写入到可执行文件中，之后可执行文件根据其内嵌的安装名称来加载每个动态库。同时，macOS 也提供 `rpath` 机制，但是否使用 `rpath` 取决于动态库的安装名称是否是相对于 `@rpath` 的路径。

我们可以用 `otool` 命令来查看可执行文件中的动态库依赖：
```bash
otool -L myapp
```

然后会发现类似以下的路径：
```
/System/Library/Frameworks/Foundation.framework/Versions/C/Foundation
@rpath/a.dylib
@loader_path/../lib/b.dylib
@executable_path/../lib/c.dylib
```

可以看到，可执行文件记录了每个库的路径，这些路径有以下几种：
- 绝对路径
- 相对于 `@rpath`：相对于可执行文件中的 rpath 路径（Mach-O 文件中的 `LC_RPATH` 命令用于指定 rpath 路径）
- 相对于 `@loader_path`：相对于当前模块（可能是库，不一定是可执行文件）文件所在目录
- 相对于 `@executable_path`：相对于当前可执行文件所在目录

在某些情况下，由于构建工具自动生成的安装路径（install name）并不符合我们的部署需求，我们可以通过 `install_name_tool` 命令来修改动态库的安装名称：
```bash
install_name_tool -id @rpath/libmylib.dylib libmylib.dylib
```

而对于那些已经连接的可执行文件，我们也可以通过 `install_name_tool` 命令来修改其依赖的动态库路径：
```bash
install_name_tool -change /usr/lib/libmylib.dylib @rpath/libmylib.dylib myapp
```

此外，`install_name_tool` 还可以用来修改可执行文件中的 rpath 路径：
```bash
install_name_tool -add_rpath @loader_path/../lib myapp
```

### 特别注意
由于 macOS 的动态库加载机制较为复杂，因此在使用 `rpath` 机制时需要额外关注一些问题。

现代构建工具（如 CMake）会在您选择使用 `rpath` 机制时自动处理这些问题，如在指定 `CMAKE_INSTALL_RPATH` 变量后执行 install 目标，CMake 会自动将 rpath 路径写入到可执行文件中，并将动态库的安装名称修改为相对与 `@rpath` 的路径。

然而，如果通过 CMake 引用了一些来自其它构建系统的资源，则这种自动处理可能会失效。例如，在 2024 年，混合使用 CMake (for C++) 和 Cargo (for Rust) 已经较为普遍，然而 corrosion 项目（用于在 CMake 中引用 Cargo 项目）截止到 v0.5.0 版本仍不会自动处理 rpath 问题，此时需要手动处理。

以引用了 Slint 框架（一个 Rust 写的轻量化 GUI 框架）的 C++ 项目为例，当我们使用 `FetchContent` 引用 Slint 时，如果我们在 macOS 下进行部署，则需要额外进行一些 hack：
```powershell
#!/usr/bin/env pwsh

# Compile and install the C++ project
cmake -S . -B ./build '-DCMAKE_INSTALL_RPATH=@loader_path' '-DCMAKE_INSTALL_LIBDIR=.' '-DCMAKE_INSTALL_BINDIR=.'
cmake --build ./build --config Release
cmake --install ./build --prefix ./installed

# Slint did not set the install dir to `@rpath` when used via FetchContent.
# Do some hack to fix it when packaging.
# https://github.com/slint-ui/slint/blob/461632717a3ffdd1f9e75cfb7cbfce0763dc0129/api/cpp/CMakeLists.txt#L145
$loadCmdsForLibSlint = otool -l ./installed/libslint_cpp.dylib
$idPattern = '\s*cmd\s+LC_ID_DYLIB\s*cmdsize\s+\d+\s*name\s+([^\(\r\n]*?)\s+\(offset \d+\)'
$idMatched = [regex]::Matches($loadCmdsForLibSlint, $idPattern)[0]
if ($idMatched) {
    $oldId = $idMatched.Groups[1].Value
    echo "Old LC_ID_DYLIB for libslint_cpp.dylib is '$oldId'"
    echo "Fixing it to '@rpath/libslint_cpp.dylib'"
    install_name_tool -id '@rpath/libslint_cpp.dylib' ./installed/libslint_cpp.dylib
    install_name_tool -change $oldId '@rpath/libslint_cpp.dylib' ./installed/myapp
}
```
