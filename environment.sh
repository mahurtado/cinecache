#!/bin/bash

# =====================================================================
# CineCache Google Cloud Platform (GCP) Deployment Configuration
# =====================================================================
# This file defines the environmental configurations required to compile,
# package, and deploy the CineCache application services onto GCP.
# Source this script before running any deployment command.
# =====================================================================

# 1. Target Google Cloud Project ID
# The GCP Project where all resources (Cloud Run, Memorystore, Artifact Registry) reside.
export PROJECT_ID="${PROJECT_ID:-YOUR_GCP_PROJECT_ID}"

# 2. Google Cloud Region
# The deployment region for Cloud Run services and Memorystore instances.
export REGION_1="${REGION_1:-YOUR_GCP_REGION}"

# 3. Serverless VPC Access Connector Name
# The VPC Access Connector used to establish private connections from Cloud Run to Memorystore.
# Format: projects/PROJECT_ID/locations/REGION/connectors/CONNECTOR_NAME
export VPC_ACCESS_CONNECTOR_NAME="projects/${PROJECT_ID}/locations/${REGION_1}/connectors/cinecache-vpc-connector"

# 4. Google Cloud Memorystore instance names
# The name of the target Memorystore database instance.
export VALKEY_SINGLE_NAME="cinecache-valkey"

# 5. Artifact Registry Repository Name
# The Artifact Registry repository name where Docker container images are stored.
# Create this repository beforehand in your project using:
# gcloud artifacts repositories create REPO_NAME --repository-format=docker --location=REGION
export REPO_NAME="cinecache-repo"
