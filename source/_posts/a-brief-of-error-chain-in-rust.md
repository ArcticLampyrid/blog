---
title: 对 Rust 中的错误链（Error Chain）的简要了解
date: 2024-05-14 12:03:00
updated: 2024-05-14 12:03:00
toc: true
category: 技术
tags:
- Rust
---
## 缘起
在开发中，我有通过 log 记录 Error 的习惯，然而某次查看 log 中的 Error 时，发现：
```log
error: IO error in winapi call
```

这样的错误信息显然并不是非常有用，追溯发现该错误来自于 `windows-service-rs` 库：
```rust
Self::Winapi(_) => write!(f, "IO error in winapi call"),
```

然而，库中明明记录了更详细的错误信息，为什么不 Display 出来呢？

```rust
/// IO error in winapi call
Winapi(std::io::Error),
```

很快，我试图提起一个 PR \([mullvad/windows-service-rs#128](https://github.com/mullvad/windows-service-rs/pull/128)\)，将其修改为：
```rust
Self::Winapi(io_err) => write!(f, "IO error in winapi call: {}", io_err),
```

但这一改动并作者拒绝了，理由是不符合使用错误链（Error Chain）时的规范，`io_err` 应当通过 `Error::source()` 方法获取。

## 什么是错误链（Error Chain）
一个错误（Error）常常是由更加底层的错误（Underlying Error）引起的。通常，为了提供附加的上下文信息，我们会将底层错误包装在一个更高层的错误中。这些由高层到低层的错误便构成了一个错误链（Error Chain）。

Rust 自 1.30 版本开始，标准库中的 `Error` trait 提供了 `source()` 方法，用于提供一种获取底层错误的标准方式。

当我们使用 `thiserror` 库时，我们可以通过以下方式正确地提供错误链：
```rust
#[derive(thiserror::Error, Debug)]
pub enum MyError {
    HighLevel1 {
        #[source]
        source: Box<dyn std::error::Error>,
    },
    HighLevel2 {
        #[from] // from 标记隐含了 source
        source: std::io::Error,
    },
}
```

## 如何显示错误链
### `Display` 不应该显示错误链
目前 `Display` 是否应该显示错误链并没有一个标准的约定。[rust-lang/api-guidelines#210](https://github.com/rust-lang/api-guidelines/pull/210) 已经存在了约 4 年，但出于对历史现状的考虑，维护人员仍未对此作出明确的规定。
> {% raw %}<div lang="en">{% endraw %}
> I'm not sure I agree with promoting this to an API guideline at this point in time. Certainly, if we had started with the current definition of the `std::error::Error` trait, then I would agree with it. The problem is that the `Error` trait has only recently evolved to a point where this sort of API guideline is actually reasonable. Which means a lot of crates aren't actually doing this correctly.  
> I'm not quite sure how to handle this. If an implementation is including `source` errors in its `Display` impl, then "fixing" that would appear to be a breaking change no matter how you slice it.  
> _\(Originally posted by @BurntSushi in [comment](https://github.com/rust-lang/api-guidelines/issues/210#issuecomment-572672386)\)_  
> {% raw %}</div>{% endraw %}
> ____
> 我不确定现在就将其提升为 API 指南是否合适。当然，如果我们是从头开始定义 `std::error::Error` trait，那么我会同意这样做。问题是 `Error` trait 最近才发展使得此类 API 指南变得合理的阶段。这意味着很多 crate 实际上并没有正确地做到这一点。  
> 我不太确定如何处理这个问题。如果一个实现在其 `Display` 实现中包含了 `source` 错误，那么“修复”它似乎无论如何都是一个破坏性改变。  
> _（来自 @BurntSushi 的[评论](https://github.com/rust-lang/api-guidelines/issues/210#issuecomment-572672386)）_  


根据目前的社区讨论和约定习惯（尤其是 `thiserror`、`SNAFU`、`anyhow` 等库使用这种约定），我们不应该在普通的 `Display` 中显示错误链，从用户侧来看：
```rust
// 不会打印出错误链
println!("Error: {}", err);
```

从 `Error` 实现来看，相应的 `Display` 也不应该显示错误链：
```rust
pub enum MyError {
    // Wrong: #[error("High level error: {source}")]
    #[error("High level error")]
    HighLevel {
        #[source]
        source: Box<dyn std::error::Error>,
    },
}
```

这么做的主要原因的，我们必须提供不带错误链的错误信息，以便正确打印（避免重复）错误链：
```log
// 正确情况
High level error
Caused by:
  -> Low level error

// 错误情况（重复打印）
High level error: Low level error
Caused by:
  -> Low level error
```

### 使用 Alternative 格式显示错误链
这是 `anyhow` 库提供的做法，参见其文档的 [Display Representations](https://docs.rs/anyhow/latest/anyhow/struct.Error.html#display-representations) 部分。

使用 `{}` 格式，不会打印出错误链：
```
High level error
```

使用 `{:#}` 格式，可以打印出错误链：
```
High level error: Low level error
```

非常遗憾的是，这种方法并没有受到广泛支持、亦未被标准化。如果我们直接使用来自不同库的错误类型，我们可能需要自行实现此类格式化方式。

### 手动显示错误链
我们可以通过手动遍历错误链，将错误信息逐一打印出来：
```rust
// A very simple error chain printer
fn print_error_chain(err: &dyn std::error::Error) {
    eprintln!("{}", err);
    let mut err = err.source();
    if err.is_some() {
        eprintln!("Caused by:");
    }
    while let Some(e) = err {
        eprintln!("  -> {}", e);
        err = e.source();
    }
}
```

### 使用 `display-error-chain` 库
一个简单的错误链打印库：
```rust
use display_error_chain::ErrorChainExt;
eprintln!("{}", err.chain());
```

### 使用 `Report` （不稳定特性，unstable）
标准库中的 `Report` 提供了一种更加统一的错误链打印方式，但目前仍然是 unstable 特性：
```rust
#![feature(error_reporter)]
use std::error::Report;

fn get_super_error() -> Result<(), SuperError> {
    Err(SuperError { source: SuperErrorSideKick })
}

fn main() -> Result<(), Report<SuperError>> {
    get_super_error()
        .map_err(Report::from)
        .map_err(|r| r.pretty(true).show_backtrace(true))?;
    Ok(())
}
```

输出：
```log
Error: SuperError is here!

Caused by:
      SuperErrorSideKick is here!
```

## 结语
尽管错误链 API 的标准化已经完成，但在实际使用中，打印错误链仍然存在一定的麻烦，期待 [Report](https://doc.rust-lang.org/std/error/struct.Report.html) 能够稳定下来，为错误链的打印提供更好的支持。同时也希望有更好的最佳实践指导，以便开发者能够更好地使用错误链。

## 相关问题
- [Do people not care about printable error chains? a.k.a. How to nicely implement Display for an error?](https://users.rust-lang.org/t/do-people-not-care-about-printable-error-chains-a-k-a-how-to-nicely-implement-display-for-an-error/35362)
