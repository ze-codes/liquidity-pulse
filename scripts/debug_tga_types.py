import asyncio
import httpx
import json

URL = "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/dts/operating_cash_balance"

async def main():
    async with httpx.AsyncClient() as client:
        # Fetch page 6 (2019-2020 data)
        print("--- Checking Account Types on Page 6 ---")
        r = await client.get(URL, params={
            "sort": "-record_date",
            "page[number]": 1,
            "page[size]": 1000,
            "format": "json",
            "fields": "record_date,account_type"
        })
        data = r.json().get("data", [])
        types = set(r.get("account_type") for r in data)
        print("Account Types found:")
        for t in types:
            print(f"- {t}")

if __name__ == "__main__":
    asyncio.run(main())

