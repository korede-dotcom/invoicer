#!/bin/bash

# Test Location API Endpoints
# Tests the new CountriesNow API integration
# Note: These endpoints are public (no authentication required)

BASE_URL="http://localhost:3020/api"

echo "🌍 Testing Location API Endpoints (Public Access)"
echo "=================================================="
echo ""
echo "ℹ️  Note: These endpoints do NOT require authentication"
echo ""

# Test 1: Get all countries
echo "📝 Test 1: GET /projects/locations/countries"
echo "-------------------------------------------"
COUNTRIES=$(curl -s "$BASE_URL/projects/locations/countries")
echo "$COUNTRIES" | jq '.' 2>/dev/null || echo "$COUNTRIES"
echo ""
echo "✅ Countries endpoint tested"
echo ""

# Test 2: Get states for Nigeria
echo "📝 Test 2: GET /projects/locations/states?country=Nigeria"
echo "--------------------------------------------------------"
STATES=$(curl -s "$BASE_URL/projects/locations/states?country=Nigeria")
echo "$STATES" | jq '.' 2>/dev/null || echo "$STATES"
echo ""
echo "✅ States endpoint tested for Nigeria"
echo ""

# Test 3: Get cities for Lagos, Nigeria
echo "📝 Test 3: GET /projects/locations/cities?country=Nigeria&state=Lagos"
echo "--------------------------------------------------------------------"
CITIES=$(curl -s "$BASE_URL/projects/locations/cities?country=Nigeria&state=Lagos")
echo "$CITIES" | jq '.' 2>/dev/null || echo "$CITIES"
echo ""
echo "✅ Cities endpoint tested for Lagos, Nigeria"
echo ""

# Test 4: Get states for United States
echo "📝 Test 4: GET /projects/locations/states?country=United%20States"
echo "----------------------------------------------------------------"
STATES_US=$(curl -s "$BASE_URL/projects/locations/states?country=United%20States")
echo "$STATES_US" | jq '.' 2>/dev/null || echo "$STATES_US"
echo ""
echo "✅ States endpoint tested for United States"
echo ""

# Test 5: Get cities for California, United States
echo "📝 Test 5: GET /projects/locations/cities?country=United%20States&state=California"
echo "---------------------------------------------------------------------------------"
CITIES_CA=$(curl -s "$BASE_URL/projects/locations/cities?country=United%20States&state=California")
echo "$CITIES_CA" | jq '.' 2>/dev/null || echo "$CITIES_CA"
echo ""
echo "✅ Cities endpoint tested for California, United States"
echo ""

# Test 6: Error handling - missing country parameter
echo "📝 Test 6: GET /projects/locations/states (missing country parameter)"
echo "-------------------------------------------------------------------"
ERROR_TEST=$(curl -s "$BASE_URL/projects/locations/states")
echo "$ERROR_TEST" | jq '.' 2>/dev/null || echo "$ERROR_TEST"
echo ""
echo "✅ Error handling tested"
echo ""

# Summary
echo "=================================="
echo "✅ All location API tests completed!"
echo ""
echo "📚 API Endpoints:"
echo "  1. GET /api/projects/locations/countries"
echo "  2. GET /api/projects/locations/states?country={country_name}"
echo "  3. GET /api/projects/locations/cities?country={country_name}&state={state_name}"
echo ""
echo "🔗 External API: https://countriesnow.space"
echo "=================================="

