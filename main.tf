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
    aws = {
      // https://github.com/hashicorp/terraform-provider-aws/issues/29777
      version = "4.56.0"
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
      path = "oauth", 
      method = "get"
    },
    { 
      path = "oauth", 
      method = "put"
    },
    { 
      path = "auth", 
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
      path = "user",
      method = "get"
    },
    {
      path = "user",
      method = "put"
    },
    {
      path = "users",
      method = "post"
    },
    {
      path = "check",
      method = "get"
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
  ]

  lambdas_by_key = {
    for lambda in local.lambdas: "${lambda.path}_${lambda.method}" => lambda
  }

  roamjs_paths = ["oauth"]
  
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
  for_each    = toset(keys(local.lambdas_by_key))

  function_name = "RoamJS_${local.lambdas_by_key[each.value].path}_${lower(local.lambdas_by_key[each.value].method)}"
  role          = aws_iam_role.roamjs_lambda_role.arn
  handler       = "${local.lambdas_by_key[each.value].path}_${lower(local.lambdas_by_key[each.value].method)}.handler"
  filename      = data.archive_file.dummy.output_path
  runtime       = "nodejs16.x"
  publish       = false
  timeout       = 10
  memory_size   = 128

  tags = {
    Application = "Roam JS Extensions"
  }
}

resource "aws_api_gateway_method" "method" {
  for_each    = toset(keys(local.lambdas_by_key))

  rest_api_id   = data.aws_api_gateway_rest_api.rest_api.id
  resource_id   = aws_api_gateway_resource.resource[local.lambdas_by_key[each.value].path].id
  http_method   = upper(local.lambdas_by_key[each.value].method)
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "integration" {
  for_each    = toset(keys(local.lambdas_by_key))

  rest_api_id             = data.aws_api_gateway_rest_api.rest_api.id
  resource_id             = aws_api_gateway_resource.resource[local.lambdas_by_key[each.value].path].id
  http_method             = aws_api_gateway_method.method[each.value].http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.lambda_function[each.value].invoke_arn
}

resource "aws_lambda_permission" "apigw_lambda" {
  for_each    = toset(keys(local.lambdas_by_key))
  
  statement_id  = "AllowExecutionFromAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.lambda_function[each.value].function_name
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
    "method.response.header.Access-Control-Allow-Origin"      = contains(local.roamjs_paths, each.value) ? "'https://roamjs.com'" : "'https://roamresearch.com'"
  }
}

data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "lambda_execution_policy" {
  statement {
    actions = [
      "cloudfront:CreateInvalidation",
      "cloudfront:GetInvalidation",
      "cloudfront:ListDistributions",
      "dynamodb:BatchGetItem",
      "dynamodb:GetItem",
      "dynamodb:Query",
      "dynamodb:Scan",
      "dynamodb:BatchWriteItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "execute-api:Invoke",
      "execute-api:ManageConnections",
      "lambda:InvokeFunction",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:CreateLogGroup",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:PutObject",
      "s3:DeleteObject",
      "ses:sendEmail",
    ]
    resources = ["*"]
  }

  statement {
    actions = [
      "sts:AssumeRole"
    ]
    resources = [
      "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/roam-js-extensions-lambda-execution"
    ]
  }
}

resource "aws_iam_policy" "lambda_execution_policy" {
  name = "roam-js-extensions-lambda-execution"
  policy = data.aws_iam_policy_document.lambda_execution_policy.json
}

resource "aws_iam_role" "roamjs_lambda_role" {
  name = "roam-js-extensions-lambda-execution"

  assume_role_policy = data.aws_iam_policy_document.assume_lambda_policy.json
  tags = {
    Application = "Roam JS Extensions"
  }
}

resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.roamjs_lambda_role.name
  policy_arn = aws_iam_policy.lambda_execution_policy.arn
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
      identifiers = [aws_iam_role.roamjs_lambda_role.arn]
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
  repository       = "roamjs-base"
  secret_name      = "ROAMJS_RELEASE_TOKEN"
  plaintext_value  = var.github_token
}

resource "github_actions_secret" "developer_token" {
  repository       = "roamjs-base"
  secret_name      = "ROAMJS_DEVELOPER_TOKEN"
  plaintext_value  = var.developer_token
}

resource "github_actions_secret" "deploy_aws_access_secret" {
  repository       = "roamjs-base"
  secret_name      = "DEPLOY_AWS_ACCESS_SECRET"
  plaintext_value  = var.aws_secret_token
}

resource "github_actions_secret" "deploy_aws_access_key" {
  repository       = "roamjs-base"
  secret_name      = "DEPLOY_AWS_ACCESS_KEY"
  plaintext_value  = var.aws_access_token
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

data "aws_iam_policy_document" "assume_lambda_policy" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }
  }
}

resource "aws_lambda_function" "lambda_function_common" {
  function_name = "RoamJS_backend-common"
  role          = aws_iam_role.roamjs_lambda_role.arn
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
