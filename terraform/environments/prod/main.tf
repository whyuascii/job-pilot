terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket       = "whyuascii-terraform-state"
    key          = "prod/job-pilot/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
    encrypt      = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = var.tags
  }
}

# ─── Data Sources ─────────────────────────────────────────────────────────────

data "aws_caller_identity" "current" {}

data "aws_ssm_parameter" "alb_https_listener_arn" {
  name = "/whyuascii/ecs/alb-https-listener-arn"
}

data "aws_lb_listener" "https" {
  arn = data.aws_ssm_parameter.alb_https_listener_arn.value
}

data "aws_lb" "main" {
  arn = data.aws_lb_listener.https.load_balancer_arn
}

data "aws_route53_zone" "main" {
  name = "whyuascii.com"
}

# ─── SSM Access for Task Execution Role ──────────────────────────────────────
# The shared task execution role needs permission to read this project's secrets.

data "aws_ssm_parameter" "task_execution_role_arn" {
  name = "/whyuascii/ecs/task-execution-role-arn"
}

resource "aws_iam_role_policy" "job_pilot_ssm" {
  name = "job-pilot-ssm-access"
  role = regex("role/(.+)$", data.aws_ssm_parameter.task_execution_role_arn.value)[0]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadJobPilotSecrets"
        Effect = "Allow"
        Action = [
          "ssm:GetParameters",
          "ssm:GetParameter",
        ]
        Resource = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter/whyuascii/job-pilot/*"
      }
    ]
  })
}

# ─── S3 Bucket (Application Storage) ─────────────────────────────────────────
# Replaces MinIO in production. Encrypted, versioned, no public access.

resource "aws_s3_bucket" "storage" {
  bucket = "job-pilot-storage-${data.aws_caller_identity.current.account_id}"
  tags   = var.tags
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "storage" {
  bucket                  = aws_s3_bucket.storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  rule {
    id     = "cleanup-old-versions"
    status = "Enabled"
    filter {}
    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Grant the shared ECS task role access to the bucket.
# No S3 access keys needed — the AWS SDK discovers credentials from the task role.
data "aws_ssm_parameter" "task_role_arn" {
  name = "/whyuascii/ecs/task-role-arn"
}

resource "aws_s3_bucket_policy" "storage" {
  bucket = aws_s3_bucket.storage.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowECSTaskRole"
        Effect = "Allow"
        Principal = {
          AWS = data.aws_ssm_parameter.task_role_arn.value
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket",
        ]
        Resource = [
          aws_s3_bucket.storage.arn,
          "${aws_s3_bucket.storage.arn}/*",
        ]
      }
    ]
  })
}

# ─── Web Service ──────────────────────────────────────────────────────────────
# TanStack Start frontend at job-pilot.whyuascii.com

module "web" {
  source = "../../modules/service"

  service_name      = "job-pilot-web"
  container_port    = 3000
  image_tag         = var.web_image_tag
  cpu               = var.web_cpu
  memory            = var.web_memory
  host_header       = "job-pilot.whyuascii.com"
  health_check_path = "/"
  desired_count     = 1
  listener_priority = 110
  tags              = var.tags

  environment_variables = [
    { name = "PORT", value = "3000" },
    { name = "NODE_ENV", value = "production" },
    { name = "API_URL", value = "https://api.job-pilot.whyuascii.com" },
  ]

  secrets = [
    { name = "DATABASE_URL", valueFrom = "/whyuascii/job-pilot/database-url" },
    { name = "BETTER_AUTH_SECRET", valueFrom = "/whyuascii/job-pilot/better-auth-secret" },
    { name = "ENCRYPTION_KEY", valueFrom = "/whyuascii/job-pilot/encryption-key" },
    # Optional — add when needed:
    # { name = "REDIS_URL", valueFrom = "/whyuascii/job-pilot/redis-url" },
  ]
}

# ─── API Service ──────────────────────────────────────────────────────────────
# Express API at api.job-pilot.whyuascii.com

module "api" {
  source = "../../modules/service"

  service_name      = "job-pilot-api"
  container_port    = 3001
  image_tag         = var.api_image_tag
  cpu               = var.api_cpu
  memory            = var.api_memory
  host_header       = "api.job-pilot.whyuascii.com"
  health_check_path = "/health"
  desired_count     = 1
  listener_priority = 111
  tags              = var.tags

  environment_variables = [
    { name = "PORT", value = "3001" },
    { name = "NODE_ENV", value = "production" },
    { name = "APP_URL", value = "https://job-pilot.whyuascii.com" },
    { name = "S3_BUCKET", value = aws_s3_bucket.storage.id },
    { name = "S3_REGION", value = var.aws_region },
  ]

  secrets = [
    { name = "DATABASE_URL", valueFrom = "/whyuascii/job-pilot/database-url" },
    { name = "BETTER_AUTH_SECRET", valueFrom = "/whyuascii/job-pilot/better-auth-secret" },
    { name = "ENCRYPTION_KEY", valueFrom = "/whyuascii/job-pilot/encryption-key" },
    # Optional — add when needed:
    # { name = "REDIS_URL", valueFrom = "/whyuascii/job-pilot/redis-url" },
    # { name = "GOOGLE_CLIENT_ID", valueFrom = "/whyuascii/job-pilot/google-client-id" },
    # { name = "GOOGLE_CLIENT_SECRET", valueFrom = "/whyuascii/job-pilot/google-client-secret" },
    # { name = "GOOGLE_REDIRECT_URI", valueFrom = "/whyuascii/job-pilot/google-redirect-uri" },
  ]
}

# ─── DNS Records ──────────────────────────────────────────────────────────────
# Point subdomains to the shared ALB (wildcard cert covers *.whyuascii.com)

resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "job-pilot.whyuascii.com"
  type    = "A"

  alias {
    name                   = data.aws_lb.main.dns_name
    zone_id                = data.aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.job-pilot.whyuascii.com"
  type    = "A"

  alias {
    name                   = data.aws_lb.main.dns_name
    zone_id                = data.aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
