# TRIÂNGULO — Payments production checklist

Status: PREPARED, LIVE PAYMENTS DISABLED.

## Safety gate
Real Stripe payments must remain blocked unless:
- STRIPE_SECRET_KEY is a live key, AND
- TRIANGULO_PAYMENTS_LIVE_ENABLED=true

Do not enable the flag until all steps below are complete.

## Stripe production
1. Activate/verify the TRIÂNGULO Stripe platform account.
2. Replace the test secret with the live STRIPE_SECRET_KEY in Supabase Edge Function Secrets.
3. Create a LIVE webhook endpoint:
   https://cozamrvrhmwgxbuubjub.supabase.co/functions/v1/stripe-webhook
4. Subscribe the live webhook to the payment events used by the backend.
5. Save the LIVE webhook signing secret as STRIPE_WEBHOOK_SECRET.
6. Confirm TRIANGULO_APP_URL=https://trianguloacores.pt.
7. Keep STRIPE_CONNECT_PAYPAL_ENABLED unset/false until Stripe approves PayPal for Connect.
8. Run one low-value end-to-end live transaction before public launch.
9. Only after that test: set TRIANGULO_PAYMENTS_LIVE_ENABLED=true.

## Payment methods
Validated in Stripe sandbox:
- Card
- MB WAY
- Multibanco
- Apple Pay can be surfaced automatically by Stripe when eligible.

Pending:
- PayPal with Stripe Connect requires separate eligibility/activation. Do not enable it until Stripe accepts the platform setup.

## Marketplace rules
- Client pays the full amount through TRIÂNGULO.
- Provider amount is transferred to the connected provider account.
- TRIÂNGULO retains the 15% client-side service fee before Stripe processing costs.
- Provider contact details remain hidden until payment_status=paid.
- A generated Multibanco reference must not unlock contact details.
- Failed/cancelled/processing payments must not unlock contact details.

## Provider onboarding
- Provider starts Stripe onboarding from the TRIÂNGULO provider area.
- Stripe handles identity and bank/payout details.
- TRIÂNGULO does not store provider bank credentials.
- Payment checkout is unavailable until the provider payout/transfer capability is ready.

## Before public launch
- Verify refund/cancellation wording and operational process.
- Verify dispute/chargeback handling.
- Confirm invoice/receipt and Portuguese tax/accounting workflow with an accountant.
- Test a real provider onboarding in live mode.
- Test Card, MB WAY and Multibanco in live mode with low amounts.
- Confirm post-payment return opens the paid booking and reveals contact only after webhook confirmation.
- Monitor the first live transactions manually.
