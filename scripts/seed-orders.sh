#!/bin/bash

# Order Seeding Script for diana_lee-demo Bakery
# Creates realistic orders from Sept 25 to Dec 15, 2025
# Excludes all Sundays
# Distribution: 3% (0 orders), 30% (1), 40% (2), 20% (3), 7% (4)

API_URL="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY_ID="diana_lee-demo"
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtX2FkbWluIiwiYmFrZXJ5SWQiOiJlcy1hbGltZW50byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9iYWtlLXJ5IiwiYXVkIjoiYmFrZS1yeSIsImF1dGhfdGltZSI6MTc2NDk4NTQ1NiwidXNlcl9pZCI6InN5c3RlbS1hZG1pbiIsInN1YiI6InN5c3RlbS1hZG1pbiIsImlhdCI6MTc2NTgzMTMzMSwiZXhwIjoxNzY1ODM0OTMxLCJlbWFpbCI6ImRldkBjYXJzYWxoYXouY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiZGV2QGNhcnNhbGhhei5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lEXzJ8RUJVJHtMLJHvoLgBGLSQd6Hspeg5FhG9jij7UL_dFb9WUIw6nxCzV9YCyQyuoDceIQoEIcP5aCZuVLH_uA9Soa2b4uJC5HkSF_B6th3XC7H2Ppx0nJmH2WkSy4HmBp8shia6PD1pWuR-wst0eUOfWB1wcfxCR6dVs1nqe7QS5JJmA-58Me6Yo_WrDCoj2EpI2hzLEBUDUK6xDRE_njrl_W6lqo0a2otC0cdtv4K4-oLPcZCTJzA4qBxfxRZ_ljhdyqdwb73VsRt-OieUHtgTLtBMNmwjZavWt-I4eI_H08-NPawLXE_julrn8KcXoKDerSHmXd08FfIZLbvw"

START_DATE="2025-09-25"
END_DATE="2025-12-15"

USERS_FILE="./seed-data/users.json"
PRODUCTS_FILE="./seed-data/products.json"
LOG_FILE="./seed-data/seeding.log"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Counters
TOTAL_ORDERS=0
SUCCESSFUL_ORDERS=0
FAILED_ORDERS=0
SKIPPED_SUNDAYS=0

# Parse JSON field (simple sed-based approach)
parse_json_field() {
  local json=$1
  local field=$2
  echo "$json" | grep -o "\"$field\":\"[^\"]*\"" | cut -d'"' -f4 | head -1
}

parse_json_number() {
  local json=$1
  local field=$2
  echo "$json" | grep -o "\"$field\":[0-9]*" | cut -d':' -f2 | head -1
}

# Check if Sunday
is_sunday() {
  local date=$1
  local dow=$(date -d "$date" +%w 2>/dev/null || echo "invalid")
  [ "$dow" = "0" ] && return 0 || return 1
}

# Format date to ISO
to_iso_date() {
  local date=$1
  date -d "$date" +"%Y-%m-%dT12:00:00.000Z" 2>/dev/null || echo ""
}

# Random percentage (1-100)
rand_percent() {
  echo $((($RANDOM % 100) + 1))
}

# Get order count based on distribution
get_order_count() {
  local rand=$(rand_percent)
  if [ $rand -le 3 ]; then
    echo 0
  elif [ $rand -le 33 ]; then
    echo 1
  elif [ $rand -le 73 ]; then
    echo 2
  elif [ $rand -le 93 ]; then
    echo 3
  else
    echo 4
  fi
}

# Random payment method
get_payment_method() {
  local rand=$((($RANDOM % 4)))
  case $rand in
    0) echo "bancolombia" ;;
    1) echo "davivienda" ;;
    2) echo "cash" ;;
    *) echo "transfer" ;;
  esac
}

# Random fulfillment type
get_fulfillment_type() {
  local rand=$((($RANDOM % 100) + 1))
  [ $rand -le 40 ] && echo "delivery" || echo "pickup"
}

# Is paid (70% yes)
is_paid() {
  local rand=$((($RANDOM % 100) + 1))
  [ $rand -le 70 ] && echo "true" || echo "false"
}

# Random quantity (1-3)
get_quantity() {
  echo $((($RANDOM % 3) + 1))
}

# Extract user from JSON line
extract_user_id() {
  local line=$1
  parse_json_field "$line" "id"
}

extract_user_name() {
  local line=$1
  parse_json_field "$line" "name"
}

extract_user_email() {
  local line=$1
  parse_json_field "$line" "email"
}

extract_user_phone() {
  local line=$1
  parse_json_field "$line" "phone"
}

extract_user_category() {
  local line=$1
  parse_json_field "$line" "category"
}

# Extract product info
extract_product_id() {
  local line=$1
  parse_json_field "$line" "id"
}

extract_product_name() {
  local line=$1
  parse_json_field "$line" "name"
}

extract_product_collection_id() {
  local line=$1
  parse_json_field "$line" "collectionId"
}

extract_product_collection_name() {
  local line=$1
  parse_json_field "$line" "collectionName"
}

extract_product_price() {
  local line=$1
  parse_json_number "$line" "currentPrice"
}

extract_product_cost_price() {
  local line=$1
  parse_json_number "$line" "costPrice"
}

extract_product_tax() {
  local line=$1
  parse_json_number "$line" "taxPercentage"
}

# Select random user
get_random_user() {
  local user_count=$(grep -o '"id":' "$USERS_FILE" | wc -l)
  local random_idx=$((($RANDOM % $user_count) + 1))

  # Extract JSON objects from items array
  grep -o '{[^{}]*"id":"[^"]*"[^{}]*}' "$USERS_FILE" | sed -n "${random_idx}p"
}

# Select random product
get_random_product() {
  # Count products
  local product_count=$(grep -o '"id":' "$PRODUCTS_FILE" | wc -l)
  local random_idx=$((($RANDOM % $product_count) + 1))

  # Extract product object
  grep -o '{[^{}]*"id":"[^"]*"[^{}]*}' "$PRODUCTS_FILE" | sed -n "${random_idx}p"
}

# Main function to create and post order
create_order() {
  local date=$1
  local user=$2
  local product=$3

  # Extract user data
  local user_id=$(extract_user_id "$user")
  local user_name=$(extract_user_name "$user")
  local user_email=$(extract_user_email "$user")
  local user_phone=$(extract_user_phone "$user")
  local user_category=$(extract_user_category "$user")

  # Extract product data
  local prod_id=$(extract_product_id "$product")
  local prod_name=$(extract_product_name "$product")
  local col_id=$(extract_product_collection_id "$product")
  local col_name=$(extract_product_collection_name "$product")
  local prod_price=$(extract_product_price "$product")
  local prod_cost=$(extract_product_cost_price "$product")
  local prod_tax=$(extract_product_tax "$product")

  [ -z "$prod_price" ] && prod_price=0
  [ -z "$prod_cost" ] && prod_cost=0
  [ -z "$prod_tax" ] && prod_tax=0

  # Order details
  local quantity=$(get_quantity)
  local item_subtotal=$((prod_price * quantity))
  local item_tax=$((item_subtotal * prod_tax / 100))
  local item_total=$((item_subtotal + item_tax))

  local payment_method=$(get_payment_method)
  local paid=$(is_paid)
  local fulfillment=$(get_fulfillment_type)
  local delivery_fee=0
  [ "$fulfillment" = "delivery" ] && delivery_fee=7000

  local total=$((item_total + delivery_fee))
  local iso_date=$(to_iso_date "$date")

  local payment_date="null"
  [ "$paid" = "true" ] && payment_date="\"$iso_date\""

  # Build order JSON
  local item_id="$(date +%s%N | cut -b1-13)$((RANDOM % 10000))"

  local order_json=$(cat <<'EOF'
{
  "userId": "USER_ID",
  "userName": "USER_NAME",
  "userEmail": "USER_EMAIL",
  "userPhone": "USER_PHONE",
  "userNationalId": "",
  "userLegalName": "",
  "userCategory": "USER_CATEGORY",
  "orderItems": [
    {
      "id": "ITEM_ID",
      "productId": "PROD_ID",
      "productName": "PROD_NAME",
      "productDescription": "",
      "collectionId": "COL_ID",
      "collectionName": "COL_NAME",
      "quantity": QUANTITY,
      "basePrice": PRICE,
      "currentPrice": PRICE,
      "costPrice": COST_PRICE,
      "taxPercentage": TAX_PCT,
      "isComplimentary": false,
      "productionBatch": 1,
      "status": 0,
      "combination": null,
      "variation": null,
      "taxAmount": TAX_AMOUNT,
      "preTaxPrice": SUBTOTAL,
      "subtotal": ITEM_TOTAL
    }
  ],
  "preparationDate": "ISO_DATE",
  "dueDate": "ISO_DATE",
  "paymentDate": PAYMENT_DATE,
  "partialPaymentDate": "",
  "partialPaymentAmount": null,
  "dueTime": "",
  "status": 0,
  "isPaid": IS_PAID,
  "isDeliveryPaid": false,
  "paymentMethod": "PAYMENT_METHOD",
  "fulfillmentType": "FULFILLMENT",
  "deliveryAddress": "",
  "deliveryInstructions": "",
  "deliveryDriverId": "-",
  "driverMarkedAsPaid": false,
  "deliverySequence": 1,
  "deliveryFee": DELIVERY_FEE,
  "deliveryCost": 0,
  "numberOfBags": 1,
  "isComplimentary": false,
  "isQuote": false,
  "invoiceCustomizations": {
    "termsAndConditions": "",
    "notes": "",
    "customTitle": ""
  },
  "customerNotes": "",
  "deliveryNotes": "",
  "internalNotes": "",
  "shouldUpdateClientAddress": false
}
EOF
)

  # Replace placeholders
  order_json="${order_json//USER_ID/$user_id}"
  order_json="${order_json//USER_NAME/$user_name}"
  order_json="${order_json//USER_EMAIL/$user_email}"
  order_json="${order_json//USER_PHONE/$user_phone}"
  order_json="${order_json//USER_CATEGORY/$user_category}"
  order_json="${order_json//ITEM_ID/$item_id}"
  order_json="${order_json//PROD_ID/$prod_id}"
  order_json="${order_json//PROD_NAME/$prod_name}"
  order_json="${order_json//COL_ID/$col_id}"
  order_json="${order_json//COL_NAME/$col_name}"
  order_json="${order_json//QUANTITY/$quantity}"
  order_json="${order_json//PRICE/$prod_price}"
  order_json="${order_json//COST_PRICE/$prod_cost}"
  order_json="${order_json//TAX_PCT/$prod_tax}"
  order_json="${order_json//TAX_AMOUNT/$item_tax}"
  order_json="${order_json//SUBTOTAL/$item_subtotal}"
  order_json="${order_json//ITEM_TOTAL/$item_total}"
  order_json="${order_json//ISO_DATE/$iso_date}"
  order_json="${order_json//PAYMENT_DATE/$payment_date}"
  order_json="${order_json//IS_PAID/$paid}"
  order_json="${order_json//PAYMENT_METHOD/$payment_method}"
  order_json="${order_json//FULFILLMENT/$fulfillment}"
  order_json="${order_json//DELIVERY_FEE/$delivery_fee}"

  # Post to API
  local response=$(curl -s -X POST "$API_URL/bakeries/$BAKERY_ID/orders" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$order_json" 2>/dev/null)

  if echo "$response" | grep -q '"id"'; then
    ((SUCCESSFUL_ORDERS++))
    return 0
  else
    ((FAILED_ORDERS++))
    echo "$date: $response" >> "$LOG_FILE"
    return 1
  fi
}

# Check prerequisites
if [ ! -f "$USERS_FILE" ] || [ ! -f "$PRODUCTS_FILE" ]; then
  echo -e "${RED}Error: Data files not found${NC}"
  echo "Run: ./scripts/fetch-diana-lee-data.sh"
  exit 1
fi

echo "Starting order seeding for diana_lee-demo..."
echo "Range: $START_DATE to $END_DATE"
echo "Excluding Sundays"
echo ""

> "$LOG_FILE"

# Process each date
current=$(date -d "$START_DATE" +%s)
end=$(date -d "$END_DATE" +%s)

while [ $current -le $end ]; do
  date_str=$(date -d "@$current" +%Y-%m-%d)

  # Skip Sundays
  if is_sunday "$date_str"; then
    echo -e "${YELLOW}⊘${NC} $date_str (Sunday - skipped)"
    ((SKIPPED_SUNDAYS++))
    current=$((current + 86400))
    continue
  fi

  # Get random order count
  order_count=$(get_order_count)
  ((TOTAL_ORDERS += order_count))

  if [ $order_count -eq 0 ]; then
    echo -e "${YELLOW}○${NC} $date_str (0 orders)"
  else
    echo -n "$date_str: Creating $order_count orders... "
    for ((i = 0; i < order_count; i++)); do
      user=$(get_random_user)
      product=$(get_random_product)

      if create_order "$date_str" "$user" "$product"; then
        echo -n "${GREEN}✓${NC} "
      else
        echo -n "${RED}✗${NC} "
      fi

      sleep 0.15
    done
    echo ""
  fi

  current=$((current + 86400))
done

# Summary
echo ""
echo "=========================================="
echo "Seeding Complete!"
echo "=========================================="
echo -e "Sundays skipped: $SKIPPED_SUNDAYS"
echo -e "Total orders attempted: $TOTAL_ORDERS"
echo -e "${GREEN}Successful: $SUCCESSFUL_ORDERS${NC}"
echo -e "${RED}Failed: $FAILED_ORDERS${NC}"
echo "=========================================="

[ $FAILED_ORDERS -gt 0 ] && echo "See $LOG_FILE for details"
