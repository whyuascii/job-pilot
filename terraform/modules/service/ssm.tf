# ─── Shared Infrastructure from SSM Parameter Store ───────────────────────────
# All values managed by whyuascii/whyuascii repo. Never hardcode.

data "aws_ssm_parameter" "cluster_arn" {
  name = "/whyuascii/ecs/cluster-arn"
}

data "aws_ssm_parameter" "vpc_id" {
  name = "/whyuascii/ecs/vpc-id"
}

data "aws_ssm_parameter" "private_subnet_ids" {
  name = "/whyuascii/ecs/private-subnet-ids"
}

data "aws_ssm_parameter" "alb_https_listener_arn" {
  name = "/whyuascii/ecs/alb-https-listener-arn"
}

data "aws_ssm_parameter" "ecs_tasks_sg_id" {
  name = "/whyuascii/ecs/ecs-tasks-sg-id"
}

data "aws_ssm_parameter" "task_execution_role_arn" {
  name = "/whyuascii/ecs/task-execution-role-arn"
}

data "aws_ssm_parameter" "task_role_arn" {
  name = "/whyuascii/ecs/task-role-arn"
}

data "aws_ssm_parameter" "service_discovery_namespace_id" {
  name = "/whyuascii/ecs/service-discovery-namespace-id"
}

locals {
  cluster_arn                    = data.aws_ssm_parameter.cluster_arn.value
  vpc_id                         = data.aws_ssm_parameter.vpc_id.value
  private_subnet_ids             = split(",", data.aws_ssm_parameter.private_subnet_ids.value)
  alb_https_listener_arn         = data.aws_ssm_parameter.alb_https_listener_arn.value
  ecs_tasks_sg_id                = data.aws_ssm_parameter.ecs_tasks_sg_id.value
  task_execution_role_arn        = data.aws_ssm_parameter.task_execution_role_arn.value
  task_role_arn                  = data.aws_ssm_parameter.task_role_arn.value
  service_discovery_namespace_id = data.aws_ssm_parameter.service_discovery_namespace_id.value
}
