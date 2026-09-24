UPDATE "in_app_notifications"
SET "category" = CASE
  WHEN "event_type" LIKE 'order.%' OR "event_type" LIKE 'payment.%' THEN 'orders'
  WHEN "event_type" = 'inventory.low' THEN 'inventory'
  WHEN "event_type" LIKE 'billing.%' THEN 'billing'
  WHEN "event_type" = 'storefront.inquiry_created' THEN 'inquiries'
  ELSE 'system'
END
WHERE "category" = 'system';
