output "service_name" {
  description = "ECS service name"
  value       = aws_ecs_service.service.name
}

output "ecr_repository_url" {
  description = "ECR repository URL for Docker push"
  value       = aws_ecr_repository.service.repository_url
}

output "target_group_arn" {
  description = "ALB target group ARN"
  value       = aws_lb_target_group.service.arn
}

output "log_group" {
  description = "CloudWatch log group name"
  value       = aws_cloudwatch_log_group.service.name
}

output "task_definition_family" {
  description = "ECS task definition family"
  value       = aws_ecs_task_definition.service.family
}
