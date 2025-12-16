#!/bin/bash

# Simpler Order Seeding Script for diana_lee-demo Bakery
# Creates realistic orders from Sept 25 to Dec 15, 2025
# Excludes all Sundays

API_URL="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY_ID="diana_lee-demo"
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtX2FkbWluIiwiYmFrZXJ5SWQiOiJlcy1hbGltZW50byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9iYWtlLXJ5IiwiYXVkIjoiYmFrZS1yeSIsImF1dGhfdGltZSI6MTc2NDk4NTQ1NiwidXNlcl9pZCI6InN5c3RlbS1hZG1pbiIsInN1YiI6InN5c3RlbS1hZG1pbiIsImlhdCI6MTc2NTgzMTMzMSwiZXhwIjoxNzY1ODM0OTMxLCJlbWFpbCI6ImRldkBjYXJzYWxoYXouY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiZGV2QGNhcnNhbGhhei5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lEXzJ8RUJVJHtMLJHvoLgBGLSQd6Hspeg5FhG9jij7UL_dFb9WUIw6nxCzV9YCyQyuoDceIQoEIcP5aCZuVLH_uA9Soa2b4uJC5HkSF_B6th3XC7H2Ppx0nJmH2WkSy4HmBp8shia6PD1pWuR-wst0eUOfWB1wcfxCR6dVs1nqe7QS5JJmA-58Me6Yo_WrDCoj2EpI2hzLEBUDUK6xDRE_njrl_W6lqo0a2otC0cdtv4K4-oLPcZCTJzA4qBxfxRZ_ljhdyqdwb73VsRt-OieUHtgTLtBMNmwjZavWt-I4eI_H08-NPawLXE_julrn8KcXoKDerSHmXd08FfIZLbvw"

START_DATE="2025-09-25"
END_DATE="2025-12-15"

USERS_FILE="./seed-data/users.json"
PRODUCTS_FILE="./seed-data/products.json"
LOG_FILE="./seed-data/seeding.log"

# Counters
TOTAL_ORDERS=0
SUCCESSFUL_ORDERS=0
FAILED_ORDERS=0
SKIPPED_SUNDAYS=0

# Get random number between 1-100
rand() {
  echo $((($RANDOM % 100) + 1))
}

# Get order count based on distribution
get_order_count() {
  local r=$(rand)
  if [ $r -le 3 ]; then
    echo 0
  elif [ $r -le 33 ]; then
    echo 1
  elif [ $r -le 73 ]; then
    echo 2
  elif [ $r -le 93 ]; then
    echo 3
  else
    echo 4
  fi
}

# Check if Sunday
is_sunday() {
  local dow=$(date -d "$1" +%w)
  [ "$dow" = "0" ]
}

# Get random value from 0-N
get_random_in_range() {
  local max=$1
  echo $((($RANDOM % ($max + 1))))
}

# Extract value from JSON line using sed
extract_json() {
  local json="$1"
  local key="$2"
  echo "$json" | sed -n "s/.*\"$key\":\"\([^\"]*\)\".*/\1/p" | head -1
}

# Extract number from JSON
extract_json_num() {
  local json="$1"
  local key="$2"
  echo "$json" | sed -n "s/.*\"$key\":\([0-9]*\).*/\1/p" | head -1
}

# Get random user (using sed)
get_random_user() {
  local count=$(grep -o '{"id":"' "$USERS_FILE" | wc -l)
  local idx=$((($RANDOM % $count) + 1))
  sed -n "$((idx * 2))p" "$USERS_FILE" 2>/dev/null || echo ""
}

# Get random product (using sed)
get_random_product() {
  local count=$(grep -o '{"id":"' "$PRODUCTS_FILE" | wc -l)
  local idx=$((($RANDOM % $count) + 1))
  sed -n "$((idx * 2))p" "$PRODUCTS_FILE" 2>/dev/null || echo ""
}

# Post order via curl
post_order() {
  local order_json="$1"

  local response=$(curl -s -X POST "$API_URL/bakeries/$BAKERY_ID/orders" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$order_json" 2>/dev/null)

  if echo "$response" | grep -q '"id"'; then
    ((SUCCESSFUL_ORDERS++))
    echo -n "✓"
    return 0
  else
    ((FAILED_ORDERS++))
    echo -n "✗"
    echo "$1" >> "$LOG_FILE"
    return 1
  fi
}

echo "Starting order seeding for diana_lee-demo..."
echo "Range: $START_DATE to $END_DATE"
echo "Excluding Sundays"
echo ""

> "$LOG_FILE"

# Main loop
current=$(date -d "$START_DATE" +%s)
end=$(date -d "$END_DATE" +%s)

while [ $current -le $end ]; do
  date_str=$(date -d "@$current" +%Y-%m-%d)

  # Skip Sundays
  if is_sunday "$date_str"; then
    echo "⊘ $date_str (Sunday - skipped)"
    ((SKIPPED_SUNDAYS++))
    current=$((current + 86400))
    continue
  fi

  # Get order count
  order_count=$(get_order_count)
  ((TOTAL_ORDERS += order_count))

  if [ $order_count -eq 0 ]; then
    echo "○ $date_str (0 orders)"
  else
    echo -n "$date_str: Creating $order_count orders... "

    iso_date="${date_str}T12:00:00.000Z"
    payment_date="null"

    for ((i = 0; i < order_count; i++)); do
      # Get random user and product
      user_line=$(get_random_user)
      product_line=$(get_random_product)

      if [ -z "$user_line" ] || [ -z "$product_line" ]; then
        echo -n "!"
        ((FAILED_ORDERS++))
        continue
      fi

      user_id=$(extract_json "$user_line" "id")
      user_name=$(extract_json "$user_line" "name")
      user_email=$(extract_json "$user_line" "email")
      user_phone=$(extract_json "$user_line" "phone")
      user_category=$(extract_json "$user_line" "category")

      product_id=$(extract_json "$product_line" "id")
      product_name=$(extract_json "$product_line" "name")
      collection_id=$(extract_json "$product_line" "collectionId")
      collection_name=$(extract_json "$product_line" "collectionName")
      price=$(extract_json_num "$product_line" "currentPrice")
      cost_price=$(extract_json_num "$product_line" "costPrice")
      tax_pct=$(extract_json_num "$product_line" "taxPercentage")

      [ -z "$price" ] && price=0
      [ -z "$cost_price" ] && cost_price=0
      [ -z "$tax_pct" ] && tax_pct=0

      quantity=$((($RANDOM % 3) + 1))
      subtotal=$((price * quantity))
      tax_amount=$((subtotal * tax_pct / 100))
      item_total=$((subtotal + tax_amount))

      # Payment method
      pm_rand=$((($RANDOM % 4)))
      case $pm_rand in
        0) payment_method="bancolombia" ;;
        1) payment_method="davivienda" ;;
        2) payment_method="cash" ;;
        *) payment_method="transfer" ;;
      esac

      # Paid?
      is_paid=$((($RANDOM % 100) + 1))
      if [ $is_paid -le 70 ]; then
        is_paid_str="true"
        payment_date="\"$iso_date\""
      else
        is_paid_str="false"
        payment_date="null"
      fi

      # Delivery?
      is_delivery_rand=$((($RANDOM % 100) + 1))
      if [ $is_delivery_rand -le 40 ]; then
        fulfillment="delivery"
        delivery_fee=7000
      else
        fulfillment="pickup"
        delivery_fee=0
      fi

      item_id="$(date +%s%N | cut -b1-13)$((RANDOM % 10000))"

      order=$(cat <<ORDEREOF
{
  "userId": "$user_id",
  "userName": "$user_name",
  "userEmail": "$user_email",
  "userPhone": "$user_phone",
  "userNationalId": "",
  "userLegalName": "",
  "userCategory": "$user_category",
  "orderItems": [
    {
      "id": "$item_id",
      "productId": "$product_id",
      "productName": "$product_name",
      "productDescription": "",
      "collectionId": "$collection_id",
      "collectionName": "$collection_name",
      "quantity": $quantity,
      "basePrice": $price,
      "currentPrice": $price,
      "costPrice": $cost_price,
      "taxPercentage": $tax_pct,
      "isComplimentary": false,
      "productionBatch": 1,
      "status": 0,
      "combination": null,
      "variation": null,
      "taxAmount": $tax_amount,
      "preTaxPrice": $subtotal,
      "subtotal": $item_total
    }
  ],
  "preparationDate": "$iso_date",
  "dueDate": "$iso_date",
  "paymentDate": $payment_date,
  "partialPaymentDate": "",
  "partialPaymentAmount": null,
  "dueTime": "",
  "status": 0,
  "isPaid": $is_paid_str,
  "isDeliveryPaid": false,
  "paymentMethod": "$payment_method",
  "fulfillmentType": "$fulfillment",
  "deliveryAddress": "",
  "deliveryInstructions": "",
  "deliveryDriverId": "-",
  "driverMarkedAsPaid": false,
  "deliverySequence": 1,
  "deliveryFee": $delivery_fee,
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
ORDEREOF
)

      post_order "$order"
      sleep 0.1
    done
    echo ""
  fi

  current=$((current + 86400))
done

echo ""
echo "=========================================="
echo "Seeding Complete!"
echo "=========================================="
echo "Sundays skipped: $SKIPPED_SUNDAYS"
echo "Total orders attempted: $TOTAL_ORDERS"
echo "Successful: $SUCCESSFUL_ORDERS"
echo "Failed: $FAILED_ORDERS"
echo "=========================================="
