#!/bin/bash

# Local Domain Setup Script
# This script configures local DNS resolution for testing preview environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="www.urlchecker.dev"
API_DOMAIN="api.urlchecker.dev"
LOCAL_IP="127.0.0.1"
FRONTEND_PORT=3000
API_PORT=8080

echo -e "${BLUE}🔧 Local Domain Setup for E2E Testing${NC}"
echo "=================================="
echo ""

# Check if running with appropriate permissions
if [[ $EUID -ne 0 ]]; then
   echo -e "${YELLOW}⚠️  This script may require sudo privileges for hosts file modification${NC}"
   echo -e "${YELLOW}   You may be prompted for your password${NC}"
   echo ""
fi

# Function to backup hosts file
backup_hosts() {
    echo -e "${BLUE}📋 Backing up hosts file...${NC}"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)
    else
        # Linux
        sudo cp /etc/hosts /etc/hosts.backup.$(date +%Y%m%d_%H%M%S)
    fi
    echo -e "${GREEN}✅ Hosts file backed up${NC}"
}

# Function to add domain to hosts file
add_to_hosts() {
    local domain=$1
    local ip=$2
    local port=$3

    echo -e "${BLUE}🌐 Adding $domain to hosts file...${NC}"

    # Remove existing entry if exists
    if [[ "$OSTYPE" == "darwin"* ]]; then
        sudo sed -i '' "/$domain/d" /etc/hosts
    else
        sudo sed -i "/$domain/d" /etc/hosts
    fi

    # Add new entry
    echo "$ip $domain" | sudo tee -a /etc/hosts > /dev/null
    echo -e "${GREEN}✅ Added $domain -> $ip${NC}"
}

# Function to setup local port forwarding
setup_port_forwarding() {
    echo -e "${BLUE}🔌 Setting up port forwarding...${NC}"

    # Check if socat is installed
    if ! command -v socat &> /dev/null; then
        echo -e "${YELLOW}⚠️  socat not found. Installing...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew install socat
        else
            sudo apt-get update && sudo apt-get install -y socat
        fi
    fi

    # Start port forwarding in background
    echo -e "${BLUE}🚀 Starting port forwarding for ${DOMAIN}:${FRONTEND_PORT}${NC}"
    socat TCP4-LISTEN:80,fork,reuseaddr TCP4:${LOCAL_IP}:${FRONTEND_PORT} &
    PORT_FORWARD_PID=$!
    echo $PORT_FORWARD_PID > /tmp/port_forward.pid

    echo -e "${BLUE}🚀 Starting port forwarding for ${API_DOMAIN}:${API_PORT}${NC}"
    socat TCP4-LISTEN:8080,fork,reuseaddr TCP4:${LOCAL_IP}:${API_PORT} &
    API_PORT_FORWARD_PID=$!
    echo $API_PORT_FORWARD_PID >> /tmp/port_forward.pid

    echo -e "${GREEN}✅ Port forwarding started (PIDs: $PORT_FORWARD_PID, $API_PORT_FORWARD_PID)${NC}"
}

# Function to setup DNS override
setup_dns_override() {
    echo -e "${BLUE}🔍 Setting up DNS override...${NC}"

    # Create dnsmasq configuration for local testing
    cat > /tmp/dnsmasq-local.conf << EOF
# Local DNS configuration for E2E testing
address=/${DOMAIN}/${LOCAL_IP}
address=/${API_DOMAIN}/${LOCAL_IP}
port=53
no-resolv
no-poll
cache-size=0
EOF

    if command -v dnsmasq &> /dev/null; then
        echo -e "${BLUE}🔄 Starting dnsmasq with custom configuration...${NC}"
        dnsmasq -C /tmp/dnsmasq-local.conf --port=53535 &
        DNSMASQ_PID=$!
        echo $DNSMASQ_PID >> /tmp/dns_pids.pid

        # Update resolv.conf to use local DNS
        echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf.local > /dev/null

        echo -e "${GREEN}✅ DNS override configured${NC}"
    else
        echo -e "${YELLOW}⚠️  dnsmasq not found, using hosts file only${NC}"
    fi
}

# Function to create local SSL certificates
setup_ssl_certificates() {
    echo -e "${BLUE}🔐 Setting up local SSL certificates...${NC}"

    # Create certificates directory
    mkdir -p certs

    # Generate self-signed certificate
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        openssl req -x509 -newkey rsa:4096 -keyout certs/local.key -out certs/local.crt -days 365 -nodes \
            -subj "/C=US/ST=CA/L=San Francisco/O=Local Dev/CN=${DOMAIN}" \
            -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"
    else
        # Linux
        openssl req -x509 -newkey rsa:4096 -keyout certs/local.key -out certs/local.crt -days 365 -nodes \
            -subj "/C=US/ST=CA/L=San Francisco/O=Local Dev/CN=${DOMAIN}" \
            -extensions v3_req -config <(
                cat /etc/ssl/openssl.cnf
                echo "[v3_req]"
                echo "subjectAltName = @alt_names"
                echo "[alt_names]"
                echo "DNS.1 = ${DOMAIN}"
                echo "DNS.2 = localhost"
                echo "IP.1 = 127.0.0.1"
            )
    fi

    echo -e "${GREEN}✅ SSL certificates generated in certs/${NC}"

    # Trust the certificate (macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        echo -e "${BLUE}🍎 Adding certificate to macOS keychain...${NC}"
        security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain certs/local.crt
    fi
}

# Function to test local domain resolution
test_domain_resolution() {
    echo -e "${BLUE}🧪 Testing domain resolution...${NC}"

    # Test frontend domain
    if nslookup ${DOMAIN} >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ${DOMAIN} resolves successfully${NC}"
    else
        echo -e "${RED}❌ ${DOMAIN} resolution failed${NC}"
    fi

    # Test API domain
    if nslookup ${API_DOMAIN} >/dev/null 2>&1; then
        echo -e "${GREEN}✅ ${API_DOMAIN} resolves successfully${NC}"
    else
        echo -e "${RED}❌ ${API_DOMAIN} resolution failed${NC}"
    fi

    # Test HTTP connectivity
    echo -e "${BLUE}🌐 Testing HTTP connectivity...${NC}"
    if curl -s --max-time 5 http://${DOMAIN} >/dev/null 2>&1; then
        echo -e "${GREEN}✅ HTTP connectivity to ${DOMAIN} successful${NC}"
    else
        echo -e "${YELLOW}⚠️  HTTP connectivity to ${DOMAIN} failed (services may not be running)${NC}"
    fi
}

# Function to start local services
start_local_services() {
    echo -e "${BLUE}🚀 Starting local development services...${NC}"

    # Start frontend if not running
    if ! curl -s http://localhost:${FRONTEND_PORT} >/dev/null 2>&1; then
        echo -e "${BLUE}📱 Starting frontend service...${NC}"
        cd apps/frontend && npm run dev &
        FRONTEND_PID=$!
        echo $FRONTEND_PID > /tmp/frontend.pid
        echo -e "${GREEN}✅ Frontend started (PID: $FRONTEND_PID)${NC}"
    else
        echo -e "${GREEN}✅ Frontend already running${NC}"
    fi

    # Start backend if not running
    if ! curl -s http://localhost:${API_PORT} >/dev/null 2>&1; then
        echo -e "${BLUE}🔧 Starting backend services...${NC}"
        cd services && go run ./... &
        BACKEND_PID=$!
        echo $BACKEND_PID > /tmp/backend.pid
        echo -e "${GREEN}✅ Backend started (PID: $BACKEND_PID)${NC}"
    else
        echo -e "${GREEN}✅ Backend already running${NC}"
    fi
}

# Function to create cleanup script
create_cleanup_script() {
    cat > /tmp/cleanup-local-domain.sh << 'EOF'
#!/bin/bash

echo "🧹 Cleaning up local domain configuration..."

# Stop port forwarding
if [ -f /tmp/port_forward.pid ]; then
    while read -r pid; do
        kill $pid 2>/dev/null || true
    done < /tmp/port_forward.pid
    rm -f /tmp/port_forward.pid
fi

# Stop DNS services
if [ -f /tmp/dns_pids.pid ]; then
    while read -r pid; do
        kill $pid 2>/dev/null || true
    done < /tmp/dns_pids.pid
    rm -f /tmp/dns_pids.pid
fi

# Stop local services
if [ -f /tmp/frontend.pid ]; then
    kill $(cat /tmp/frontend.pid) 2>/dev/null || true
    rm -f /tmp/frontend.pid
fi

if [ -f /tmp/backend.pid ]; then
    kill $(cat /tmp/backend.pid) 2>/dev/null || true
    rm -f /tmp/backend.pid
fi

# Restore original hosts file
LATEST_BACKUP=$(ls -t /etc/hosts.backup.* 2>/dev/null | head -1)
if [ -n "$LATEST_BACKUP" ]; then
    echo "Restoring hosts file from $LATEST_BACKUP"
    sudo cp "$LATEST_BACKUP" /etc/hosts
fi

echo "✅ Cleanup completed"
EOF

    chmod +x /tmp/cleanup-local-domain.sh
    echo -e "${GREEN}✅ Cleanup script created: /tmp/cleanup-local-domain.sh${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 This script will configure your local machine to resolve preview domains for testing${NC}"
    echo -e "${YELLOW}⚠️  This will modify your system's hosts file and network configuration${NC}"
    echo ""
    read -p "Do you want to continue? (y/N): " -n 1 -r
    echo

    if [[ $REPLY =~ ^[Yy]$ ]]; then
        backup_hosts
        add_to_hosts $DOMAIN $LOCAL_IP
        add_to_hosts $API_DOMAIN $LOCAL_IP
        setup_port_forwarding
        setup_ssl_certificates
        start_local_services
        test_domain_resolution
        create_cleanup_script

        echo ""
        echo -e "${GREEN}🎉 Local domain setup completed successfully!${NC}"
        echo ""
        echo -e "${BLUE}📋 Next steps:${NC}"
        echo "1. Start your development services if not already running"
        echo "2. Run E2E tests with: node scripts/tests/run-e2e-test-suite.mjs"
        echo "3. To clean up, run: /tmp/cleanup-local-domain.sh"
        echo ""
        echo -e "${BLUE}🌐 Test URLs:${NC}"
        echo "Frontend: http://${DOMAIN}"
        echo "API: http://${API_DOMAIN}"

    else
        echo -e "${YELLOW}❌ Setup cancelled${NC}"
        exit 1
    fi
}

# Run main function
main "$@"