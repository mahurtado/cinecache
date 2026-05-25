# Step 1: Build the Go binary in an Alpine environment
FROM golang:1.22-alpine AS builder

WORKDIR /app

# Copy Go modules specifications and download dependencies
COPY go.mod go.sum ./
RUN go mod download

# Copy the source code and compile
COPY main.go ./
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o server .

# Step 2: Package the binary in a lightweight runtime image
FROM alpine:3.19

WORKDIR /app
COPY --from=builder /app/server .

# Expose default Cloud Run port
EXPOSE 8080

# Launch the Go HTTP API Server
CMD ["./server"]
