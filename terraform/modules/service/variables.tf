variable "service_name" {
  description = "Name of the ECS service"
  type        = string
}

variable "container_port" {
  description = "Port the container listens on"
  type        = number
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
}

variable "cpu" {
  description = "CPU units (256 = 0.25 vCPU)"
  type        = number
}

variable "memory" {
  description = "Memory in MiB"
  type        = number
}

variable "host_header" {
  description = "Host header for ALB routing (e.g., app.example.com). At least one of host_header or path_pattern required."
  type        = string
  default     = ""
}

variable "path_pattern" {
  description = "Path pattern for ALB routing (e.g., /api/*). At least one of host_header or path_pattern required."
  type        = string
  default     = ""
}

variable "health_check_path" {
  description = "Health check endpoint path"
  type        = string
  default     = "/health"
}

variable "desired_count" {
  description = "Number of tasks to run"
  type        = number
  default     = 1
}

variable "environment_variables" {
  description = "Non-sensitive environment variables for the container"
  type = list(object({
    name  = string
    value = string
  }))
  default = []
}

variable "secrets" {
  description = "Secrets from SSM Parameter Store (name = env var name, valueFrom = SSM parameter ARN or name)"
  type = list(object({
    name      = string
    valueFrom = string
  }))
  default = []
}

variable "shm_size_mb" {
  description = "Shared memory size in MB (0 to disable). Required for Chromium/Playwright."
  type        = number
  default     = 0
}

variable "listener_priority" {
  description = "ALB listener rule priority (null for auto-assigned)"
  type        = number
  default     = null
}

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
