variable "IMAGE_PREFIX" {
  default = "ghcr.io/example/ecs"
}

variable "IMAGE_TAG" {
  default = "main"
}

variable "GIT_SHA" {
  default = "local"
}

group "default" {
  targets = ["platform-api", "medusa", "dashboard", "storefront"]
}

target "common" {
  context    = "."
  dockerfile = "infra/docker/Dockerfile"
  platforms  = ["linux/amd64"]
  cache-from = ["type=gha,scope=ecs-images"]
  cache-to   = ["type=gha,scope=ecs-images,mode=max"]
  labels = {
    "org.opencontainers.image.revision" = GIT_SHA
  }
}

target "platform-api" {
  inherits = ["common"]
  target   = "platform-api"
  tags = [
    "${IMAGE_PREFIX}/platform-api:${IMAGE_TAG}",
    "${IMAGE_PREFIX}/platform-api:sha-${GIT_SHA}",
  ]
}

target "medusa" {
  inherits = ["common"]
  target   = "medusa"
  tags = [
    "${IMAGE_PREFIX}/medusa:${IMAGE_TAG}",
    "${IMAGE_PREFIX}/medusa:sha-${GIT_SHA}",
  ]
}

target "dashboard" {
  inherits = ["common"]
  target   = "dashboard"
  tags = [
    "${IMAGE_PREFIX}/dashboard:${IMAGE_TAG}",
    "${IMAGE_PREFIX}/dashboard:sha-${GIT_SHA}",
  ]
}

target "storefront" {
  inherits = ["common"]
  target   = "storefront"
  tags = [
    "${IMAGE_PREFIX}/storefront:${IMAGE_TAG}",
    "${IMAGE_PREFIX}/storefront:sha-${GIT_SHA}",
  ]
}
