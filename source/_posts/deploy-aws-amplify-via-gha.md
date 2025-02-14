---
title: '通过 GitHub Actions 部署静态网站到 AWS Amplify'
date: 2025-02-14 21:27:00
updated: 2025-02-14 21:27:00
category: 技术
---
[AWS Amplify](https://aws.amazon.com/amplify/) 是一个全托管的服务，用于快速部署 Web 应用程序（包括前端和后端），其本身可以关联 GitHub 仓库，实现自动化部署。在本文中，我们仅考虑使用其部署静态网站（前端）的功能，且使用 GitHub Actions 而非 AWS 官方管道来部署以实现更大的灵活性。

<!--more-->
注：Amplify 并非免费服务，超出一定使用量后会收费。

## 创建 Amplify 应用程序
进入 [AWS Amplify 控制台](https://console.aws.amazon.com/amplify)，创建一个新的应用程序，选择【不使用 Git 进行部署】，然后先手动上传一份 zip 文件作为初始版本。
{% asset_img create-amplify-app.jpg %}

一路确定后，进入详细页，记录下 ID 和 ARN，后面会用到。
{% asset_img amplify-app-detail.jpg %}

## 配置 AWS 身份验证
AWS 支持通过外部 OIDC 来进行身份验证，通过合理设置，可以使得 GitHub Token 直接被用于访问 AWS 服务。具体细节可参考 [GitHub 官方文档](https://docs.github.com/zh/actions/security-for-github-actions/security-hardening-your-deployments/configuring-openid-connect-in-amazon-web-services)。

我们登陆 [AWS IAM 控制台](https://console.aws.amazon.com/iam)，选择身份提供者界面。
{% asset_img id-provider-list.jpg %}

点击添加，选择 OIDC（OpenID Connect）身份提供者，配置如下：
- 提供程序 URL：`https://token.actions.githubusercontent.com`
- 受众：`sts.amazonaws.com`

{% asset_img create-id-provider.jpg %}

这使得我们可以直接使用 GitHub Actions 的 GH_TOKEN 来访问 AWS 服务，注意对应 GitHub Token 需要有相应的权限：
```yaml
permissions:
  id-token: write
  contents: read
```

此时，我们还需要为通过 GitHub Token 访问 AWS 服务创建相应的 IAM 角色，并分配相应的权限。我们在 IAM 控制台中创建角色，选择 Web 身份作为可信实体，选择刚刚创建的身份提供者（`token.actions.githubusercontent.com`）。
{% asset_img create-role-1.jpg %}

设置仓库约束（如下图所示）：
{% asset_img create-role-2.jpg %}

一路确定后，点击刚刚创建的角色，新建内联策略：
{% asset_img role-add-policy.jpg %}

切换编辑器为 JSON 模式，设置内容如下：
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "",
            "Effect": "Allow",
            "Action": [
                "amplify:StartDeployment",
                "amplify:CreateDeployment"
            ],
            "Resource": "arn:aws:amplify:<Region>:<Account>:apps/<AppId>/branches/<Branch>"
        }
    ]
}
```

这里的 `<Region>`、`<Account>`、`<AppId>`、`<Branch>` 需要替换为实际的值，前三种可以通过查看 Amplify 控制台的应用程序 ARN 获取，`<Branch>` 则为您的 Amplify 应用程序的分支名称，或者也可以使用 `*` 通配符。

此外，记录下刚刚创建的角色的 ARN，我们将在 GitHub Actions 中使用。
{% asset_img role-detail.jpg %}

## 配置 GitHub Actions
设置 secrets：
```ini
AWS_REGION=<Region>
AWS_IAM_ROLE_ARN=<RoleARN>
AMPLIFY_APP_ID=<AppId>
AMPLIFY_BRANCH=<Branch>
```

在生成静态资源后，添加 Action 如下（假定静态站点的生成目录为 `public`）：
```yaml
- name: Configure AWS Credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-region: ${{ secrets.AWS_REGION }}
    role-to-assume: ${{ secrets.AWS_IAM_ROLE_ARN }}
- name: Deploy
  run: |
    cd public
    zip -q -r ./archive.zip * && echo "Site zipped" || echo "Failed to zip site"
    cd ..
    echo "::group::Create deployment"
    RESPONSE=$(aws amplify create-deployment --app-id ${{ secrets.AMPLIFY_APP_ID }} --branch-name ${{ secrets.AMPLIFY_BRANCH }})
    JOB_ID=$(echo $RESPONSE | jq -r '.jobId')
    ZIP_URL=$(echo $RESPONSE | jq -r '.zipUploadUrl')
    echo "Job ID: $JOB_ID"
    echo "::endgroup::"
    echo "::group::Upload site"
    curl -X PUT -T "./public/archive.zip" -H "Content-Type: application/zip" "$ZIP_URL"
    echo "::endgroup::"
    echo "::group::Deploy site"
    aws amplify start-deployment --app-id ${{ secrets.AMPLIFY_APP_ID }} --branch-name ${{ secrets.AMPLIFY_BRANCH }} --job-id $JOB_ID > /dev/null && echo "Site deployed" || echo "Failed to deploy site"
    echo "::endgroup::"
```

注：
AWS CLI 预装在 GitHub Actions 的 runner 上，所以我们可以直接使用。

## 题外话
实际上对于纯静态场景，Cloudflare Pages 无论是部署体验还是收费标准都更加友好。但由于境内使用 CF Pages 的人数过多，树大招风，故在这里选用  AWS Amplify 以期待更好的稳定性。
