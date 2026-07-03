#!/bin/bash
# Deploy Console Service Cloud SQL Integration Tests Job
# This script builds the test image and deploys it as a Cloud Run Job

set -e

# Configuration
PROJECT_ID="${GCP_PROJECT_ID}"
REGION="asia-northeast1"
JOB_NAME="console-integration-tests"
IMAGE="asia-northeast1-docker.pkg.dev/${PROJECT_ID}/gm-services/console-integration-tests:latest"
VPC_CONNECTOR="projects/${PROJECT_ID}/locations/${REGION}/connectors/cr-conn-default-ane1"
SERVICE_ACCOUNT="codex-dev@${PROJECT_ID}.iam.gserviceaccount.com"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Console Integration Tests Deployment${NC}"
echo -e "${YELLOW}========================================${NC}"

# Step 1: Create optimized tarball (following monorepo best practices)
echo -e "\n${GREEN}Step 1: Creating optimized source tarball...${NC}"
TARBALL="/tmp/console-test-source.tar.gz"

tar -czf "$TARBALL" \
  --exclude='apps' \
  --exclude='makerkit' \
  --exclude='docs' \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='.next' \
  go.work go.work.sum \
  services/console \
  pkg

TARBALL_SIZE=$(du -h "$TARBALL" | cut -f1)
echo -e "${GREEN}✅ Tarball created: ${TARBALL_SIZE}${NC}"

# Step 2: Build test image using Cloud Build
echo -e "\n${GREEN}Step 2: Building test image...${NC}"
gcloud builds submit "$TARBALL" \
  --config=deployments/cloudbuild/build-console-test-job.yaml \
  --project="${PROJECT_ID}" \
  --substitutions=_IMAGE="${IMAGE}"

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Failed to build test image${NC}"
    rm -f "$TARBALL"
    exit 1
fi

echo -e "${GREEN}✅ Test image built successfully${NC}"
rm -f "$TARBALL"

# Step 3: Get database password from Secret Manager
echo -e "\n${GREEN}Step 3: Fetching database password from Secret Manager...${NC}"
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="DATABASE_URL" \
  --project="${PROJECT_ID}" | \
  sed -n 's/.*postgres:\([^@]*\)@.*/\1/p' | \
  python3 -c "import sys; from urllib.parse import unquote; print(unquote(sys.stdin.read().strip()))")

if [ -z "$DB_PASSWORD" ]; then
    echo -e "${RED}❌ Failed to fetch database password${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Database password fetched${NC}"

# Step 4: Check if job exists
echo -e "\n${GREEN}Step 4: Checking if Cloud Run Job exists...${NC}"
JOB_EXISTS=$(gcloud run jobs describe "${JOB_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format="value(name)" 2>/dev/null || echo "")

if [ -z "$JOB_EXISTS" ]; then
    # Job doesn't exist, create it
    echo -e "${YELLOW}Job doesn't exist, creating new job...${NC}"

    gcloud run jobs create "${JOB_NAME}" \
      --image="${IMAGE}" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --service-account="${SERVICE_ACCOUNT}" \
      --vpc-connector="${VPC_CONNECTOR}" \
      --vpc-egress=all-traffic \
      --set-env-vars="RUN_CLOUD_SQL_TESTS=true,TEST_ENVIRONMENT=cloud-run-job" \
      --set-secrets="CLOUDSQL_DATABASE_URL=DATABASE_URL:latest" \
      --memory=2Gi \
      --cpu=2 \
      --max-retries=3 \
      --task-timeout=10m

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to create Cloud Run Job${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Cloud Run Job created successfully${NC}"
else
    # Job exists, update it
    echo -e "${YELLOW}Job exists, updating existing job...${NC}"

    gcloud run jobs update "${JOB_NAME}" \
      --image="${IMAGE}" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --service-account="${SERVICE_ACCOUNT}" \
      --vpc-connector="${VPC_CONNECTOR}" \
      --vpc-egress=all-traffic \
      --set-env-vars="RUN_CLOUD_SQL_TESTS=true,TEST_ENVIRONMENT=cloud-run-job" \
      --update-secrets="CLOUDSQL_DATABASE_URL=DATABASE_URL:latest" \
      --memory=2Gi \
      --cpu=2 \
      --max-retries=3 \
      --task-timeout=10m

    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Failed to update Cloud Run Job${NC}"
        exit 1
    fi

    echo -e "${GREEN}✅ Cloud Run Job updated successfully${NC}"
fi

# Step 4: Execute the job (optional, can be triggered by CI/CD)
echo -e "\n${YELLOW}========================================${NC}"
echo -e "${YELLOW}Deployment Complete!${NC}"
echo -e "${YELLOW}========================================${NC}"

echo -e "\n${GREEN}To run the integration tests, execute:${NC}"
echo -e "${YELLOW}gcloud run jobs execute ${JOB_NAME} --region=${REGION} --project=${PROJECT_ID} --wait${NC}"

echo -e "\n${GREEN}To view job executions:${NC}"
echo -e "${YELLOW}gcloud run jobs executions list --job=${JOB_NAME} --region=${REGION} --project=${PROJECT_ID}${NC}"

echo -e "\n${GREEN}To view execution logs:${NC}"
echo -e "${YELLOW}gcloud run jobs executions describe <EXECUTION_ID> --region=${REGION} --project=${PROJECT_ID}${NC}"

# Ask if user wants to run the job now
read -p "$(echo -e ${YELLOW}Do you want to run the integration tests now? [y/N]: ${NC})" -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "\n${GREEN}Executing integration tests...${NC}"
    gcloud run jobs execute "${JOB_NAME}" \
      --region="${REGION}" \
      --project="${PROJECT_ID}" \
      --wait

    if [ $? -eq 0 ]; then
        echo -e "\n${GREEN}✅ Integration tests completed successfully!${NC}"
    else
        echo -e "\n${RED}❌ Integration tests failed. Check logs for details.${NC}"
        exit 1
    fi
fi

echo -e "\n${GREEN}✅ Done!${NC}"
