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

# CORS — allows the SPA to upload/download directly via presigned URLs
resource "aws_s3_bucket_cors_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = [
      "https://job-pilot.whyuascii.com",
      "http://localhost:5173",
    ]
    expose_headers  = ["ETag"]
    max_age_seconds = 3600
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

# ─── Web Hosting (S3 + CloudFront) ────────────────────────────────────────────
# Static SPA files served via CloudFront at job-pilot.whyuascii.com

data "aws_acm_certificate" "wildcard" {
  domain      = "*.whyuascii.com"
  statuses    = ["ISSUED"]
  most_recent = true
}

resource "aws_s3_bucket" "web" {
  bucket = "job-pilot-web-${data.aws_caller_identity.current.account_id}"
  tags   = var.tags
}

resource "aws_s3_bucket_policy" "web" {
  bucket = aws_s3_bucket.web.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Sid       = "AllowCloudFrontOAC"
      Effect    = "Allow"
      Principal = { Service = "cloudfront.amazonaws.com" }
      Action    = "s3:GetObject"
      Resource  = "${aws_s3_bucket.web.arn}/*"
      Condition = {
        StringEquals = {
          "AWS:SourceArn" = aws_cloudfront_distribution.web.arn
        }
      }
    }]
  })
}

resource "aws_cloudfront_origin_access_control" "web" {
  name                              = "job-pilot-web-oac"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "web" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = ["job-pilot.whyuascii.com"]
  price_class         = "PriceClass_100"
  tags                = var.tags

  origin {
    domain_name              = aws_s3_bucket.web.bucket_regional_domain_name
    origin_id                = "s3-web"
    origin_access_control_id = aws_cloudfront_origin_access_control.web.id
  }

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "s3-web"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000
  }

  # SPA routing — serve index.html for 403/404
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = data.aws_acm_certificate.wildcard.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}

# ─── ACM Certificate for API Subdomain ───────────────────────────────────────
# *.whyuascii.com only covers one level (e.g. job-pilot.whyuascii.com).
# api.job-pilot.whyuascii.com is two levels deep and needs its own cert.

resource "aws_acm_certificate" "api" {
  domain_name       = "api.job-pilot.whyuascii.com"
  validation_method = "DNS"
  tags              = var.tags

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "api_cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.api.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  zone_id         = data.aws_route53_zone.main.zone_id
  name            = each.value.name
  type            = each.value.type
  ttl             = 300
  records         = [each.value.record]
  allow_overwrite = true
}

resource "aws_acm_certificate_validation" "api" {
  certificate_arn         = aws_acm_certificate.api.arn
  validation_record_fqdns = [for record in aws_route53_record.api_cert_validation : record.fqdn]
}

# Attach API cert to the shared ALB listener (SNI selects the right cert per hostname)
resource "aws_lb_listener_certificate" "api" {
  listener_arn    = data.aws_ssm_parameter.alb_https_listener_arn.value
  certificate_arn = aws_acm_certificate_validation.api.certificate_arn
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
    { name = "API_URL", value = "https://api.job-pilot.whyuascii.com" },
    { name = "S3_BUCKET", value = aws_s3_bucket.storage.id },
    { name = "S3_REGION", value = var.aws_region },
    # No S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY — SDK uses IAM task role
  ]

  secrets = [
    { name = "DATABASE_URL", valueFrom = "/whyuascii/job-pilot/database-url" },
    { name = "BETTER_AUTH_SECRET", valueFrom = "/whyuascii/job-pilot/better-auth-secret" },
    { name = "ENCRYPTION_KEY", valueFrom = "/whyuascii/job-pilot/encryption-key" },
    { name = "ANTHROPIC_API_KEY", valueFrom = "/whyuascii/job-pilot/anthropic-api-key" },
    { name = "POSTHOG_API_KEY", valueFrom = "/whyuascii/job-pilot/posthog-api-key" },
    # Optional — add when needed:
    # { name = "REDIS_URL", valueFrom = "/whyuascii/job-pilot/redis-url" },
    # { name = "GOOGLE_CLIENT_ID", valueFrom = "/whyuascii/job-pilot/google-client-id" },
    # { name = "GOOGLE_CLIENT_SECRET", valueFrom = "/whyuascii/job-pilot/google-client-secret" },
    # { name = "GOOGLE_REDIRECT_URI", valueFrom = "/whyuascii/job-pilot/google-redirect-uri" },
  ]
}

# ─── DNS Records ──────────────────────────────────────────────────────────────

resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "job-pilot.whyuascii.com"
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.web.domain_name
    zone_id                = aws_cloudfront_distribution.web.hosted_zone_id
    evaluate_target_health = false
  }
}

# API still routes through the shared ALB
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
