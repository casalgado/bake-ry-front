#!/bin/bash

# Final Working Order Seeding Script for diana_lee-demo Bakery
# Uses curl with templated JSON payloads

API_URL="https://us-central1-bake-ry.cloudfunctions.net/bake"
BAKERY_ID="diana_lee-demo"
TOKEN="eyJhbGciOiJSUzI1NiIsImtpZCI6IjM4MTFiMDdmMjhiODQxZjRiNDllNDgyNTg1ZmQ2NmQ1NWUzOGRiNWQiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtX2FkbWluIiwiYmFrZXJ5SWQiOiJlcy1hbGltZW50byIsImlzcyI6Imh0dHBzOi8vc2VjdXJldG9rZW4uZ29vZ2xlLmNvbS9iYWtlLXJ5IiwiYXVkIjoiYmFrZS1yeSIsImF1dGhfdGltZSI6MTc2NDk4NTQ1NiwidXNlcl9pZCI6InN5c3RlbS1hZG1pbiIsInN1YiI6InN5c3RlbS1hZG1pbiIsImlhdCI6MTc2NTgzMTMzMSwiZXhwIjoxNzY1ODM0OTMxLCJlbWFpbCI6ImRldkBjYXJzYWxoYXouY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsiZGV2QGNhcnNhbGhhei5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.lEXzJ8RUJVJHtMLJHvoLgBGLSQd6Hspeg5FhG9jij7UL_dFb9WUIw6nxCzV9YCyQyuoDceIQoEIcP5aCZuVLH_uA9Soa2b4uJC5HkSF_B6th3XC7H2Ppx0nJmH2WkSy4HmBp8shia6PD1pWuR-wst0eUOfWB1wcfxCR6dVs1nqe7QS5JJmA-58Me6Yo_WrDCoj2EpI2hzLEBUDUK6xDRE_njrl_W6lqo0a2otC0cdtv4K4-oLPcZCTJzA4qBxfxRZ_ljhdyqdwb73VsRt-OieUHtgTLtBMNmwjZavWt-I4eI_H08-NPawLXE_julrn8KcXoKDerSHmXd08FfIZLbvw"

START_DATE="2025-09-25"
END_DATE="2025-12-15"

LOG_FILE="./seed-data/seeding.log"

# Sample users (extracted from API earlier)
declare -a USERS=(
  "HJZdQNgZxERexVX6Gptv|Santander|s@s.com||B2B"
  "GWO9PF2P4IW5rBcl1aFBqApExXB3|Claudia|clauangel8@gmail.com||B2C"
  "fZNnX3R1pWFZLDee17Mj|Andres Gutierrez|andres@gutierrez.com|3155488778|B2C"
  "al0TfTu5ix53fRKehcRJ|Carlos Alberto Salgado|casalgado86@gmail.com|3155433505|B2C"
  "cg2ndDUsslhcGcSU5FixBazrnKu1|Francisco Grande|manager@lee.com||PER"
  "k2TnpnGm3ZLTvsijK9Ur|Administrador|administrador@lee.com||PER"
)

# Sample products (from API)
declare -a PRODUCTS=(
  "eOcISMCwnHd3yywMr37h|fresa fine|G5wBFb1GZE1CgOTAgB8Z|cheesecakes|190000|120000|0"
  "sCoFPMi0wwXecgwzXd1Q|prueba|OUyzrt9ie5eXVynUwXv0|jars|12000|6000|13"
  "pKTUCkcC4XN9I0gc3EIi|choco chastic|rRKnCoDADej47MszlIOK|cakes|135000|100000|0"
  "sYASSTQsEARkqs38Itox|lime lunatic|G5wBFb1GZE1CgOTAgB8Z|cheesecakes|156000|120000|0"
)

SUCCESSFUL=0
FAILED=0
SKIPPED_SUNDAYS=0
TOTAL_CREATED=0

# Counters
get_random_range() {
  echo $((($RANDOM % 100) + 1))
}

get_order_count() {
  local r=$(get_random_range)
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

is_sunday() {
  [ "$(date -d "$1" +%w)" = "0" ]
}

get_random_user() {
  local idx=$((($RANDOM % ${#USERS[@]})))
  echo "${USERS[$idx]}"
}

get_random_product() {
  local idx=$((($RANDOM % ${#PRODUCTS[@]})))
  echo "${PRODUCTS[$idx]}"
}

get_random_payment_method() {
  local r=$((($RANDOM % 4)))
  case $r in
    0) echo "bancolombia" ;;
    1) echo "davivienda" ;;
    2) echo "cash" ;;
    *) echo "transfer" ;;
  esac
}

is_paid() {
  [ $((($RANDOM % 100) + 1)) -le 70 ] && echo "true" || echo "false"
}

is_delivery() {
  [ $((($RANDOM % 100) + 1)) -le 40 ] && echo "true" || echo "false"
}

get_quantity() {
  echo $((($RANDOM % 3) + 1))
}

create_and_post_order() {
  local date=$1
  local user_line=$2
  local product_line=$3

  # Parse user
  IFS='|' read -r user_id user_name user_email user_phone user_cat <<< "$user_line"

  # Parse product
  IFS='|' read -r prod_id prod_name col_id col_name price cost_price tax <<< "$product_line"

  # Order parameters
  local quantity=$(get_quantity)
  local subtotal=$((price * quantity))
  local tax_amount=$((subtotal * tax / 100))
  local item_total=$((subtotal + tax_amount))
  local item_id="$(date +%s%N | cut -b1-13)$((RANDOM % 10000))"
  local iso_date="${date}T12:00:00.000Z"
  local payment_method=$(get_random_payment_method)
  local paid=$(is_paid)
  local delivery=$(is_delivery)
  local delivery_fee=0

  [ "$delivery" = "true" ] && delivery_fee=7000
  [ "$paid" = "true" ] && local payment_date="\"$iso_date\"" || local payment_date="null"

  local order=$(cat <<EOF
{
  "userId": "$user_id",
  "userName": "$user_name",
  "userEmail": "$user_email",
  "userPhone": "$user_phone",
  "userNationalId": "",
  "userLegalName": "",
  "userCategory": "$user_cat",
  "orderItems": [
    {
      "id": "$item_id",
      "productId": "$prod_id",
      "productName": "$prod_name",
      "productDescription": "",
      "collectionId": "$col_id",
      "collectionName": "$col_name",
      "quantity": $quantity,
      "basePrice": $price,
      "currentPrice": $price,
      "costPrice": $cost_price,
      "taxPercentage": $tax,
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
  "isPaid": $paid,
  "isDeliveryPaid": false,
  "paymentMethod": "$payment_method",
  "fulfillmentType": "$([[ $delivery == 'true' ]] && echo 'delivery' || echo 'pickup')",
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
EOF
)

  local response=$(curl -s -X POST "$API_URL/bakeries/$BAKERY_ID/orders" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$order" 2>/dev/null)

  if echo "$response" | grep -q '"id"'; then
    ((SUCCESSFUL++))
    echo -n "✓"
  else
    ((FAILED++))
    echo -n "✗"
    echo "$date: $response" >> "$LOG_FILE"
  fi
}

echo "Starting order seeding for diana_lee-demo..."
echo "Range: $START_DATE to $END_DATE"
echo "Excluding Sundays"
echo ""

> "$LOG_FILE"

current=$(date -d "$START_DATE" +%s)
end=$(date -d "$END_DATE" +%s)

while [ $current -le $end ]; do
  date_str=$(date -d "@$current" +%Y-%m-%d)

  if is_sunday "$date_str"; then
    echo "⊘ $date_str (Sunday - skipped)"
    ((SKIPPED_SUNDAYS++))
    current=$((current + 86400))
    continue
  fi

  order_count=$(get_order_count)
  ((TOTAL_CREATED += order_count))

  if [ $order_count -eq 0 ]; then
    echo "○ $date_str (0 orders)"
  else
    echo -n "$date_str: Creating $order_count orders... "
    for ((i = 0; i < order_count; i++)); do
      user=$(get_random_user)
      product=$(get_random_product)
      create_and_post_order "$date_str" "$user" "$product"
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
echo "Total orders attempted: $TOTAL_CREATED"
echo "Successful: $SUCCESSFUL"
echo "Failed: $FAILED"
echo "=========================================="
