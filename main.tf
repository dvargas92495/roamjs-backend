terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      name = "roamjs-base"
    }
  }
  
  required_providers {
    github = {
      source = "integrations/github"
    }
  }
}

variable "aws_access_token" {
  type = string
}

variable "aws_secret_token" {
  type = string
}

variable "developer_token" {
  type = string
}

variable "github_token" {
  type = string
}

variable "stripe_public" {
    type = string
}

variable "stripe_secret" {
    type = string
}

variable "stripe_dev_secret" {
    type = string
}

variable "clerk_api_key" {
    type = string
}

variable "clerk_dev_api_key" {
    type = string
}

variable "encryption_secret" {
    type = string
}

variable "encryption_secret_dev" {
    type = string
}

variable "stripe_checkout_secret" {
    type = string
}

variable "stripe_dev_checkout_secret" {
    type = string
}

variable "slack_client_secret" {
    type = string
}

variable "dropbox_client_secret" {
  type = string
}

variable "google_client_secret" {
    type = string  
}

variable "roam_api_token" {
    type = string  
}

locals {
  lambdas = [
    { 
      path = "auth", 
      method = "post"
    },
    {
      path = "price",
      method = "get"
    },
    {
      path = "stripe-account",
      method = "post"
    },
    {
      path = "user",
      method = "get"
    },
    {
      path = "user",
      method = "put"
    },
    {
      path = "unsubscribe",
      method = "post"
    },
    {
      path = "users",
      method = "post"
    },
    {
      path = "subscribe",
      method = "post"
    },
    {
      path = "finish-subscription",
      method = "post"
    },
    {
      path = "check",
      method = "get"
    },
    {
      path = "meter",
      method = "post"
    },
    {
      path = "user",
      method = "post"
    },
    {
      path = "file",
      method = "get"
    },
    {
      path = "file",
      method = "put"
    },
    {
      path = "users",
      method = "get"
    },
    { 
      path = "error", 
      method = "post"
    },
    {
      path = "query",
      method = "post"
      size = 5120
      timeout = 120
    },
    { 
      path = "graphs", 
      method = "post"
    },
    {
      path = "article",
      method = "post"
    },
    {
      path ="dropbox-auth", 
      method = "post"
    },
    {
      path = "postman", 
      method = "post"
    },
    {
      path = "slack-url", 
      method = "post"
    },
    { 
      path = "google-auth", 
      method = "post"
    },
    {
      path = "otter",
      method = "post"
    },
    {
      path = "request-path",
      method = "get"
    },
    { 
      path = "oauth", 
      method = "get"
    },
    { 
      path = "oauth", 
      method = "put"
    },
  ]  
  
  resources = distinct([
    for lambda in local.lambdas: lambda.path
  ]) 
}

provider "aws" {
  region = "us-east-1"
  access_key = var.aws_access_token
  secret_key = var.aws_secret_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

data "aws_api_gateway_rest_api" "rest_api" {
  name = "roamjs-extensions"
}

resource "aws_api_gateway_resource" "resource" {
  for_each    = toset(local.resources)

  rest_api_id = data.aws_api_gateway_rest_api.rest_api.id
  parent_id   = data.aws_api_gateway_rest_api.rest_api.root_resource_id
  path_part   = each.value
}

resource "aws_lambda_function" "lambda_function" {
  count    = length(local.lambdas)

  function_name = "RoamJS_${local.lambdas[count.index].path}_${lower(local.lambdas[count.index].method)}"
  role          = data.aws_iam_role.roamjs_lambda_role.arn
  handler       = "${local.lambdas[count.index].path}_${lower(local.lambdas[count.index].method)}.handler"
  filename      = data.archive_file.dummy.output_path
  runtime       = "nodejs16.x"
  publish       = false
  timeout       = local.lambdas[count.index].timeout
  memory_size   = local.lambdas[count.index].size

  tags = {
    Application = "Roam JS Extensions"
  }
}

resource "aws_api_gateway_method" "method" {
  count    = length(local.lambdas)

  rest_api_id   = data.aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.resource[local.lambdas[count.index].path].id
  http_method   = upper(local.lambdas[count.index].method)
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  count    = length(local.lambdas)

  rest_api_id             = data.aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_resource.resource[local.lambdas[count.index].path].id
  http_method             = aws_api_gateway_method.method[count.index].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_function[count.index].invoke_arn
}

resource "aws_lambda_permission" "apigw_lambda" {
  count    = length(local.lambdas)
  
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_function[count.index].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${data.aws_api_gateway_rest_api.rest_api.execution_arn}/*/*/*"
}

resource "aws_api_gateway_method" "options" {
  for_each    = toset(local.resources)

  rest_api_id   = data.aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.resource[each.value].id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "mock" {
  for_each    = toset(local.resources)

  rest_api_id          = data.aws_api_gateway_rest_api.rest_api.id
  resource_id          = aws_api_gateway_resource.resource[each.value].id
  http_method          = aws_api_gateway_method.options[each.value].http_method
  type                 = "MOCK"
  passthrough_behavior = "WHEN_NO_TEMPLATES"

  request_templates = {
    "application/json" = jsonencode(
        {
            statusCode = 200
        }
    )
  }
}

resource "aws_api_gateway_method_response" "mock" {
  for_each    = toset(local.resources)

  rest_api_id = data.aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_resource.resource[each.value].id
  http_method = aws_api_gateway_method.options[each.value].http_method
  status_code = "200"
  
  response_models = {
    "application/json" = "Empty"
  }

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers"     = true,
    "method.response.header.Access-Control-Allow-Methods"     = true,
    "method.response.header.Access-Control-Allow-Origin"      = true,
    "method.response.header.Access-Control-Allow-Credentials" = true
  }
}

resource "aws_api_gateway_integration_response" "mock" {
  for_each    = toset(local.resources)
  rest_api_id = data.aws_api_gateway_rest_api.rest_api.id
  resource_id = aws_api_gateway_resource.resource[each.value].id
  http_method = aws_api_gateway_method.options[each.value].http_method
  status_code = aws_api_gateway_method_response.mock[each.value].status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers"     = "'Authorization, Content-Type'",
    "method.response.header.Access-Control-Allow-Methods"     = "'GET,DELETE,OPTIONS,POST,PUT'",
    "method.response.header.Access-Control-Allow-Origin"      = "'https://roamresearch.com'"
  }
}

data "aws_iam_role" "lambda_execution" {
  name = "roam-js-extensions-lambda-execution"
}

data "aws_iam_policy_document" "bucket_policy" {
  statement {
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]

    resources = [
      "arn:aws:s3:::roamjs-data/*",
    ]

    principals {
      type        = "AWS"
      identifiers = [data.aws_iam_role.lambda_execution.arn]
    }
  }
}

resource "aws_s3_bucket" "main" {
  bucket = "roamjs-data"
  policy = data.aws_iam_policy_document.bucket_policy.json
  tags = {
    Application = "Roam JS Extensions"
  }
}

resource "github_actions_secret" "stripe_public" {
  repository       = "roamjs-backend"
  secret_name      = "STRIPE_PUBLIC_KEY"
  plaintext_value  = var.stripe_public
}

resource "github_actions_secret" "stripe_secret" {
  repository       = "roamjs-backend"
  secret_name      = "STRIPE_SECRET_KEY"
  plaintext_value  = var.stripe_secret
}

resource "github_actions_secret" "stripe_dev_secret" {
  repository       = "roamjs-backend"
  secret_name      = "STRIPE_DEV_SECRET_KEY"
  plaintext_value  = var.stripe_dev_secret
}

resource "github_actions_secret" "clerk_api_key" {
  repository       = "roamjs-backend"
  secret_name      = "CLERK_API_KEY"
  plaintext_value  = var.clerk_api_key
}

resource "github_actions_secret" "clerk_dev_api_key" {
  repository       = "roamjs-backend"
  secret_name      = "CLERK_DEV_API_KEY"
  plaintext_value  = var.clerk_dev_api_key
}

resource "github_actions_secret" "encryption_secret" {
  repository       = "roamjs-backend"
  secret_name      = "ENCRYPTION_SECRET"
  plaintext_value  = var.encryption_secret
}

resource "github_actions_secret" "encryption_secret_dev" {
  repository       = "roamjs-backend"
  secret_name      = "ENCRYPTION_SECRET_DEV"
  plaintext_value  = var.encryption_secret_dev
}

resource "github_actions_secret" "stripe_checkout_secret" {
  repository       = "roamjs-backend"
  secret_name      = "STRIPE_CHECKOUT_SECRET"
  plaintext_value  = var.stripe_checkout_secret
}

resource "github_actions_secret" "stripe_dev_checkout_secret" {
  repository       = "roamjs-backend"
  secret_name      = "STRIPE_DEV_CHECKOUT_SECRET"
  plaintext_value  = var.stripe_dev_checkout_secret
}

resource "github_actions_secret" "dropbox_client_secret" {
  repository       = "roamjs-backend"
  secret_name      = "DROPBOX_CLIENT_SECRET"
  plaintext_value  = var.dropbox_client_secret
}

resource "github_actions_secret" "slack_client_secret" {
  repository       = "roamjs-backend"
  secret_name      = "SLACK_CLIENT_SECRET"
  plaintext_value  = var.slack_client_secret
}

resource "github_actions_secret" "google_client_secret" {
  repository       = "roamjs-backend"
  secret_name      = "GOOGLE_CLIENT_SECRET"
  plaintext_value  = var.google_client_secret
}

resource "github_actions_secret" "roam_api_token" {
  repository       = "roamjs-backend"
  secret_name      = "ROAM_API_TOKEN"
  plaintext_value  = var.roam_api_token
}

resource "github_actions_secret" "github_token" {
  repository       = "roamjs-backend"
  secret_name      = "ROAMJS_RELEASE_TOKEN"
  plaintext_value  = var.github_token
}

resource "github_actions_secret" "developer_token" {
  repository       = "roamjs-backend"
  secret_name      = "ROAMJS_DEVELOPER_TOKEN"
  plaintext_value  = var.developer_token
}

resource "github_actions_secret" "deploy_aws_access_secret" {
  repository       = "roamjs-backend"
  secret_name      = "DEPLOY_AWS_ACCESS_SECRET"
  plaintext_value  = var.aws_secret_token
}

resource "github_actions_secret" "deploy_aws_access_key" {
  repository       = "roamjs-backend"
  secret_name      = "DEPLOY_AWS_ACCESS_KEY"
  plaintext_value  = var.aws_access_token
}

data "github_repositories" "repos" {
  query = "author:dvargas92495 roamjs archived:false NOT -com NOT -scripts NOT -backend"
}

output "repos" {
  value = data.github_repositories.repos
}

# lambda resource requires either filename or s3... wow
data "archive_file" "dummy" {
  type        = "zip"
  output_path = "./dummy.zip"

  source {
    content   = "// TODO IMPLEMENT"
    filename  = "dummy.js"
  }
}

data "aws_iam_role" "roamjs_lambda_role" {
  name = "roam-js-extensions-lambda-execution"
}

resource "aws_lambda_function" "lambda_function_common" {
  function_name = "RoamJS_backend-common"
  role          = data.aws_iam_role.roamjs_lambda_role.arn
  handler       = "backend-common.handler"
  filename      = data.archive_file.dummy.output_path
  runtime       = "nodejs16.x"
  publish       = false
  timeout       = 30
  memory_size   = 5120

  tags = {
    Application = "Roam JS Extensions"
  }
}
