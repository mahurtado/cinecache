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
echo "Deploying Movies Go Backend on Google Cloud Run"
echo "Project ID:     $PROJECT_ID"
echo "Region:         $REGION_1"
echo "VPC Connector:  $VPC_ACCESS_CONNECTOR_NAME"
echo "====================================================================="

# 1. Discover Valkey Single private IP endpoint to set as default VALKEY_HOST
echo "Discovering private endpoint for Valkey Single ($VALKEY_SINGLE_NAME)..."
VALKEY_IP=$(gcloud memorystore instances describe "$VALKEY_SINGLE_NAME" \
  --location="$REGION_1" \
  --project="$PROJECT_ID" \
  --format="value(endpoints[0].connections[0].pscAutoConnection.ipAddress)" 2>/dev/null)

if [ -z "$VALKEY_IP" ]; then
  VALKEY_IP=$(gcloud memorystore instances describe "$VALKEY_SINGLE_NAME" \
    --location="$REGION_1" \
    --project="$PROJECT_ID" \
    --format="value(endpoints[0].pscConnections[0].address)" 2>/dev/null)
fi

if [ -z "$VALKEY_IP" ]; then
  echo "Error: Valkey Single private IP could not be discovered."
  echo "Please provision the Memorystore Valkey resources first."
  exit 1
fi

VALKEY_HOST="$VALKEY_IP"
echo "Valkey IP Discovered: $VALKEY_HOST"

# 2. Build container using Google Cloud Build
IMAGE_TAG="europe-west1-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/movies-backend:latest"
echo "Submitting compilation build to Cloud Build: $IMAGE_TAG..."

gcloud builds submit --tag "$IMAGE_TAG" --project="$PROJECT_ID" "$DIR"

if [ $? -ne 0 ]; then
  echo "Error: Cloud Build compilation failed."
  exit 1
fi

# 3. Deploy to Google Cloud Run
echo "Deploying Movies Backend to Cloud Run..."
gcloud run deploy movies-backend \
  --image="$IMAGE_TAG" \
  --region="$REGION_1" \
  --vpc-connector="$VPC_ACCESS_CONNECTOR_NAME" \
  --allow-unauthenticated \
  --update-env-vars VALKEY_HOST="$VALKEY_HOST",VALKEY_PORT=6379 \
  --project="$PROJECT_ID"

if [ $? -eq 0 ]; then
  echo "====================================================================="
  echo "Go Backend Deployed Successfully!"
  echo "====================================================================="
  echo "Access the API server securely using:"
  echo "  gcloud run services describe movies-backend --region=$REGION_1 --format='value(status.url)'"
  echo ""
  echo "Available API Endpoints:"
  echo "  GET  /api/movies"
  echo "  GET  /api/movies/{id}"
  echo "  GET  /api/genres"
  echo "  GET  /api/genres/{id}/movies"
  echo "  GET  /api/collections/{id}"
  echo "  GET  /api/movies/year/{year}"
  echo "  POST /api/movies/{id}/rate"
  echo "====================================================================="
else
  echo "Error: Cloud Run deployment failed."
  exit 1
fi
