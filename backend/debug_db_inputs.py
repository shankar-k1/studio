import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
import psycopg2
from psycopg2.extras import execute_values

load_dotenv("/Users/bng/Downloads/OBD promotions/backend/.env")

url = os.getenv("DATABASE_URL")
if url.startswith("postgres://"):
    url = url.replace("postgres://", "postgresql+psycopg2://", 1)
elif "postgresql" in url and "://" in url and not url.startswith("postgresql+psycopg2"):
    url = url.replace("://", "+psycopg2://", 1)

print(f"Testing with URL: {url[:30]}...")

engine = create_engine(url)

try:
    with engine.connect() as conn:
        print("Connected! Checking table schema...")
        res = conn.execute(text("SELECT column_name, data_type, character_maximum_length FROM information_schema.columns WHERE table_name = 'scrub_job_inputs'"))
        for row in res:
            print(row)
        
        print("\nChecking last scrub jobs...")
        res = conn.execute(text("SELECT * FROM scrub_jobs ORDER BY created_at DESC LIMIT 5"))
        columns = res.keys()
        for row in res:
            print(dict(zip(columns, row)))
            
    print("\nTrying manual raw insert (simulating DatabaseModule.add_scrub_job_inputs)...")
    msisdns = ["1234567890"] * 10
    job_id = 1 # Dummy or get from above
    
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        data = [(job_id, str(m)) for m in msisdns]
        try:
            execute_values(
                cursor,
                "INSERT INTO scrub_job_inputs (job_id, msisdn) VALUES %s",
                data,
                page_size=10000,
            )
            print("Execute values succeeded.")
            raw_conn.commit()
            print("Commit succeeded.")
        except Exception as e:
            print(f"FAILED during execute/commit: {e}")
        finally:
            cursor.close()
    finally:
        if raw_conn:
            raw_conn.close()

except Exception as e:
    print(f"General Error: {e}")
