# Non-sensitive values only. This file is committed to git.
# Secrets are stored in AWS SSM Parameter Store.

web_cpu    = 256
web_memory = 512

api_cpu    = 1024
api_memory = 2048

tags = {
  Project     = "whyuascii"
  Service     = "job-pilot"
  Environment = "prod"
  ManagedBy   = "terraform"
  Owner       = "whyuascii"
  Repository  = "whyuascii/job-pilot"
  CostCenter  = "whyuascii-prod"
}
