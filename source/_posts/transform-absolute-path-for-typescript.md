---
date: 2023-02-07 14:58:40
updated: 2023-03-23 22:01:40
category: 技术
title: 在编译时转译 TypeScript 的 import 语句中的绝对路径
excerpt: 在 webpack with ts-loader 环境下使用 transformer 对 import 语句中的路径进行转译，以在库代码使用绝对路径的同时保证开箱即用。
---
## 前言
近期，在更新 `custom-electron-titlebar` 时碰到了大量的 `Cannot find module 'x' or its corresponding type declarations.` 的错误，通过搜索发现已经存在相关 issue [#198](https://github.com/AlexTorresDev/custom-electron-titlebar/issues/198)。

在发现该问题与绝对路径有关时，我尝试在 tsconfig 中检查 & 配置类似 `baseUrl` / `rootUrl` 之类的配置项，未果，后进入 TypeScript 仓库搜索相关问题，发现 [#15479](https://github.com/microsoft/TypeScript/issues/15479)，官方回复如下：
> Our general take on this is that you should *write the import path that works at runtime*, and set your TS flags to satisfy the compiler's module resolution step, rather than writing the import that works out-of-the-box for TS and then trying to have some other step "fix" the paths to what works at runtime.
>
> We have about a billion flags that affect module resolutions already (baseUrl, path mapping, rootDir, outDir, etc). Trying to rewrite import paths "correctly" under all these schemes would be an endless nightmare.
>
> _Originally posted by @RyanCavanaugh in [#15479 (comment)](https://github.com/microsoft/TypeScript/issues/15479#issuecomment-300240856)_

大致含义是：
> TypeScript 的所有模块查找策略都是用于指导 tsc 在编译时如何查找模块，以贴合各种各样的 runtime 环境的实际查找策略。这些设置不会影响 runtime，所有的路径都会“按原样”传递给 runtime 来查找模块。我们不应该反过来，为 TypeScript 用户设置一套合理的查找策略，再把这些路径“修正”成 runtime 使用的格式。
>
> 我们已经有了复杂的模块查找策略，再去加入自动“修正” import 路径的功能将是一场噩梦。
> 
> （类比 jvm 环境，tsconfig 的所有配置都是单纯修改 CompilerClassPath 的）

这对于面向最终用户 (End-Users) 的产品问题不大，很容易在 launch 时通过 `NODE_PATH` 环境变量等方式指导 runtime 在哪些路径查找模块。然而对于库作者而言，node modules 机制并没有提供一个库级别 (package-level) 的 `path`，而要求所有库使用者对 tsc、runtime 等的配置做出修改将是不可接受的。

## 解决方案
手动修改所有绝对路径为相对路径是最简单的一种方案，然而这可能引入工程管理上的麻烦。另一种方法是使用 transformer 在编译时转译绝对路径。通过检索资料，[LeDDGroup/typescript-transform-paths](https://github.com/LeDDGroup/typescript-transform-paths) 正是一个可用于此用途的转译器。

需要注意的是，**TypeScript 官方的 `tsc` 并不支持加载自定义的转译器（custom transformer）**，如果实在需要使用 `tsc` 的话需要应用 (apply) [ts-patch](https://github.com/nonara/ts-patch) 补丁。`typescript-transform-paths` 官方同时提供了与 `ts-node`、`node`、`NX`等工具链一起使用的例子。

然而我所修改的 `custom-electron-titlebar` 使用的是 `webpack` with `ts-loader`，并不适用于以上提到的方法。在 `ts-loader` 中加载 custom transformer 的文档可以在这里看到：[ts-loader/README#getCustomTransformers](https://github.com/TypeStrong/ts-loader#getcustomtransformers)。  

核心配置如下：
```js
const createTsTransformPaths = require('typescript-transform-paths').default;
{
    test: /\.tsx?$/,
    use: "ts-loader",
    use: {
        loader: "ts-loader",
        options: {
            getCustomTransformers: (program) => ({
                before: [createTsTransformPaths(program, {})],
                afterDeclarations: [createTsTransformPaths(program, {
                    afterDeclarations: true
                })]
            })
        }
    },
    exclude: /node_modules/
}
```

## 代码示例
可以参考 [AlexTorresDev/custom-electron-titlebar#206](https://github.com/AlexTorresDev/custom-electron-titlebar/pull/206)