#!/bin/bash

# Test script for uploading images to the gallery
# Usage: ./testGalleryUpload.sh [view_id] [image_path] [caption] [ttl_hours]

SERVER_URL="${SERVER_URL:-http://localhost:3000}"
VIEW_ID="${1:-gallery}"
IMAGE_PATH="${2:-~/Pictures/20190928_164642.jpg}"
CAPTION="${3:-Test Gallery Image}"
TTL="${4:-2}"

if [ ! -f "$IMAGE_PATH" ]; then
  echo "Error: Image file not found: $IMAGE_PATH"
  echo "Usage: $0 <view_id> <image_path> [caption] [ttl_hours]"
  exit 1
fi

echo "Uploading image to gallery..."
echo "  View ID: $VIEW_ID"
echo "  File: $IMAGE_PATH"
echo "  Caption: $CAPTION"
echo "  TTL: $TTL hours"
echo "  Server: $SERVER_URL"
echo ""

response=$(curl -s -X POST "$SERVER_URL/api/gallery/upload" \
  -F "viewId=$VIEW_ID" \
  -F "image=@$IMAGE_PATH" \
  -F "caption=$CAPTION" \
  -F "ttl=$TTL")

echo "Response:"
echo "$response" | jq . 2>/dev/null || echo "$response"
echo ""

# Check if upload was successful
if echo "$response" | grep -q '"success":true'; then
  echo "✓ Upload successful!"
  
  # Extract image ID
  image_id=$(echo "$response" | jq -r '.image.id' 2>/dev/null)
  if [ -n "$image_id" ] && [ "$image_id" != "null" ]; then
    echo "  Image ID: $image_id"
    echo "  View at: $SERVER_URL/api/gallery/images/$image_id"
  fi
else
  echo "✗ Upload failed"
fi

