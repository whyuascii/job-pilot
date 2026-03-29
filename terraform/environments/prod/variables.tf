variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

# ─── Web Service ──────────────────────────────────────────────────────────────

variable "web_image_tag" {
  description = "Docker image tag for the web service (set by CI — no default)"
  type        = string

  validation {
    condition     = var.web_image_tag != "latest"
    error_message = "Do not use 'latest' — pass the git SHA tag from CI."
  }
}

variable "web_cpu" {
  description = "CPU units for the web task (256 = 0.25 vCPU)"
  type        = number
  default     = 256
}

variable "web_memory" {
  description = "Memory in MiB for the web task"
  type        = number
  default     = 512
}

# ─── API Service ──────────────────────────────────────────────────────────────

variable "api_image_tag" {
  description = "Docker image tag for the API service (set by CI — no default)"
  type        = string

  validation {
    condition     = var.api_image_tag != "latest"
    error_message = "Do not use 'latest' — pass the git SHA tag from CI."
  }
}

variable "api_cpu" {
  description = "CPU units for the API task (1024 = 1 vCPU)"
  type        = number
  default     = 1024
}

variable "api_memory" {
  description = "Memory in MiB for the API task"
  type        = number
  default     = 2048
}

# ─── Common ───────────────────────────────────────────────────────────────────

variable "tags" {
  description = "Common tags for all resources"
  type        = map(string)
  default     = {}
}
