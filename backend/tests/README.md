# E2E tests

Prerequisites: run services via `docker-compose -f backend/docker-compose.yml up --build`.

Run the simple E2E script:

```bash
# from repo root
node backend/tests/e2e/order-flow.js
```

The script posts an order to API Gateway and polls the Payment service for the payment record.
