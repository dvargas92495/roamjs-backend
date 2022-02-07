terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      prefix = "roamjs-base"
    }
  }
  required_providers {
    github = {
      source = "integrations/github"
      version = "4.2.0"
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

provider "aws" {
  region = "us-east-1"
  access_key = var.aws_access_token
  secret_key = var.aws_secret_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

module "roamjs_lambda" {
  source = "dvargas92495/lambda/roamjs"
  providers = {
    aws = aws
    github = github
  }

  name = "base"
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
  ]
  aws_access_token = var.aws_access_token
  aws_secret_token = var.aws_secret_token
  github_token     = var.github_token
  developer_token  = var.developer_token
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
  repository       = "roamjs-base"
  secret_name      = "STRIPE_PUBLIC_KEY"
  plaintext_value  = var.stripe_public
}

resource "github_actions_secret" "stripe_secret" {
  repository       = "roamjs-base"
  secret_name      = "STRIPE_SECRET_KEY"
  plaintext_value  = var.stripe_secret
}

resource "github_actions_secret" "stripe_dev_secret" {
  repository       = "roamjs-base"
  secret_name      = "STRIPE_DEV_SECRET_KEY"
  plaintext_value  = var.stripe_dev_secret
}

resource "github_actions_secret" "clerk_api_key" {
  repository       = "roamjs-base"
  secret_name      = "CLERK_API_KEY"
  plaintext_value  = var.clerk_api_key
}

resource "github_actions_secret" "clerk_dev_api_key" {
  repository       = "roamjs-base"
  secret_name      = "CLERK_DEV_API_KEY"
  plaintext_value  = var.clerk_dev_api_key
}

resource "github_actions_secret" "encryption_secret" {
  repository       = "roamjs-base"
  secret_name      = "ENCRYPTION_SECRET"
  plaintext_value  = var.encryption_secret
}

resource "github_actions_secret" "encryption_secret_dev" {
  repository       = "roamjs-base"
  secret_name      = "ENCRYPTION_SECRET_DEV"
  plaintext_value  = var.encryption_secret_dev
}

resource "github_actions_secret" "stripe_checkout_secret" {
  repository       = "roamjs-base"
  secret_name      = "STRIPE_CHECKOUT_SECRET"
  plaintext_value  = var.stripe_checkout_secret
}

resource "github_actions_secret" "stripe_dev_checkout_secret" {
  repository       = "roamjs-base"
  secret_name      = "STRIPE_DEV_CHECKOUT_SECRET"
  plaintext_value  = var.stripe_dev_checkout_secret
}
