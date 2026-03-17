"""
Test: Inserting 60 Lakh (6,000,000) MSISDNs into the database.
Simulates a large-scale data injection to validate chunked persistence.
"""
import time
import random
from modules.database_module import DatabaseModule
from sqlalchemy import text

db = DatabaseModule()
if not db.engine:
    print("❌ Database not initialized")
    exit(1)

# Generate 60 Lakh unique MSISDNs (Cameroon-style: 237 + 6XXXXXXXX)
print("📦 Generating 6,000,000 test MSISDNs...")
t0 = time.time()
msisdns = [f"2376{random.randint(10000000, 99999999)}" for _ in range(6_000_000)]
gen_time = time.time() - t0
print(f"✅ Generated {len(msisdns):,} MSISDNs in {gen_time:.1f}s")

# Step 1: Create a scrub job
print("\n🔧 Creating scrub job...")
job_id = db.create_scrub_job("load_test", len(msisdns), None, {"dnd": True})
print(f"   Job ID: {job_id}")

# Step 2: Persist inputs using chunked logic
print(f"\n🚀 Persisting {len(msisdns):,} MSISDNs (chunked @ 50k)...")
t1 = time.time()
success = db.add_scrub_job_inputs(job_id, msisdns)
t2 = time.time()

if success:
    print(f"✅ Persistence PASSED in {t2-t1:.1f}s ({len(msisdns)/(t2-t1):,.0f} records/sec)")
else:
    print(f"❌ Persistence FAILED: {db.last_error}")

# Step 3: Verify count in DB
print("\n🔍 Verifying row count in scrub_job_inputs...")
with db.engine.connect() as conn:
    count = conn.execute(text("SELECT COUNT(*) FROM scrub_job_inputs WHERE job_id = :jid"), {"jid": job_id}).scalar()
    print(f"   DB Count: {count:,} (expected {len(msisdns):,})")
    if count == len(msisdns):
        print("   ✅ COUNT MATCHES!")
    else:
        print(f"   ⚠️ MISMATCH: {count:,} vs {len(msisdns):,}")

# Step 4: Cleanup
print("\n🧹 Cleaning up test data...")
t3 = time.time()
with db.engine.connect() as conn:
    conn.execute(text("DELETE FROM scrub_job_inputs WHERE job_id = :jid"), {"jid": job_id})
    conn.execute(text("DELETE FROM scrub_jobs WHERE id = :jid"), {"jid": job_id})
    conn.commit()
t4 = time.time()
print(f"   Cleanup done in {t4-t3:.1f}s")

print(f"\n{'='*50}")
print(f"📊 SUMMARY")
print(f"   Records:      {len(msisdns):,}")
print(f"   Generation:   {gen_time:.1f}s")
print(f"   Persistence:  {t2-t1:.1f}s")
print(f"   Throughput:    {len(msisdns)/(t2-t1):,.0f} records/sec")
print(f"   Cleanup:      {t4-t3:.1f}s")
print(f"   Result:       {'✅ PASS' if success and count == len(msisdns) else '❌ FAIL'}")
print(f"{'='*50}")
