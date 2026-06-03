# Markdown API Overview

Shared documentation referenced by API files using `ref` links.
Each API's `description` field uses `ref overview.md#section` to load its docs from here.

## Search Products

Search the product catalog by keyword.

> Request Format

Pass `q` as a query parameter with the search term.
The server echoes back the full request including **headers** and **query string**.

> Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `method` | string | HTTP method used |
| `path` | string | Request path |
| `body` | object | Echoed request body (empty for GET) |

> Notes

- Results are sorted by *relevance* by default
- Use `sort=price` to sort by price ascending
- Maximum **100** results per page

## Submit Order

Place a new order with the given items.

> Authentication

Requires a **Bearer token** in the `Authorization` header.
See the [Authentication](#authentication) section below for details.

> Request Body

The body must be a JSON object with the following fields:

1. `product_id` — the product to order
2. `quantity` — number of units (min: 1, max: 99)
3. `note` — optional note for the seller

> Status Codes

| Code | Meaning |
| --- | --- |
| `200` | Order placed successfully |
| `400` | Validation error (missing fields) |
| `401` | Missing or invalid auth token |
| `422` | Product out of stock |

## Authentication

All endpoints under the **Orders** service require a `Bearer` token in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

Tokens are issued by the `/auth` endpoint and expire after **1 hour**.
Contact your admin to request API credentials.

## Health Check

Returns basic system information as JSON.

Use this endpoint to verify connectivity before running tests.
A `200` response with a valid JSON body indicates the server is healthy.

**Expected fields:**
- `id` — always `1`
- `name` — service name
- `version` — current version string
- `tags` — capability tags
