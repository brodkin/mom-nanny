#!/bin/bash

# cURL Test Commands for Development Auto-Login Feature
# 
# This script provides manual testing commands using cURL to validate
# the development auto-login functionality across different environments.

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Test configuration
TEST_PORT=3003
BASE_URL="http://localhost:$TEST_PORT"
COOKIE_JAR="test-cookies.txt"

# Cleanup function
cleanup() {
    echo -e "${CYAN}Cleaning up...${NC}"
    if [ -f "$COOKIE_JAR" ]; then
        rm "$COOKIE_JAR"
        echo -e "${CYAN}Removed cookie jar${NC}"
    fi
    
    # Kill any running test servers
    pkill -f "node.*app.js.*PORT.*$TEST_PORT" 2>/dev/null || true
    sleep 2
}

# Trap cleanup on script exit
trap cleanup EXIT

log_test() {
    echo -e "\n${YELLOW}=== $1 ===${NC}"
}

log_step() {
    echo -e "${CYAN}$1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Start server in background
start_server() {
    local env_mode=$1
    
    log_step "Starting server in $env_mode mode..."
    
    # Kill any existing server on this port
    pkill -f "node.*app.js.*PORT.*$TEST_PORT" 2>/dev/null || true
    sleep 2
    
    # Start new server
    NODE_ENV=$env_mode PORT=$TEST_PORT SQLITE_DB_PATH=':memory:' node app.js > /tmp/test-server-$env_mode.log 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to start
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/admin/health" 2>/dev/null | grep -q "200"; then
            log_success "Server started successfully in $env_mode mode (PID: $SERVER_PID)"
            sleep 1 # Give it a moment to fully initialize
            return 0
        fi
        
        sleep 1
        attempt=$((attempt + 1))
    done
    
    log_error "Server failed to start in $env_mode mode"
    cat /tmp/test-server-$env_mode.log
    return 1
}

stop_server() {
    if [ ! -z "$SERVER_PID" ]; then
        log_step "Stopping server (PID: $SERVER_PID)..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
        unset SERVER_PID
    fi
}

# Test development mode
test_development_mode() {
    log_test "Development Mode cURL Tests"
    
    if ! start_server "development"; then
        return 1
    fi
    
    # Test 1: Admin dashboard access
    log_step "Testing admin dashboard access..."
    response=$(curl -s -c "$COOKIE_JAR" -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" "$BASE_URL/admin/dashboard")
    http_code=$(echo "$response" | sed -E 's/.*HTTPSTATUS:([0-9]{3}).*/\1/')
    redirect_url=$(echo "$response" | sed -E 's/.*REDIRECT:([^;]*).*/\1/')
    
    if [ "$http_code" = "200" ]; then
        log_success "Development mode: Dashboard loaded directly (auto-login successful)"
    elif [ "$http_code" = "302" ]; then
        if echo "$redirect_url" | grep -q "setup"; then
            log_success "Development mode: Redirected to setup (no users exist yet)"
        elif echo "$redirect_url" | grep -q "login"; then
            log_error "Development mode: Unexpected redirect to login"
        else
            log_warning "Development mode: Unknown redirect to $redirect_url"
        fi
    else
        log_error "Development mode: Unexpected HTTP status $http_code"
    fi
    
    # Test 2: Check for session cookies
    log_step "Checking for session cookies..."
    if [ -f "$COOKIE_JAR" ] && grep -q "connect.sid\|sessionid" "$COOKIE_JAR" 2>/dev/null; then
        log_success "Session cookies were set"
        echo -e "${CYAN}Cookie content:${NC}"
        cat "$COOKIE_JAR" | grep -v "^#" | head -3
    else
        log_warning "No session cookies found (expected if redirected to setup)"
    fi
    
    # Test 3: API endpoint access
    log_step "Testing API endpoint with session..."
    api_response=$(curl -s -b "$COOKIE_JAR" -w "HTTPSTATUS:%{http_code}" "$BASE_URL/api/admin/stats")
    api_code=$(echo "$api_response" | sed -E 's/.*HTTPSTATUS:([0-9]{3}).*/\1/')
    
    if [ "$api_code" = "200" ]; then
        log_success "API endpoint accessible with session"
    elif [ "$api_code" = "401" ]; then
        log_warning "API endpoint requires authentication (expected without users)"
    else
        log_warning "API endpoint returned status: $api_code"
    fi
    
    stop_server
    rm -f "$COOKIE_JAR"
}

# Test production mode
test_production_mode() {
    log_test "Production Mode cURL Tests"
    
    if ! start_server "production"; then
        return 1
    fi
    
    # Test 1: Admin dashboard access should be blocked
    log_step "Testing admin dashboard access in production..."
    response=$(curl -s -c "$COOKIE_JAR" -w "HTTPSTATUS:%{http_code};REDIRECT:%{redirect_url}" "$BASE_URL/admin/dashboard")
    http_code=$(echo "$response" | sed -E 's/.*HTTPSTATUS:([0-9]{3}).*/\1/')
    redirect_url=$(echo "$response" | sed -E 's/.*REDIRECT:([^;]*).*/\1/')
    
    if [ "$http_code" = "200" ]; then
        log_error "SECURITY ISSUE: Dashboard accessible without auth in production!"
        return 1
    elif [ "$http_code" = "302" ]; then
        if echo "$redirect_url" | grep -q "login"; then
            log_success "Production mode: Correctly redirected to login"
        elif echo "$redirect_url" | grep -q "setup"; then
            log_success "Production mode: Correctly redirected to setup (no users)"
        else
            log_warning "Production mode: Redirected to $redirect_url"
        fi
    else
        log_error "Production mode: Unexpected HTTP status $http_code"
    fi
    
    # Test 2: Verify no auto-login session cookies
    log_step "Verifying no auto-login cookies in production..."
    if [ -f "$COOKIE_JAR" ] && grep -q "connect.sid.*admin\|sessionid.*admin" "$COOKIE_JAR" 2>/dev/null; then
        log_error "SECURITY ISSUE: Auto-login cookies set in production!"
        cat "$COOKIE_JAR"
        return 1
    else
        log_success "No auto-login session cookies in production")
    fi
    
    # Test 3: API endpoint should be blocked
    log_step "Testing API endpoint access in production..."
    api_response=$(curl -s -b "$COOKIE_JAR" -w "HTTPSTATUS:%{http_code}" "$BASE_URL/api/admin/stats")
    api_code=$(echo "$api_response" | sed -E 's/.*HTTPSTATUS:([0-9]{3}).*/\1/')
    
    if [ "$api_code" = "401" ]; then
        log_success "API endpoint correctly blocked in production"
    elif [ "$api_code" = "200" ]; then
        log_error "SECURITY ISSUE: API endpoint accessible without auth in production!"
        return 1
    else
        log_warning "API endpoint returned status: $api_code"
    fi
    
    stop_server
    rm -f "$COOKIE_JAR"
}

# Test various NODE_ENV values
test_env_variations() {
    log_test "NODE_ENV Variation Tests"
    
    local test_envs=("" "development" "dev" "test" "staging")
    
    for env in "${test_envs[@]}"; do
        if [ -z "$env" ]; then
            log_step "Testing undefined NODE_ENV..."
            env_display="undefined"
        else
            log_step "Testing NODE_ENV=$env..."
            env_display="$env"
        fi
        
        # Start server with specific env
        if [ -z "$env" ]; then
            unset NODE_ENV
            PORT=$TEST_PORT SQLITE_DB_PATH=':memory:' node app.js > /tmp/test-server-$env_display.log 2>&1 &
        else
            NODE_ENV=$env PORT=$TEST_PORT SQLITE_DB_PATH=':memory:' node app.js > /tmp/test-server-$env_display.log 2>&1 &
        fi
        
        SERVER_PID=$!
        sleep 3 # Give server time to start
        
        # Quick test
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL/admin/dashboard")
        http_code=$(echo "$response" | sed -E 's/.*HTTPSTATUS:([0-9]{3}).*/\1/')
        
        if [ "$env" = "production" ]; then
            if [ "$http_code" = "302" ]; then
                log_success "NODE_ENV=$env_display: Correctly blocked (redirected)"
            else
                log_error "NODE_ENV=$env_display: Should block but got $http_code"
            fi
        else
            if [ "$http_code" = "200" ] || [ "$http_code" = "302" ]; then
                log_success "NODE_ENV=$env_display: Allows access (development behavior)"
            else
                log_warning "NODE_ENV=$env_display: Got status $http_code"
            fi
        fi
        
        stop_server
    done
}

# Test manual session simulation
test_manual_session() {
    log_test "Manual Session Test"
    
    if ! start_server "development"; then
        return 1
    fi
    
    log_step "Manual cURL commands you can run:"
    echo -e "${BLUE}"
    echo "# Test admin dashboard access:"
    echo "curl -v -c cookies.txt '$BASE_URL/admin/dashboard'"
    echo ""
    echo "# Check what cookies were set:"
    echo "cat cookies.txt"
    echo ""
    echo "# Use cookies in subsequent request:"
    echo "curl -v -b cookies.txt '$BASE_URL/api/admin/stats'"
    echo ""
    echo "# Test different endpoints:"
    echo "curl -v -b cookies.txt '$BASE_URL/admin/conversations'"
    echo "curl -v -b cookies.txt '$BASE_URL/admin/memories'"
    echo ""
    echo "# Test production mode (should block):"
    echo "NODE_ENV=production PORT=$TEST_PORT node app.js &"
    echo "curl -v '$BASE_URL/admin/dashboard'"
    echo -e "${NC}"
    
    log_step "Press Enter to continue with automated tests, or Ctrl+C to exit for manual testing..."
    read -r
    
    stop_server
}

# Main execution
main() {
    echo -e "${CYAN}🔧 Development Auto-Login cURL Test Suite${NC}\n"
    
    # Check if curl is available
    if ! command -v curl &> /dev/null; then
        log_error "cURL is not installed. Please install curl to run these tests."
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -f "app.js" ]; then
        log_error "app.js not found. Please run this script from the project root directory."
        exit 1
    fi
    
    # Run tests
    local failed_tests=0
    
    echo -e "${YELLOW}Choose test mode:${NC}"
    echo -e "1) Run all automated tests"
    echo -e "2) Show manual cURL commands"
    echo -e "3) Test development mode only"
    echo -e "4) Test production mode only"
    echo -e "5) Test NODE_ENV variations"
    echo -n "Enter choice (1-5): "
    read -r choice
    
    case $choice in
        1)
            test_development_mode || failed_tests=$((failed_tests + 1))
            test_production_mode || failed_tests=$((failed_tests + 1))
            test_env_variations || failed_tests=$((failed_tests + 1))
            ;;
        2)
            test_manual_session
            ;;
        3)
            test_development_mode || failed_tests=$((failed_tests + 1))
            ;;
        4)
            test_production_mode || failed_tests=$((failed_tests + 1))
            ;;
        5)
            test_env_variations || failed_tests=$((failed_tests + 1))
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
    
    if [ $choice -ne 2 ]; then
        # Summary
        echo -e "\n${YELLOW}=== Test Summary ===${NC}"
        if [ $failed_tests -eq 0 ]; then
            log_success "All cURL tests passed! 🎉"
            exit 0
        else
            log_error "$failed_tests test(s) failed"
            exit 1
        fi
    fi
}

# Run main function if script is executed directly
if [ "${BASH_SOURCE[0]}" == "${0}" ]; then
    main "$@"
fi