output "web_service_name" {
  description = "Web ECS service name"
  value       = module.web.service_name
}

output "web_ecr_repository_url" {
  description = "Web ECR repository URL"
  value       = module.web.ecr_repository_url
}

output "api_service_name" {
  description = "API ECS service name"
  value       = module.api.service_name
}

output "api_ecr_repository_url" {
  description = "API ECR repository URL"
  value       = module.api.ecr_repository_url
}

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
