#!/bin/bash

# Determine script directory and source environment variables
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -f "$DIR/../environment.sh" ]; then
  source "$DIR/../environment.sh"
else
  echo "Error: environment.sh not found in $DIR/.."
  exit 1
fi

echo "====================================================================="
echo "Deploying Movies Next.js Frontend on Google Cloud Run"
echo "Project ID:     $PROJECT_ID"
echo "Region:         $REGION_1"
echo "VPC Connector:  $VPC_ACCESS_CONNECTOR_NAME"
echo "====================================================================="

# 1. Discover backend Cloud Run service URL dynamically
echo "Discovering Movies Go Backend Service URL..."
BACKEND_URL=$(gcloud run services describe movies-backend \
  --region="$REGION_1" \
  --project="$PROJECT_ID" \
  --format="value(status.url)" 2>/dev/null)

if [ -z "$BACKEND_URL" ]; then
  echo "Error: Movies Go Backend (movies-backend) service URL could not be discovered."
  echo "Please ensure the backend is deployed first using ./cinecache-backend/deploy.sh."
  exit 1
fi

echo "Backend Service Discovered: $BACKEND_URL"

# 2. Build container using Google Cloud Build
IMAGE_TAG="europe-west1-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/movies-frontend:latest"
echo "Submitting frontend build to Cloud Build: $IMAGE_TAG..."

gcloud builds submit --tag "$IMAGE_TAG" --project="$PROJECT_ID" "$DIR"

if [ $? -ne 0 ]; then
  echo "Error: Cloud Build compilation failed."
  exit 1
fi

# 3. Deploy to Google Cloud Run
echo "Deploying Movies Frontend to Cloud Run..."
gcloud run deploy movies-frontend \
  --image="$IMAGE_TAG" \
  --region="$REGION_1" \
  --vpc-connector="$VPC_ACCESS_CONNECTOR_NAME" \
  --allow-unauthenticated \
  --update-env-vars BACKEND_URL="$BACKEND_URL" \
  --project="$PROJECT_ID"

if [ $? -eq 0 ]; then
  echo "====================================================================="
  echo "Next.js Frontend Deployed Successfully!"
  echo "====================================================================="
  echo "Access the frontend application securely using:"
  echo "  gcloud run services describe movies-frontend --region=$REGION_1 --format='value(status.url)'"
  echo "====================================================================="
else
  echo "Error: Cloud Run deployment failed."
  exit 1
fi
