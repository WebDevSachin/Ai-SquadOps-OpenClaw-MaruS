#!/bin/sh
# OpenClaw Initialization Script
# Runs after OpenClaw starts to configure auto-approval

OPENCLAW_URL="http://openclaw-gateway:18789"
TOKEN="openclaw_dev_token_12345"

echo "Initializing OpenClaw configuration..."

# Wait for OpenClaw to be ready
echo "Waiting for OpenClaw Gateway..."
for i in $(seq 1 30); do
    if curl -s "$OPENCLAW_URL/health" > /dev/null 2>&1; then
        echo "OpenClaw is ready!"
        break
    fi
    echo "  Attempt $i/30..."
    sleep 2
done

# Try to configure auto-approval via API
echo "Configuring auto-approval..."

# Set the gateway token
curl -s -X POST "$OPENCLAW_URL/api/config" \
    -H "Content-Type: application/json" \
    -d "{\"gatewayToken\": \"${TOKEN}\", \"autoApproveDevices\": true}" 2>/dev/null || true

# Approve any existing pending devices
echo "Checking for pending devices..."
PENDING_DEVICES=$(curl -s "$OPENCLAW_URL/api/admin/devices" \
    -H "Authorization: Bearer ${TOKEN}" 2>/dev/null | \
    grep -o '"id":"[^"]*","status":"pending"' | \
    cut -d'"' -f4)

for device_id in $PENDING_DEVICES; do
    if [ -n "$device_id" ]; then
        echo "Approving device: $device_id"
        curl -s -X POST "$OPENCLAW_URL/api/admin/devices/${device_id}/approve" \
            -H "Authorization: Bearer ${TOKEN}" > /dev/null 2>&1 || true
    fi
done

echo "OpenClaw initialization complete!"
echo ""
echo "Access URLs:"
echo "  Gateway:  http://localhost:18789"
echo "  Chat:     http://localhost:18789/chat?session=main&token=${TOKEN}"
