# ─── Target Group ─────────────────────────────────────────────────────────────

resource "aws_lb_target_group" "service" {
  name        = "whyuascii-${var.service_name}"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
  }

  tags = var.tags
}

# ─── Listener Rule ────────────────────────────────────────────────────────────
# Supports host-based routing, path-based routing, or both.

resource "aws_lb_listener_rule" "service" {
  listener_arn = local.alb_https_listener_arn
  priority     = var.listener_priority

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.service.arn
  }

  # Host-based routing (e.g., job-pilot.whyuascii.com)
  dynamic "condition" {
    for_each = var.host_header != "" ? [var.host_header] : []
    content {
      host_header {
        values = [condition.value]
      }
    }
  }

  # Path-based routing (e.g., /api/*)
  dynamic "condition" {
    for_each = var.path_pattern != "" ? [var.path_pattern] : []
    content {
      path_pattern {
        values = [condition.value]
      }
    }
  }

  tags = var.tags
}
