---
title: Tensorflow 开发环境现代化配置方案（试探性）
date: 2024-06-26 20:05:00
updated: 2024-06-26 20:05:00
category: 技术
tag: [Tensorflow, Python]
---
实在是受不了 Conda 天天卡在 Solving environment 步骤了，看到 Nvidia 做了容器技术的支持，干脆用 Dev Container 来部署 Tensorflow 开发环境了。顺带用上了最爱的 Poetry 来管理 Python Packages（带 lock 文件的包管理器），再也不用担心几年不动项目后再次使用，而出现版本不兼容的问题了。
<!--more--> 

## 方案说明
使用 Dev Container 隔离开发环境，使用 Poetry 管理 Python Packages。

### 优势
- 隔离环境：为了 Tensorflow 正常运行，往往不得不使用一些较低版本的软件设施。将其放在隔离环境中，可以避免干扰其它应用的开发和运行。
- 易于使用：在系统基础驱动正常的情况下，开发者不需要为不同程序手动配置不同版本的 Tensorflow / CUDA 等依赖，Dev Container 将自动为应用安装特定版本的依赖。
- 平台友好：把平台支持的工作全部交给了容器技术，在安装完成显卡驱动后，Windows 用户只需要安装 Docker Desktop，Linux 用户只需要安装 Docker CLI 和 Nvidia Container Toolkit。
- 依赖管理：通过容器技术锁定 CUDA 基础环境，通过 Poetry 锁定 Python Packages 信息，提高可复现性。

### 劣势
- 由于同时使用了多种较新的方案，部分 IDE 可能无法提供较好支持（笔者使用 VSCode 这类自由度较高的准集成环境，相对没有这种烦恼）
- 相关技术的资料较少，尤其是国内资源较少，正确使用需要一定的国际资料检索能力

## 操作流程
### Windows 下配置 Nvidia 容器栈
安装 Docker Desktop 并使用 WSL 2 作为后端，同时保证安装了较新的支持 WSL 的 Nvidia 显卡驱动即可。
参见 [GPU support in Docker Desktop](https://docs.docker.com/desktop/gpu/)。

### Linux 下配置 Nvidia 容器栈
本文假定您正在使用 Arch Linux，其他发行版（如 Gentoo、Fedora 等）请自行查找对应的安装命令，大致流程相同。

#### 安装并配置 NVIDIA 显卡驱动
```bash
sudo pacman -S nvidia-open
```

#### 安装 Docker
```bash
sudo pacman -S docker docker-buildx
```

#### 配置容器环境的 GPU 支持
```bash
sudo pacman -S nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 配置 Dev Container 环境
在项目根目录下创建 `.devcontainer/devcontainer.json` 文件，内容如下：
```json
{
    "name": "Python 3",
    "image": "mcr.microsoft.com/devcontainers/python:1-3.8-bookworm",
    "runArgs": [
        "--runtime=nvidia",
        "--gpus=all"
    ],
    "features": {
        "ghcr.io/devcontainers/features/git-lfs:1": {
            "autoPull": true,
            "version": "latest"
        },
        "ghcr.io/devcontainers/features/nvidia-cuda:1": {
            "installCudnn": true,
            "installToolkit": true,
            "cudaVersion": "11.8",
            "cudnnVersion": "8.6.0.163"
        },
        "ghcr.io/devcontainers-contrib/features/poetry:2": {
            "version": "latest"
        },
        "ghcr.io/nikobockerman/devcontainer-features/poetry-persistent-cache:1": {}
    }
}
```

该配置文件设置了如下特性：
- 使用 Python 3.8 的 Dev Container
- 启用 Nvidia 容器运行时
- 安装 CUDA 11.8 和 cuDNN 8.6
- 安装 Poetry 作为 Python 包管理器
- 持久化 Poetry 的环境缓存

{% alertpanel info 多出口分流注意事项 %}
Nvidia 资源下载站有国内服务器，记得保证 `*.download.nvidia.com` 走国内出口，以便正确触发 HTTP 301 重定向到 `*.download.nvidia.cn`，提高下载速度。

```yaml
- DOMAIN-SUFFIX,download.nvidia.com,DIRECT
```

安装 CUDA 相关设施时，全程大概需要 2～3 GiB 的流量。
{% endalertpanel %}

### 使用 Poetry 管理依赖
#### 初始化
在 Dev Container 环境中运行以下命令，初始化项目：
```bash
poetry init
poetry add tersorflow@~2.13.0
```

**由于 Tensorflow 实质上并不遵循[语义化版本（Semantic Versioning）](https://semver.org/)约定，因此在添加依赖时建议使用 `~` 符号来强约束次要版本号（但不约束修订版本号）。**

之后，Poetry 会自动为您生成 `pyproject.toml` 文件，并在 `poetry.lock` 文件中记录依赖信息。由于我们使用 Tensorflow 的项目往往不作为 package 发布，而是作为最终应用，因此修改 `pyproject.toml` 文件，添加如下内容：

{% codeblock lang:toml mark:2 %}
[tool.poetry]
package-mode = false
{% endcodeblock %}

此外，考虑为项目使用国内镜像源，以提高下载速度。在 `pyproject.toml` 文件中添加如下内容：
```toml
[[tool.poetry.source]]
name = "mirrors"
url = "https://pypi.tuna.tsinghua.edu.cn/simple/"
priority = "primary"
```

#### 使用已有配置
如果您的项目已经有 Poetry 配置信息存在，则直接安装即可：
```bash
poetry install
```
