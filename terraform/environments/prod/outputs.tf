# ─── Web (S3 + CloudFront) ────────────────────────────────────────────────────

output "web_bucket_name" {
  description = "S3 bucket name for web static files"
  value       = aws_s3_bucket.web.id
}

output "web_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for cache invalidation"
  value       = aws_cloudfront_distribution.web.id
}

output "web_cloudfront_domain_name" {
  description = "CloudFront distribution domain name"
  value       = aws_cloudfront_distribution.web.domain_name
}

# ─── API (ECS) ────────────────────────────────────────────────────────────────

output "api_service_name" {
  description = "API ECS service name"
  value       = module.api.service_name
}

output "api_ecr_repository_url" {
  description = "API ECR repository URL"
  value       = module.api.ecr_repository_url
}

# ─── Shared ───────────────────────────────────────────────────────────────────

output "storage_bucket" {
  description = "S3 bucket name for application storage"
  value       = aws_s3_bucket.storage.id
}

output "web_url" {
  description = "Web application URL"
  value       = "https://job-pilot.whyuascii.com"
}

output "api_url" {
  description = "API URL"
  value       = "https://api.job-pilot.whyuascii.com"
}
