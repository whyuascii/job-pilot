data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

# ─── CloudWatch Logs ──────────────────────────────────────────────────────────

resource "aws_cloudwatch_log_group" "service" {
  name              = "/ecs/whyuascii/${var.service_name}"
  retention_in_days = 30
  tags              = var.tags
}

# ─── Task Definition ──────────────────────────────────────────────────────────

locals {
  # Build secrets list with full SSM ARNs for the task execution role
  resolved_secrets = [
    for s in var.secrets : {
      name      = s.name
      valueFrom = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:parameter${s.valueFrom}"
    }
  ]

  # Base container definition
  base_container = {
    name      = var.service_name
    image     = "${aws_ecr_repository.service.repository_url}:${var.image_tag}"
    essential = true

    portMappings = [
      {
        containerPort = var.container_port
        protocol      = "tcp"
      }
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.service.name
        "awslogs-region"        = data.aws_region.current.name
        "awslogs-stream-prefix" = var.service_name
      }
    }

    environment = var.environment_variables
    secrets     = local.resolved_secrets
  }

  # Add linuxParameters only when shared memory is needed (Chromium/Playwright)
  container_definition = merge(local.base_container, var.shm_size_mb > 0 ? {
    linuxParameters = {
      sharedMemorySize = var.shm_size_mb
    }
  } : {})
}

resource "aws_ecs_task_definition" "service" {
  family                   = "whyuascii-${var.service_name}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = local.task_execution_role_arn
  task_role_arn            = local.task_role_arn

  container_definitions = jsonencode([local.container_definition])

  tags = var.tags
}

# ─── ECS Service ──────────────────────────────────────────────────────────────

resource "aws_ecs_service" "service" {
  name            = var.service_name
  cluster         = local.cluster_arn
  task_definition = aws_ecs_task_definition.service.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [local.ecs_tasks_sg_id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.service.arn
    container_name   = var.service_name
    container_port   = var.container_port
  }

  service_registries {
    registry_arn = aws_service_discovery_service.service.arn
  }

  # Allow GitHub Actions to update the image without Terraform fighting it
  lifecycle {
    ignore_changes = [task_definition]
  }

  tags = var.tags
}

# ─── Service Discovery ────────────────────────────────────────────────────────

resource "aws_service_discovery_service" "service" {
  name = var.service_name

  dns_config {
    namespace_id = local.service_discovery_namespace_id

    dns_records {
      ttl  = 10
      type = "A"
    }

    routing_policy = "MULTIVALUE"
  }

  health_check_custom_config {
    failure_threshold = 1
  }
}
