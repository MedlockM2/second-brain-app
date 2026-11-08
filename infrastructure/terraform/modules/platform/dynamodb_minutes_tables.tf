# DynamoDB table for subscriptions

# Subscriptions table
resource "aws_dynamodb_table" "subscriptions" {
  name         = "subscriptions${local.suffix}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
  attribute {
    name = "user_id"
    type = "S"
  }

  # GSI: user-index
  global_secondary_index {
    name            = "user-index"
    hash_key        = "user_id"
    projection_type = "ALL"
  }

  tags = {
    Name = "subscriptions${local.suffix}"
  }

  point_in_time_recovery {
    enabled = true
  }

  deletion_protection_enabled = true

  lifecycle {
    prevent_destroy = true
  }
}

# Outputs
output "subscriptions_table_name" { value = aws_dynamodb_table.subscriptions.name }
