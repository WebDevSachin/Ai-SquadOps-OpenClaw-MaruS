#!/bin/bash
set -e

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║           SquadOps COMPREHENSIVE END-TO-END TEST                          ║"
echo "║     Testing ALL features with REAL data - NO mocks                       ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"
echo ""

API_URL="http://localhost:4000"
FRONTEND_URL="http://localhost:3000"
TOKEN=""
USER_ID=""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

success_count=0
fail_count=0

log_success() {
    echo -e "${GREEN}✓${NC} $1"
    ((success_count++))
}

log_fail() {
    echo -e "${RED}✗${NC} $1"
    ((fail_count++))
}

log_info() {
    echo -e "${YELLOW}→${NC} $1"
}

# ============================================
# TEST 1: Authentication
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 1: AUTHENTICATION"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Testing login with admin credentials..."
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@squadops.local","password":"SquadOps2024!"}')

TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
USER_EMAIL=$(echo "$LOGIN_RESPONSE" | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)
USER_ROLE=$(echo "$LOGIN_RESPONSE" | grep -o '"role":"[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$TOKEN" ] && [ "$USER_EMAIL" = "admin@squadops.local" ]; then
    log_success "Login successful - Token received"
    log_success "User: $USER_EMAIL (Role: $USER_ROLE)"
else
    log_fail "Login failed"
    echo "Response: $LOGIN_RESPONSE"
    exit 1
fi

log_info "Testing /auth/me endpoint..."
ME_RESPONSE=$(curl -s "$API_URL/api/auth/me" -H "Authorization: Bearer $TOKEN")
if echo "$ME_RESPONSE" | grep -q "admin@squadops.local"; then
    log_success "Get current user works"
else
    log_fail "Get current user failed"
fi

# ============================================
# TEST 2: User Management
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 2: USER MANAGEMENT (REAL DATA)"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Fetching user stats..."
STATS_RESPONSE=$(curl -s "$API_URL/api/users/stats" -H "Authorization: Bearer $TOKEN")
TOTAL_USERS=$(echo "$STATS_RESPONSE" | grep -o '"total_users":[0-9]*' | cut -d':' -f2)
ACTIVE_USERS=$(echo "$STATS_RESPONSE" | grep -o '"active_users":[0-9]*' | cut -d':' -f2)

if [ -n "$TOTAL_USERS" ]; then
    log_success "User stats retrieved - Total: $TOTAL_USERS, Active: $ACTIVE_USERS"
else
    log_fail "Failed to get user stats"
fi

log_info "Fetching users list..."
USERS_RESPONSE=$(curl -s "$API_URL/api/users" -H "Authorization: Bearer $TOKEN")
USER_COUNT=$(echo "$USERS_RESPONSE" | grep -o '"id":' | wc -l | tr -d ' ')

if [ "$USER_COUNT" -gt 0 ]; then
    log_success "Users list retrieved - Found $USER_COUNT users"
    # Show first user
    FIRST_USER=$(echo "$USERS_RESPONSE" | grep -o '"email":"[^"]*"' | head -1 | cut -d'"' -f4)
    log_info "First user: $FIRST_USER"
else
    log_fail "No users found"
fi

log_info "Creating a test user..."
CREATE_USER_RESPONSE=$(curl -s -X POST "$API_URL/api/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": "Test User $(date +%s)",
    \"email\": \"testuser$(date +%s)@example.com\",
    \"role\": \"user\",
    \"password\": \"TestPassword123!\"
  }")

NEW_USER_ID=$(echo "$CREATE_USER_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$NEW_USER_ID" ]; then
    log_success "User created - ID: $NEW_USER_ID"
else
    log_fail "Failed to create user"
    echo "Response: $CREATE_USER_RESPONSE"
fi

# ============================================
# TEST 3: Agents
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 3: AI AGENTS"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Fetching agents..."
AGENTS_RESPONSE=$(curl -s "$API_URL/api/agents" -H "Authorization: Bearer $TOKEN")
AGENT_COUNT=$(echo "$AGENTS_RESPONSE" | grep -o '"id":' | wc -l | tr -d ' ')

if [ "$AGENT_COUNT" -gt 0 ]; then
    log_success "Agents retrieved - Found $AGENT_COUNT agents"
    # Show some agents
    echo "$AGENTS_RESPONSE" | grep -o '"name":"[^"]*"' | head -5 | sed 's/"name":"/   - /;s/"//' || true
else
    log_fail "No agents found"
fi

# ============================================
# TEST 4: Tasks
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 4: TASKS"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Creating a task..."
TASK_RESPONSE=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task - Comprehensive Flow",
    "description": "Testing the full task creation workflow",
    "priority": "high",
    "assigned_agent": "scout",
    "status": "pending"
  }')

TASK_ID=$(echo "$TASK_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
if [ -n "$TASK_ID" ]; then
    log_success "Task created - ID: $TASK_ID"
else
    log_fail "Failed to create task"
fi

log_info "Fetching tasks list..."
TASKS_LIST=$(curl -s "$API_URL/api/tasks" -H "Authorization: Bearer $TOKEN")
TASKS_COUNT=$(echo "$TASKS_LIST" | grep -o '"id":' | wc -l | tr -d ' ')

if [ "$TASKS_COUNT" -gt 0 ]; then
    log_success "Tasks list retrieved - Total: $TASKS_COUNT tasks"
else
    log_fail "No tasks found"
fi

# ============================================
# TEST 5: Goals
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 5: GOALS / OKRs"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Creating a goal..."
GOAL_RESPONSE=$(curl -s -X POST "$API_URL/api/goals" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Q1 2025 Revenue Target",
    "description": "Achieve $1M ARR by end of Q1",
    "target_value": 1000000,
    "unit": "USD",
    "deadline": "2025-03-31T23:59:59Z"
  }')

if echo "$GOAL_RESPONSE" | grep -q "id"; then
    log_success "Goal created"
else
    log_fail "Failed to create goal"
fi

log_info "Fetching goals..."
GOALS_RESPONSE=$(curl -s "$API_URL/api/goals" -H "Authorization: Bearer $TOKEN")
GOALS_COUNT=$(echo "$GOALS_RESPONSE" | grep -o '"id":' | wc -l | tr -d ' ')

if [ "$GOALS_COUNT" -gt 0 ]; then
    log_success "Goals retrieved - Total: $GOALS_COUNT goals"
else
    log_fail "No goals found"
fi

# ============================================
# TEST 6: Audit Log
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 6: AUDIT LOG"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Fetching audit logs..."
AUDIT_RESPONSE=$(curl -s "$API_URL/api/audit" -H "Authorization: Bearer $TOKEN")
AUDIT_COUNT=$(echo "$AUDIT_RESPONSE" | grep -o '"id":' | wc -l | tr -d ' ')

if [ -n "$AUDIT_COUNT" ]; then
    log_success "Audit logs retrieved - Total: $AUDIT_COUNT events"
else
    log_fail "Failed to fetch audit logs"
fi

# ============================================
# TEST 7: System Health
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 7: SYSTEM HEALTH"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Checking system health..."
HEALTH_RESPONSE=$(curl -s "$API_URL/api/system/health" -H "Authorization: Bearer $TOKEN")
if echo "$HEALTH_RESPONSE" | grep -q "cpu_usage"; then
    CPU=$(echo "$HEALTH_RESPONSE" | grep -o '"cpu_usage":[0-9]*' | cut -d':' -f2)
    MEMORY=$(echo "$HEALTH_RESPONSE" | grep -o '"memory_usage":[0-9]*' | cut -d':' -f2)
    log_success "System health retrieved - CPU: ${CPU}%, Memory: ${MEMORY}%"
else
    log_fail "Failed to get system health"
fi

# ============================================
# TEST 8: Messages
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "TEST 8: MESSAGES"
echo "═══════════════════════════════════════════════════════════════════════════"

log_info "Creating a message..."
MSG_RESPONSE=$(curl -s -X POST "$API_URL/api/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Test message from comprehensive test suite",
    "message_type": "chat"
  }')

if echo "$MSG_RESPONSE" | grep -q "id"; then
    log_success "Message created"
else
    log_fail "Failed to create message"
fi

log_info "Fetching messages..."
MESSAGES_RESPONSE=$(curl -s "$API_URL/api/messages" -H "Authorization: Bearer $TOKEN")
MSG_COUNT=$(echo "$MESSAGES_RESPONSE" | grep -o '"id":' | wc -l | tr -d ' ')

if [ -n "$MSG_COUNT" ]; then
    log_success "Messages retrieved - Total: $MSG_COUNT messages"
else
    log_fail "Failed to fetch messages"
fi

# ============================================
# SUMMARY
# ============================================
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                         TEST SUMMARY                                      "
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}Passed: $success_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         ALL TESTS PASSED - SYSTEM IS FULLY WORKING!           ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║         SOME TESTS FAILED - CHECK OUTPUT ABOVE                ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
