# Changes: Notification Sounds for Queue & Order Management

## Description
This update adds an audio notification for customers in the Queue Management module when their status changes to "SEATED". It also confirms that an audio notification is already in place for the "READY" status in the Online Ordering module.

## Modified Files

### `src/app/[slug]/queue-status/[id]/page.tsx`
1. Added audio playback logic inside the Pusher channel event listener (`queue_updated`).
2. When the backend emits a status update to `SEATED`, and the customer's current ticket isn't already `SEATED`, a notification chime plays to alert the customer.

### `src/app/[slug]/order-status/[id]/page.tsx`
- **No changes needed.** The logic to play a sound when an online order transitions to the `READY` status is already present and functioning correctly within the `order_update` Pusher event listener.
