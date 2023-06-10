---
title: Git 全分支代码打包脚本
date: 2022-06-11 02:31:11
updated: 2022-06-11 02:31:11
category: 技术
tag: [PowerShell]
---
使用 ChatGPT 创作（只修改了一点点），将某个 Git 仓库中的全部分支的代码都复制到一个文件夹里面，并按分支名创建子文件夹。
<!-- more -->

代码记录一下，备用：
```powershell
# Prompt for the path to the Git repository
$repoPath = Read-Host "Enter the path to the Git repository"

# Prompt for the root path for the branch folders
$rootPath = Read-Host "Enter the root path for the branch folders"

# Store the current working location
$currentLocation = Get-Location

# Change to the repository directory
Set-Location -Path $repoPath

# Save the initial branch name
$initialBranch = git rev-parse --abbrev-ref HEAD

# Stash any local modifications
Write-Host "Stashing local modifications..."
$stashOutput = git stash push
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to stash local modifications. Exiting script."
    exit
}

# Get a list of all branches in the repository
$branches = git branch --list --format="%(refname:short)" | ForEach-Object { $_.Trim() }

# Loop through each branch
foreach ($branch in $branches) {
    Write-Host "Processing branch: $branch"

    # Create a folder for the branch
    $branchFolder = Join-Path -Path $rootPath -ChildPath $branch
    New-Item -ItemType Directory -Path $branchFolder -Force | Out-Null

    # Checkout the branch
    Write-Host "Checking out branch: $branch"
    git checkout $branch | Out-Null

    # Get the tracked files in the branch using `git ls-tree`
    $files = git ls-tree -r --name-only HEAD | ForEach-Object { $_.Trim() }

    # Copy the tracked files from the branch to the folder
    foreach ($file in $files) {
        $sourceFile = Join-Path -Path $repoPath -ChildPath $file
        $destinationFile = Join-Path -Path $branchFolder -ChildPath $file

        # Create the parent directory if it does not exist
        $parentDirectory = Split-Path -Path $destinationFile -Parent
        if (-not (Test-Path -Path $parentDirectory)) {
            New-Item -ItemType Directory -Path $parentDirectory -Force | Out-Null
        }

        Write-Host "Copying file: $file"
        Copy-Item -Path $sourceFile -Destination $destinationFile -Force
    }
}

# Switch back to the initial branch
Write-Host "Switching back to initial branch: $initialBranch"
git checkout $initialBranch | Out-Null

# restore any stashed modifications
Write-Host "Restoring stashed modifications..."
if ($stashOutput -notlike "*No local changes to save*") {
    git stash pop | Out-Null
}

# Restore the original working location
Set-Location -Path $currentLocation

# Inform the user about the completion of the script
Write-Host "All branches have been packed into separate folders."

```

不得不说拿 ChatGPT 写点辅助性的脚本是真的爽。