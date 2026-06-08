#!/bin/bash
# KDS Load Test with k6
# Install: brew install k6  (macOS) or https://k6.io/docs/getting-started/installation/

set -e

KDS_URL="${1:-https://kds.rabbitty.me}"
DURATION="${2:-30s}"
VUS="${3:-50}"

echo "=== Rabbitty KDS Load Test ==="
echo "Target: $KDS_URL"
echo "Duration: $DURATION"
echo "Virtual Users: $VUS"
echo ""

k6 run --vus "$VUS" --duration "$DURATION" -e KDS_URL="$KDS_URL" - <<'EOF'
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  const res = http.get(`${__ENV.KDS_URL}/api/trpc/kds.getOrders`, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
EOF
